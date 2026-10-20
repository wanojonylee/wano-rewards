/**
 * Recycling sessions: start, live deposits, completion and machine ingestion.
 *
 * Points/cashback are credited exactly once when the session finalizes
 * (user pressed finish, machine finished, or the 10-minute TTL expired), using
 * a ledger idempotency key derived from the session id.
 */
import { env } from "../env.ts";
import { ApiError } from "../errors.ts";
import { all, get, run, withTransaction } from "../db/index.ts";
import { RULES, tierFor } from "../config/economy.ts";
import { DEMO_SKUS, jitterWeight, pickSku } from "../config/demo-catalog.ts";
import { awardForDeposit, type AwardResult } from "./awards.ts";
import { recordCampaignDeposit } from "./campaigns.ts";
import { applyLedger } from "./ledger.ts";
import { notify } from "./notifications.ts";
import {
  bumpFill,
  machineView,
  requireMachineByCode,
  touchMachine,
  type MachineView,
} from "./machines.ts";
import { newId, newOpaqueToken, newRedemptionCode } from "../utils/ids.ts";
import { addMinutes, nowIso } from "../utils/time.ts";
import type { DepositRow, MachineRow, MaterialCode, SessionRow, UserRow } from "../types.ts";

export interface SessionTotals {
  items: number;
  weightGrams: number;
  points: number;
  cashbackCents: number;
  co2Grams: number;
}

export interface DepositView {
  id: string;
  gtin: string | null;
  material: MaterialCode;
  skuName: string | null;
  weightGrams: number;
  accepted: boolean;
  rejectReason: string | null;
  points: number;
  cashbackCents: number;
  co2Grams: number;
  batchId: string | null;
  createdAt: string;
}

export interface SessionReceipt {
  code: string;
  issuedAt: string;
  items: number;
  points: number;
  cashbackCents: number;
  co2Grams: number;
  machineName: string;
  machineCode: string;
}

export interface SessionView {
  id: string;
  status: SessionRow["status"];
  machine: MachineView;
  startedAt: string;
  expiresAt: string;
  completedAt: string | null;
  deposits: DepositView[];
  totals: SessionTotals;
  receipt: SessionReceipt | null;
}

export function depositView(row: DepositRow): DepositView {
  return {
    id: row.id,
    gtin: row.gtin,
    material: row.material,
    skuName: row.sku_name,
    weightGrams: row.weight_grams,
    accepted: Boolean(row.accepted),
    rejectReason: row.reject_reason,
    points: row.points,
    cashbackCents: row.cashback_cents,
    co2Grams: row.co2_grams,
    batchId: row.batch_id,
    createdAt: row.created_at,
  };
}

export function totalsFor(sessionId: string): SessionTotals {
  const row = get<{ items: number; grams: number; points: number; cashback: number; co2: number }>(
    `SELECT COUNT(*) AS items,
            COALESCE(SUM(weight_grams), 0) AS grams,
            COALESCE(SUM(points), 0) AS points,
            COALESCE(SUM(cashback_cents), 0) AS cashback,
            COALESCE(SUM(co2_grams), 0) AS co2
     FROM deposits WHERE session_id = ? AND accepted = 1`,
    [sessionId],
  );
  return {
    items: row?.items ?? 0,
    weightGrams: row?.grams ?? 0,
    points: row?.points ?? 0,
    cashbackCents: row?.cashback ?? 0,
    co2Grams: row?.co2 ?? 0,
  };
}

function parseReceipt(raw: string | null): SessionReceipt | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionReceipt;
  } catch {
    return null;
  }
}

export function sessionView(session: SessionRow): SessionView {
  const machine = get<MachineRow>("SELECT * FROM machines WHERE id = ?", [session.machine_id]);
  if (!machine) throw new Error(`machine missing for session ${session.id}`);
  const deposits = all<DepositRow>(
    "SELECT * FROM deposits WHERE session_id = ? ORDER BY created_at ASC, rowid ASC",
    [session.id],
  );
  return {
    id: session.id,
    status: session.status,
    machine: machineView(machine),
    startedAt: session.started_at,
    expiresAt: session.expires_at,
    completedAt: session.completed_at,
    deposits: deposits.map(depositView),
    totals: totalsFor(session.id),
    receipt: parseReceipt(session.receipt_json),
  };
}

function newSessionToken(): string {
  return newOpaqueToken(24);
}

export function startSession(
  user: UserRow,
  machineCode: string,
  source: string,
): { session: SessionView; pollAfterMs: number } {
  const machine = requireMachineByCode(machineCode);
  if (machine.status === "maintenance") {
    throw new ApiError("MACHINE_UNAVAILABLE", "Máquina em manutenção", 409, {
      machineCode: machine.code,
      status: machine.status,
    });
  }
  if (machine.status === "full" || machine.fill_percent >= 100) {
    throw new ApiError("MACHINE_FULL", "Máquina cheia. Escolha outra unidade.", 409, {
      machineCode: machine.code,
      fillPercent: machine.fill_percent,
    });
  }

  return withTransaction(() => {
    const active = get<SessionRow>(
      "SELECT * FROM sessions WHERE user_id = ? AND status = 'active'",
      [user.id],
    );
    if (active) {
      if (Date.parse(active.expires_at) <= Date.now()) {
        finalizeSession(active, "expired");
      } else {
        throw new ApiError("SESSION_ALREADY_ACTIVE", "Você já tem uma sessão em andamento", 409, {
          sessionId: active.id,
          expiresAt: active.expires_at,
        });
      }
    }

    const now = nowIso();
    const row: SessionRow = {
      id: newId("ses"),
      user_id: user.id,
      machine_id: machine.id,
      status: "active",
      source,
      token: newSessionToken(),
      started_at: now,
      expires_at: addMinutes(RULES.sessionTtlMinutes),
      completed_at: null,
      items: 0,
      weight_grams: 0,
      points_earned: 0,
      cashback_cents: 0,
      co2_grams: 0,
      receipt_json: null,
      created_at: now,
    };
    run(
      `INSERT INTO sessions (id, user_id, machine_id, status, source, token, started_at, expires_at,
         completed_at, items, weight_grams, points_earned, cashback_cents, co2_grams, receipt_json, created_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, NULL, 0, 0, 0, 0, 0, NULL, ?)`,
      [row.id, row.user_id, row.machine_id, row.source, row.token, row.started_at, row.expires_at, row.created_at],
    );

    return { session: sessionView(row), pollAfterMs: 1500 };
  });
}

export function getSessionForUser(userId: string, sessionId: string, isAdmin = false): SessionView {
  let row = get<SessionRow>("SELECT * FROM sessions WHERE id = ?", [sessionId]);
  if (!row) throw ApiError.notFound("Sessão não encontrada");
  if (!isAdmin && row.user_id !== userId) throw ApiError.forbidden("Sessão de outro usuário");
  if (row.status === "active" && Date.parse(row.expires_at) <= Date.now()) {
    finalizeSession(row, "expired");
    row = get<SessionRow>("SELECT * FROM sessions WHERE id = ?", [sessionId]) as SessionRow;
  }
  return sessionView(row);
}

/** Idempotent: completing an already-completed session returns its final state. */
export function completeSession(user: UserRow, sessionId: string): SessionView {
  const row = get<SessionRow>("SELECT * FROM sessions WHERE id = ?", [sessionId]);
  if (!row) throw ApiError.notFound("Sessão não encontrada");
  if (row.user_id !== user.id) throw ApiError.forbidden("Sessão de outro usuário");

  if (row.status !== "active") return sessionView(row);
  if (Date.parse(row.expires_at) <= Date.now()) {
    finalizeSession(row, "expired");
  } else {
    finalizeSession(row, "completed");
  }
  const updated = get<SessionRow>("SELECT * FROM sessions WHERE id = ?", [sessionId]);
  return sessionView(updated as SessionRow);
}

function buildReceipt(machine: MachineRow, totals: SessionTotals): SessionReceipt {
  return {
    code: `REC-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${newRedemptionCode().slice(0, 4)}`,
    issuedAt: nowIso(),
    items: totals.items,
    points: totals.points,
    cashbackCents: totals.cashbackCents,
    co2Grams: totals.co2Grams,
    machineName: machine.name,
    machineCode: machine.code,
  };
}

/** Credits the session once and closes it. Safe to call repeatedly. */
export function finalizeSession(session: SessionRow, status: "completed" | "expired"): SessionRow {
  return withTransaction(() => {
    const current = get<SessionRow>("SELECT * FROM sessions WHERE id = ?", [session.id]);
    if (!current || current.status !== "active") return current ?? session;

    const machine = get<MachineRow>("SELECT * FROM machines WHERE id = ?", [current.machine_id]);
    const totals = totalsFor(current.id);
    const now = nowIso();

    if (totals.points > 0 || totals.cashbackCents > 0) {
      applyLedger({
        userId: current.user_id,
        pointsDelta: totals.points,
        creditDeltaCents: totals.cashbackCents,
        withdrawableDeltaCents: totals.cashbackCents,
        type: "deposit",
        refType: "session",
        refId: current.id,
        description: `Reciclagem — ${machine?.name ?? "RVM"}`,
        idempotencyKey: `session:${current.id}`,
        createdAt: now,
      });
    }

    const receipt = totals.items > 0 ? buildReceipt(machine as MachineRow, totals) : null;
    run(
      `UPDATE sessions SET status = ?, completed_at = ?, points_earned = ?, cashback_cents = ?,
         co2_grams = ?, receipt_json = ? WHERE id = ?`,
      [
        status,
        status === "completed" ? now : current.expires_at,
        totals.points,
        totals.cashbackCents,
        totals.co2Grams,
        receipt ? JSON.stringify(receipt) : null,
        current.id,
      ],
    );

    if (totals.items > 0) {
      bumpFill(current.machine_id, totals.items);
      notify({
        userId: current.user_id,
        type: status === "completed" ? "session_completed" : "session_expired",
        title: status === "completed" ? "Reciclagem concluída" : "Sessão encerrada",
        body: `Você reciclou ${totals.items} ${totals.items === 1 ? "item" : "itens"} e ganhou ${totals.points} pontos + R$ ${(totals.cashbackCents / 100).toFixed(2).replace(".", ",")} de cashback.`,
        icon: "recycle",
        deepLink: `recio://wallet`,
        createdAt: now,
      });
    }

    return get<SessionRow>("SELECT * FROM sessions WHERE id = ?", [current.id]) as SessionRow;
  });
}

function duplicateGtin(sessionId: string, gtin: string | null): boolean {
  if (!gtin) return false;
  const threshold = new Date(Date.now() - RULES.duplicateGtinWindowMs).toISOString();
  const row = get<{ id: string }>(
    `SELECT id FROM deposits
     WHERE session_id = ? AND gtin = ? AND accepted = 1 AND created_at >= ? LIMIT 1`,
    [sessionId, gtin, threshold],
  );
  return Boolean(row);
}

interface InsertDepositInput {
  session: SessionRow;
  machine: MachineRow;
  skuName: string | null;
  gtin: string | null;
  material: MaterialCode;
  weightGrams: number;
  accepted: boolean;
  rejectReason: string | null;
  award: AwardResult | null;
  eventId: string | null;
  batchId: string | null;
  at: string;
}

function insertDeposit(input: InsertDepositInput): DepositRow {
  const row: DepositRow = {
    id: newId("dep"),
    session_id: input.session.id,
    user_id: input.session.user_id,
    machine_id: input.machine.id,
    gtin: input.gtin,
    material: input.material,
    sku_name: input.skuName,
    weight_grams: input.weightGrams,
    accepted: input.accepted ? 1 : 0,
    reject_reason: input.rejectReason,
    points: input.award?.points ?? 0,
    cashback_cents: input.award?.cashbackCents ?? 0,
    co2_grams: input.award?.co2Grams ?? 0,
    batch_id: input.batchId,
    event_id: input.eventId,
    campaign_id: input.award?.campaign?.id ?? null,
    created_at: input.at,
  };
  run(
    `INSERT INTO deposits (id, session_id, user_id, machine_id, gtin, material, sku_name, weight_grams,
       accepted, reject_reason, points, cashback_cents, co2_grams, batch_id, event_id, campaign_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.session_id,
      row.user_id,
      row.machine_id,
      row.gtin,
      row.material,
      row.sku_name,
      row.weight_grams,
      row.accepted,
      row.reject_reason,
      row.points,
      row.cashback_cents,
      row.co2_grams,
      row.batch_id,
      row.event_id,
      row.campaign_id,
      row.created_at,
    ],
  );

  if (input.accepted) {
    for (const campaign of input.award?.campaigns ?? []) {
      run(
        "INSERT INTO deposit_campaigns (deposit_id, campaign_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
        [row.id, campaign.id],
      );
    }
    if (input.award) {
      recordCampaignDeposit(
        (input.award.campaigns ?? []).map((campaign) => campaign.id),
        input.session.user_id,
        { weightGrams: row.weight_grams, points: row.points },
        input.at,
      );
    }
    run(
      `UPDATE sessions SET items = items + 1, weight_grams = weight_grams + ?,
         points_earned = points_earned + ?, cashback_cents = cashback_cents + ?,
         co2_grams = co2_grams + ? WHERE id = ?`,
      [row.weight_grams, row.points, row.cashback_cents, row.co2_grams, row.session_id],
    );
  }
  return row;
}

function activeSessionOrThrow(sessionId: string, userId: string): SessionRow {
  const session = get<SessionRow>("SELECT * FROM sessions WHERE id = ?", [sessionId]);
  if (!session) throw ApiError.notFound("Sessão não encontrada");
  if (session.user_id !== userId) throw ApiError.forbidden("Sessão de outro usuário");
  if (session.status !== "active") {
    throw new ApiError("SESSION_NOT_ACTIVE", "Sessão não está ativa", 409, { status: session.status });
  }
  if (Date.parse(session.expires_at) <= Date.now()) {
    throw new ApiError("SESSION_NOT_ACTIVE", "Sessão expirada", 409, { status: "expired" });
  }
  return session;
}

export function simulateDeposit(
  user: UserRow,
  sessionId: string,
  materialInput?: MaterialCode,
): { deposit: DepositView; totals: SessionTotals } {
  if (!env.demoMode) {
    throw ApiError.forbidden("Simulação disponível apenas quando DEMO_MODE=true");
  }

  const preview = get<SessionRow>("SELECT * FROM sessions WHERE id = ?", [sessionId]);
  if (
    preview &&
    preview.user_id === user.id &&
    preview.status === "active" &&
    Date.parse(preview.expires_at) <= Date.now()
  ) {
    finalizeSession(preview, "expired");
  }

  return withTransaction(() => {
    const session = activeSessionOrThrow(sessionId, user.id);
    const machine = get<MachineRow>("SELECT * FROM machines WHERE id = ?", [session.machine_id]);
    if (!machine) throw ApiError.notFound("Máquina não encontrada");

    const machineMaterials = all<{ material: MaterialCode }>(
      "SELECT material FROM machine_materials WHERE machine_id = ?",
      [machine.id],
    ).map((row) => row.material);
    const material: MaterialCode =
      materialInput ??
      (machineMaterials.length > 0
        ? (machineMaterials[Math.floor(Math.random() * machineMaterials.length)] as MaterialCode)
        : "PET");

    if (machineMaterials.length > 0 && !machineMaterials.includes(material)) {
      throw ApiError.badRequest("VALIDATION_ERROR", "Material não aceito por esta máquina", {
        material,
        acceptedMaterials: machineMaterials,
      });
    }

    if (session.items >= RULES.maxItemsPerSession) {
      throw ApiError.badRequest("VALIDATION_ERROR", "Limite de 500 itens por sessão atingido");
    }

    const sku = pickSku(material);
    const weight = jitterWeight(sku.weightGrams);
    const now = nowIso();
    const tierMultiplier = tierFor(user.lifetime_points).multiplier;
    const award = awardForDeposit({ material, weightGrams: weight, brand: sku.brand, at: now, tierMultiplier });
    const duplicate = duplicateGtin(session.id, sku.gtin);

    const row = insertDeposit({
      session,
      machine,
      skuName: sku.skuName,
      gtin: sku.gtin,
      material,
      weightGrams: weight,
      accepted: !duplicate,
      rejectReason: duplicate ? "DUPLICATE_GTIN" : null,
      award: duplicate ? null : award,
      eventId: null,
      batchId: null,
      at: now,
    });

    touchMachine(machine.id);
    return { deposit: depositView(row), totals: totalsFor(session.id) };
  });
}

export interface IngestItem {
  gtin?: string | null;
  material: MaterialCode;
  weightGrams: number;
  accepted: boolean;
  rejectReason?: string | null;
  skuName?: string | null;
  brand?: string | null;
}

export interface IngestPayload {
  machineCode: string;
  sessionToken: string;
  eventId: string;
  occurredAt?: string;
  items: IngestItem[];
}

export interface IngestResponse {
  accepted: number;
  rejected: number;
  pointsAwarded: number;
  cashbackCents: number;
  duplicate?: boolean;
}

export function ingestDeposits(machine: MachineRow, payload: IngestPayload): IngestResponse {
  if (payload.machineCode !== machine.code) {
    throw ApiError.badRequest("VALIDATION_ERROR", "machineCode não corresponde à chave da máquina", {
      expected: machine.code,
    });
  }

  const eventKey = `machine:${payload.eventId}`;
  const existing = get<{ response_json: string | null }>(
    "SELECT response_json FROM webhook_events WHERE id = ?",
    [eventKey],
  );
  if (existing?.response_json) {
    return { ...(JSON.parse(existing.response_json) as IngestResponse), duplicate: true };
  }

  const previewSession = get<SessionRow>(
    "SELECT * FROM sessions WHERE token = ? AND machine_id = ?",
    [payload.sessionToken, machine.id],
  );
  if (
    previewSession &&
    previewSession.status === "active" &&
    Date.parse(previewSession.expires_at) <= Date.now()
  ) {
    finalizeSession(previewSession, "expired");
  }

  return withTransaction(() => {
    const session = get<SessionRow>(
      "SELECT * FROM sessions WHERE token = ? AND machine_id = ?",
      [payload.sessionToken, machine.id],
    );
    if (!session || session.status !== "active") {
      throw new ApiError("SESSION_NOT_ACTIVE", "Token de sessão inválido ou inativo", 409);
    }

    const now = nowIso();
    const tierMultiplier = tierFor(
      get<{ lifetime_points: number }>("SELECT lifetime_points FROM users WHERE id = ?", [
        session.user_id,
      ])?.lifetime_points ?? 0,
    ).multiplier;
    const batchId = `${RULES.depositBatchPrefix}-${now.slice(0, 10).replace(/-/g, "")}-${machine.code}`;

    let accepted = 0;
    let rejected = 0;
    let pointsAwarded = 0;
    let cashbackCents = 0;
    let itemCount = session.items;

    for (const item of payload.items) {
      if (itemCount >= RULES.maxItemsPerSession) {
        rejected += 1;
        continue;
      }
      const gtin = item.gtin ?? null;
      const knownSku = gtin ? DEMO_SKUS.find((sku) => sku.gtin === gtin) : undefined;
      const skuName = item.skuName ?? knownSku?.skuName ?? null;
      const brand = item.brand ?? knownSku?.brand ?? null;

      let rejectReason: string | null = null;
      if (!item.accepted) rejectReason = item.rejectReason ?? "REJECTED_BY_MACHINE";
      else if (item.weightGrams <= 0 || item.weightGrams > RULES.maxWeightGrams) rejectReason = "INVALID_WEIGHT";
      else if (duplicateGtin(session.id, gtin)) rejectReason = "DUPLICATE_GTIN";

      if (rejectReason) {
        insertDeposit({
          session,
          machine,
          skuName,
          gtin,
          material: item.material,
          weightGrams: Math.max(0, item.weightGrams),
          accepted: false,
          rejectReason,
          award: null,
          eventId: payload.eventId,
          batchId,
          at: now,
        });
        rejected += 1;
        continue;
      }

      const award = awardForDeposit({
        material: item.material,
        weightGrams: item.weightGrams,
        brand,
        at: now,
        tierMultiplier,
      });
      insertDeposit({
        session,
        machine,
        skuName,
        gtin,
        material: item.material,
        weightGrams: item.weightGrams,
        accepted: true,
        rejectReason: null,
        award,
        eventId: payload.eventId,
        batchId,
        at: now,
      });
      accepted += 1;
      itemCount += 1;
      pointsAwarded += award.points;
      cashbackCents += award.cashbackCents;
    }

    touchMachine(machine.id);
    const response: IngestResponse = { accepted, rejected, pointsAwarded, cashbackCents };
    run(
      `INSERT INTO webhook_events (id, provider, type, payload_json, response_json, status, processed_at, created_at)
       VALUES (?, 'machine', 'deposit.batch', ?, ?, 'processed', ?, ?)`,
      [eventKey, JSON.stringify(payload), JSON.stringify(response), now, now],
    );
    return response;
  });
}
