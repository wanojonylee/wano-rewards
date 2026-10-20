/**
 * Demo seed. Idempotent full reset: `npm run seed`.
 *
 * Produces the dataset the mobile app demo relies on:
 *  - Marina Costa (+5511999990000): 90 days of plausible history, Forest tier,
 *    1.860 pts, R$ 42,70 credit (R$ 22,70 withdrawable), 12 completed sessions,
 *    45 deposits, 3 redemptions (2 active), 6 notifications, referral MARINA10.
 *  - Edifício Aurora (Pinheiros/SP) with 3 towers and 8 RVMs.
 *  - 14 rewards, 6 campaigns, 8 leaderboard peers, admin and partner accounts.
 */
import { pathToFileURL } from "node:url";
import { closeDb, exec, get, initDb, run, withTransaction } from "../db/index.ts";
import { awardForDeposit } from "../services/awards.ts";
import { applyLedger, ensureWallet, getWallet, type LedgerType } from "../services/ledger.ts";
import { tierFor } from "../config/economy.ts";
import { DEMO_SKUS } from "../config/demo-catalog.ts";
import { newId } from "../utils/ids.ts";
import { addDays, daysAgo, isoWeekKey, nowIso } from "../utils/time.ts";
import type { MaterialCode } from "../types.ts";

const TABLES = [
  "deposit_campaigns",
  "campaign_participants",
  "deposits",
  "sessions",
  "ledger_entries",
  "redemptions",
  "payments",
  "payouts",
  "notifications",
  "referrals",
  "idempotency_keys",
  "webhook_events",
  "otp_codes",
  "refresh_tokens",
  "wallet",
  "audit_logs",
  "users",
  "rewards",
  "campaigns",
  "machine_materials",
  "machines",
  "buildings",
  "condos",
] as const;

export interface SeedSummary {
  users: number;
  machines: number;
  rewards: number;
  campaigns: number;
  sessions: number;
  deposits: number;
  ledgerEntries: number;
}

/** Deterministic PRNG so the demo dataset is stable across runs. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20261020);

function pick<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)] as T;
}

interface LedgerOp {
  at: string;
  userId: string;
  points?: number;
  credit?: number;
  withdrawable?: number;
  type: LedgerType;
  refType?: string | null;
  refId?: string | null;
  description: string;
  idempotencyKey?: string | null;
}

function insertLedgerOp(ops: LedgerOp[], op: LedgerOp): void {
  ops.push(op);
}

export function seedDatabase(options: { reset?: boolean } = {}): SeedSummary {
  const reset = options.reset !== false;
  if (reset) {
    exec("PRAGMA foreign_keys = OFF");
    withTransaction(() => {
      for (const table of TABLES) run(`DELETE FROM ${table}`);
    });
    exec("PRAGMA foreign_keys = ON");
  }

  const now = new Date();
  const nowTs = nowIso();

  // -------------------------------------------------------------------------
  // Locations
  // -------------------------------------------------------------------------
  const condoId = "cnd_aurora";
  run(
    `INSERT INTO condos (id, name, city, state, neighborhood, address, latitude, longitude, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      condoId,
      "Edifício Aurora",
      "São Paulo",
      "SP",
      "Pinheiros",
      "Rua dos Pinheiros, 1420",
      -23.5653,
      -46.6932,
      daysAgo(400),
    ],
  );

  const buildings = [
    { id: "bld_ipe", name: "Torre Ipê", address: "Rua dos Pinheiros, 1420 — Torre Ipê" },
    { id: "bld_jacaranda", name: "Torre Jacarandá", address: "Rua dos Pinheiros, 1420 — Torre Jacarandá" },
    { id: "bld_araucaria", name: "Torre Araucária", address: "Rua dos Pinheiros, 1420 — Torre Araucária" },
  ];
  for (const building of buildings) {
    run("INSERT INTO buildings (id, condo_id, name, address, created_at) VALUES (?, ?, ?, ?, ?)", [
      building.id,
      condoId,
      building.name,
      building.address,
      daysAgo(400),
    ]);
  }

  const materialsAll: MaterialCode[] = ["PET", "ALUMINUM", "GLASS", "HDPE", "PP", "PS_HIPS"];
  const machines = [
    { code: "RVM-SP-001", name: "RVM Aurora · Torre Ipê (lobby)", building: "bld_ipe", status: "online", fill: 42, distance: 45, hours: "24h", materials: materialsAll },
    { code: "RVM-SP-002", name: "RVM Aurora · Torre Ipê (garagem)", building: "bld_ipe", status: "online", fill: 67, distance: 80, hours: "24h", materials: ["PET", "ALUMINUM", "HDPE"] as MaterialCode[] },
    { code: "RVM-SP-003", name: "RVM Aurora · Torre Jacarandá (lobby)", building: "bld_jacaranda", status: "online", fill: 23, distance: 120, hours: "06:00–22:00", materials: materialsAll },
    { code: "RVM-SP-004", name: "RVM Aurora · Torre Jacarandá (lazer)", building: "bld_jacaranda", status: "full", fill: 100, distance: 160, hours: "24h", materials: materialsAll },
    { code: "RVM-SP-005", name: "RVM Aurora · Torre Araucária (lobby)", building: "bld_araucaria", status: "online", fill: 55, distance: 210, hours: "24h", materials: materialsAll },
    { code: "RVM-SP-006", name: "RVM Aurora · Torre Araucária (garagem)", building: "bld_araucaria", status: "maintenance", fill: 76, distance: 240, hours: "24h", materials: materialsAll },
    { code: "RVM-SP-007", name: "RVM Aurora · Portaria principal", building: null, status: "online", fill: 31, distance: 60, hours: "24h", materials: materialsAll },
    { code: "RVM-SP-008", name: "RVM Aurora · Praça central", building: null, status: "online", fill: 12, distance: 150, hours: "24h", materials: materialsAll },
  ];

  const machineIdByCode = new Map<string, string>();
  for (const machine of machines) {
    const id = newId("mac");
    machineIdByCode.set(machine.code, id);
    run(
      `INSERT INTO machines (id, code, name, condo_id, building_id, address, latitude, longitude,
         distance_meters, status, fill_percent, hours, api_key, last_seen_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        machine.code,
        machine.name,
        condoId,
        machine.building,
        "Rua dos Pinheiros, 1420 — Pinheiros, São Paulo",
        -23.5653 + (random() - 0.5) * 0.0008,
        -46.6932 + (random() - 0.5) * 0.0008,
        machine.distance,
        machine.status,
        machine.fill,
        machine.hours,
        `mk_live_${machine.code.toLowerCase().replace(/-/g, "_")}_5f4a9c`,
        daysAgo(1),
        daysAgo(120),
        nowTs,
      ],
    );
    for (const material of machine.materials) {
      run("INSERT INTO machine_materials (machine_id, material) VALUES (?, ?)", [id, material]);
    }
  }

  // -------------------------------------------------------------------------
  // Users
  // -------------------------------------------------------------------------
  const marinaId = "usr_marina";
  const marinaCreated = daysAgo(112);
  run(
    `INSERT INTO users (id, name, email, phone, locale, avatar_color, role, lifetime_points,
       marketing_opt_in, lgpd_consent_at, deleted_at, pseudonymize_after, pseudonymized,
       referral_code, referred_by_user_id, condo_id, building_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pt-BR', '#16A34A', 'user', 0, 1, ?, NULL, NULL, 0, 'MARINA10', NULL, ?, 'bld_ipe', ?, ?)`,
    [marinaId, "Marina Costa", "marina@example.com", "+5511999990000", marinaCreated, condoId, marinaCreated, nowTs],
  );
  ensureWallet(marinaId);

  interface Peer {
    id: string;
    name: string;
    phone: string;
    building: string;
    walletPoints: number;
    monthPoints: number;
    color: string;
  }

  const peers: Peer[] = [
    { id: "usr_peer_lucas", name: "Lucas Almeida", phone: "+5511911110001", building: "bld_araucaria", walletPoints: 3420, monthPoints: 720, color: "#0EA5E9" },
    { id: "usr_peer_beatriz", name: "Beatriz Nogueira", phone: "+5511911110002", building: "bld_jacaranda", walletPoints: 1740, monthPoints: 480, color: "#F59E0B" },
    { id: "usr_peer_rafael", name: "Rafael Souza", phone: "+5511911110003", building: "bld_araucaria", walletPoints: 1520, monthPoints: 540, color: "#8B5CF6" },
    { id: "usr_peer_camila", name: "Camila Ribeiro", phone: "+5511911110004", building: "bld_ipe", walletPoints: 1380, monthPoints: 430, color: "#EC4899" },
    { id: "usr_peer_thiago", name: "Thiago Martins", phone: "+5511911110005", building: "bld_ipe", walletPoints: 1150, monthPoints: 380, color: "#14B8A6" },
    { id: "usr_peer_isabela", name: "Isabela Castro", phone: "+5511911110006", building: "bld_araucaria", walletPoints: 890, monthPoints: 300, color: "#EF4444" },
    { id: "usr_peer_gustavo", name: "Gustavo Lima", phone: "+5511911110007", building: "bld_jacaranda", walletPoints: 640, monthPoints: 240, color: "#6366F1" },
    { id: "usr_peer_fernanda", name: "Fernanda Rocha", phone: "+5511911110008", building: "bld_ipe", walletPoints: 410, monthPoints: 160, color: "#22C55E" },
  ];

  for (const peer of peers) {
    const createdAt = daysAgo(100 + Math.floor(random() * 200));
    run(
      `INSERT INTO users (id, name, email, phone, locale, avatar_color, role, lifetime_points,
         marketing_opt_in, lgpd_consent_at, deleted_at, pseudonymize_after, pseudonymized,
         referral_code, referred_by_user_id, condo_id, building_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pt-BR', ?, 'user', ?, 1, ?, NULL, NULL, 0, ?, ?, ?, ?, ?, ?)`,
      [
        peer.id,
        peer.name,
        `${peer.name.split(" ")[0]?.toLowerCase()}@example.com`,
        peer.phone,
        peer.color,
        peer.walletPoints,
        createdAt,
        `REC${peer.id.slice(-4).toUpperCase()}`,
        peer.id === "usr_peer_fernanda" ? marinaId : null,
        condoId,
        peer.building,
        createdAt,
        nowTs,
      ],
    );
    run(
      "INSERT INTO wallet (user_id, points, credit_cents, withdrawable_cents, updated_at) VALUES (?, ?, 0, 0, ?)",
      [peer.id, peer.walletPoints, nowTs],
    );
  }

  const adminId = "usr_admin";
  run(
    `INSERT INTO users (id, name, email, phone, locale, avatar_color, role, lifetime_points,
       marketing_opt_in, lgpd_consent_at, deleted_at, pseudonymize_after, pseudonymized,
       referral_code, referred_by_user_id, condo_id, building_id, created_at, updated_at)
     VALUES (?, 'Rafael Admin', 'admin@recio.com.br', '+5511988880000', 'pt-BR', '#0F172A', 'admin',
       0, 0, ?, NULL, NULL, 0, 'ADMIN2026', NULL, NULL, NULL, ?, ?)`,
    [adminId, daysAgo(300), daysAgo(300), nowTs],
  );
  ensureWallet(adminId);

  const partnerId = "usr_partner";
  run(
    `INSERT INTO users (id, name, email, phone, locale, avatar_color, role, lifetime_points,
       marketing_opt_in, lgpd_consent_at, deleted_at, pseudonymize_after, pseudonymized,
       referral_code, referred_by_user_id, condo_id, building_id, created_at, updated_at)
     VALUES (?, 'Quiosque Aurora', 'quiosque@aurora.com.br', '+5511977770000', 'pt-BR', '#F97316',
       'partner', 0, 0, ?, NULL, NULL, 0, 'AURORA26', NULL, NULL, NULL, ?, ?)`,
    [partnerId, daysAgo(200), daysAgo(200), nowTs],
  );
  ensureWallet(partnerId);

  // -------------------------------------------------------------------------
  // Campaigns (windows are relative to seed time so the demo is always alive)
  // -------------------------------------------------------------------------
  const campaigns = [
    {
      id: "cmp_outubro",
      slug: "outubro-circular",
      title: "Outubro Circular",
      brand: "WANO",
      targetBrand: null,
      subtitle: "2x pontos em todas as garrafas PET",
      material: "PET",
      multiplier: 2,
      bonus: 0,
      startsAt: daysAgo(19),
      endsAt: addDays(12),
      imageKey: "bottle",
      accent: "#10B981",
      targetValue: 12000,
      baseline: 8400,
      targetUnit: "kg",
      scope: "national",
    },
    {
      id: "cmp_danone",
      slug: "danone-circular",
      title: "Danone Circular",
      brand: "Danone",
      targetBrand: "Danone",
      subtitle: "+50 pts em embalagens Danone",
      material: "HDPE",
      multiplier: 1,
      bonus: 50,
      startsAt: daysAgo(10),
      endsAt: addDays(20),
      imageKey: "market",
      accent: "#0EA5E9",
      targetValue: 2000,
      baseline: 1270,
      targetUnit: "items",
      scope: "national",
    },
    {
      id: "cmp_aurora",
      slug: "desafio-aurora",
      title: "Desafio Aurora",
      brand: "Edifício Aurora",
      targetBrand: null,
      subtitle: "Seu condomínio rumo a 1.200 kg",
      material: null,
      multiplier: 1,
      bonus: 0,
      startsAt: daysAgo(25),
      endsAt: addDays(15),
      imageKey: "plant",
      accent: "#F59E0B",
      targetValue: 1200,
      baseline: 760,
      targetUnit: "kg",
      scope: "condo",
    },
    {
      id: "cmp_aluminio",
      slug: "aluminio-turbo",
      title: "Alumínio Turbo",
      brand: "WANO",
      targetBrand: null,
      subtitle: "2x pontos em latas de alumínio",
      material: "ALUMINUM",
      multiplier: 2,
      bonus: 0,
      startsAt: daysAgo(2),
      endsAt: addDays(2),
      imageKey: "bike",
      accent: "#C0392B",
      targetValue: 800,
      baseline: 520,
      targetUnit: "items",
      scope: "national",
    },
    {
      id: "cmp_indique",
      slug: "indique-e-ganhe",
      title: "Indique e Ganhe",
      brand: "WANO",
      targetBrand: null,
      subtitle: "Convide amigos e dobre o bônus",
      material: null,
      multiplier: 1,
      bonus: 300,
      startsAt: daysAgo(30),
      endsAt: addDays(30),
      imageKey: "ticket",
      accent: "#8B5CF6",
      targetValue: 500,
      baseline: 210,
      targetUnit: "referrals",
      scope: "national",
    },
    {
      id: "cmp_semana",
      slug: "semana-sem-desperdicio",
      title: "Semana Sem Desperdício",
      brand: "WANO",
      targetBrand: null,
      subtitle: "1,5x pontos em vidro",
      material: "GLASS",
      multiplier: 1.5,
      bonus: 0,
      startsAt: daysAgo(13),
      endsAt: addDays(1),
      imageKey: "coffee",
      accent: "#16A085",
      targetValue: 600,
      baseline: 380,
      targetUnit: "items",
      scope: "national",
    },
  ];

  for (const campaign of campaigns) {
    run(
      `INSERT INTO campaigns (id, slug, title, brand, target_brand, subtitle, material, multiplier,
         bonus_points, starts_at, ends_at, image_key, accent, target_value, baseline_value, target_unit, scope,
         condo_id, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        campaign.id,
        campaign.slug,
        campaign.title,
        campaign.brand,
        campaign.targetBrand,
        campaign.subtitle,
        campaign.material,
        campaign.multiplier,
        campaign.bonus,
        campaign.startsAt,
        campaign.endsAt,
        campaign.imageKey,
        campaign.accent,
        campaign.targetValue,
        campaign.baseline,
        campaign.targetUnit,
        campaign.scope,
        campaign.scope === "condo" ? condoId : null,
        daysAgo(30),
        nowTs,
      ],
    );
  }

  // -------------------------------------------------------------------------
  // Rewards
  // -------------------------------------------------------------------------
  const rewards = [
    { id: "rwd_coffee", slug: "cafe-especial-padoca", title: "Café especial na Padoca", subtitle: "Café coado + pão de queijo", category: "voucher", partner: "Padoca do Bairro", points: 350, value: 1200, image: "coffee", stock: 40, isNew: 0, highlight: 1, terms: "Válido de segunda a sexta, das 7h às 17h. Um café por resgate." },
    { id: "rwd_market", slug: "mercado-25", title: "R$ 25 no mercado", subtitle: "Crédito no Mercado Bom Preço", category: "voucher", partner: "Mercado Bom Preço", points: 900, value: 2500, image: "market", stock: 25, isNew: 0, highlight: 1, terms: "Válido por 90 dias na unidade Pinheiros. Não cumulativo." },
    { id: "rwd_cinema", slug: "cinema-2-ingressos", title: "Cinema: 2 ingressos", subtitle: "Sessão 2D no Cine Jardim", category: "voucher", partner: "Cine Jardim", points: 1200, value: 4000, image: "cinema", stock: 12, isNew: 0, highlight: 0, terms: "Sujeito à disponibilidade. Não válido para estreias." },
    { id: "rwd_transit", slug: "bilhete-unico-20", title: "Bilhete Único recarga R$ 20", subtitle: "Recarga no cartão Bilhete Único", category: "voucher", partner: "SPTrans", points: 700, value: 2000, image: "transit", stock: 60, isNew: 0, highlight: 0, terms: "Recarga processada em até 48h no cartão informado." },
    { id: "rwd_gym", slug: "day-pass-academia", title: "Day pass academia", subtitle: "Um dia de treino na Smart Fit", category: "voucher", partner: "Smart Fit", points: 800, value: 2900, image: "gym", stock: 18, isNew: 0, highlight: 0, terms: "Apresente o QR na recepção. Válido em qualquer unidade." },
    { id: "rwd_ocean", slug: "doar-ong-oceano", title: "Doar 500 pts para ONG Oceano", subtitle: "Apoie a limpeza de praias", category: "donation", partner: "ONG Oceano", points: 500, value: 0, image: "donation", stock: 999, isNew: 0, highlight: 0, terms: "Doação simbólica convertida em ações de limpeza de praias." },
    { id: "rwd_ecobag", slug: "ecobag-recio", title: "Ecobag WANO", subtitle: "Sacola de algodão orgânico", category: "product", partner: "WANO Store", points: 650, value: 2500, image: "bag", stock: 30, isNew: 1, highlight: 0, terms: "Entrega em até 10 dias úteis na Grande São Paulo." },
    { id: "rwd_plant", slug: "muda-arvore-nativa", title: "Muda de árvore nativa", subtitle: "Ipê-amarelo para plantar", category: "product", partner: "Verde Urbano", points: 300, value: 900, image: "plant", stock: 50, isNew: 0, highlight: 0, terms: "Entrega com instruções de plantio. Retire ou receba em casa." },
    { id: "rwd_ticket", slug: "show-parque", title: "Ingresso show no Parque", subtitle: "Festival Circular · Parque Ibirapuera", category: "experience", partner: "Parque Ibirapuera", points: 2500, value: 8000, image: "ticket", stock: 6, isNew: 1, highlight: 1, terms: "Ingresso individual para o festival. Data sujeita a confirmação." },
    { id: "rwd_streaming", slug: "streaming-30-dias", title: "30 dias de streaming", subtitle: "Assinatura Stream+", category: "voucher", partner: "Stream+", points: 1500, value: 2990, image: "streaming", stock: 20, isNew: 0, highlight: 0, terms: "Código de ativação enviado por e-mail em até 24h." },
    { id: "rwd_bottle", slug: "kit-garrafas", title: "Kit 3 garrafas reutilizáveis", subtitle: "Aço inox 500ml", category: "product", partner: "WANO Store", points: 1100, value: 4500, image: "bottle", stock: 15, isNew: 1, highlight: 0, terms: "Produto físico. Frete grátis para sócios do RecIO." },
    { id: "rwd_book", slug: "livro-cidade-circular", title: 'Livro "Cidade Circular"', subtitle: "Ensaios sobre economia circular", category: "product", partner: "Livraria da Vila", points: 450, value: 1800, image: "bookstore", stock: 22, isNew: 0, highlight: 0, terms: "Exemplar impresso. Entrega em até 7 dias úteis." },
    { id: "rwd_icecream", slug: "sorvete-artesanal", title: "Sorvete artesanal", subtitle: "Copo 300ml na Gelateria Aurora", category: "voucher", partner: "Gelateria Aurora", points: 250, value: 800, image: "icecream", stock: 35, isNew: 0, highlight: 0, terms: "Válido de terça a domingo. Sabores sazonais." },
    { id: "rwd_bike", slug: "bike-10-viagens", title: "Bike compartilhada: 10 viagens", subtitle: "Crédito no app Bike Sampa", category: "experience", partner: "Bike Sampa", points: 1300, value: 3500, image: "bike", stock: 10, isNew: 0, highlight: 0, terms: "Viagens de até 45 minutos. Código válido por 60 dias." },
  ];

  for (const reward of rewards) {
    run(
      `INSERT INTO rewards (id, slug, title, subtitle, category, partner, points_cost, value_cents,
         image_key, stock, is_new, highlight, terms, expires_at, requires_delivery, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        reward.id,
        reward.slug,
        reward.title,
        reward.subtitle,
        reward.category,
        reward.partner,
        reward.points,
        reward.value,
        reward.image,
        reward.stock,
        reward.isNew,
        reward.highlight,
        reward.terms,
        addDays(120),
        reward.category === "product" ? 1 : 0,
        daysAgo(60),
        nowTs,
      ],
    );
  }

  // -------------------------------------------------------------------------
  // Marina: sessions + deposits (45 deposits, 12 completed sessions)
  // -------------------------------------------------------------------------
  const sessionPlan = [
    { days: 86, items: 3 },
    { days: 68, items: 2 },
    { days: 55, items: 3 },
    { days: 44, items: 4 },
    { days: 33, items: 3 },
    { days: 25, items: 3 },
    { days: 18, items: 3 },
    { days: 12, items: 4 },
    { days: 7, items: 4 },
    { days: 4, items: 5 },
    { days: 2, items: 5 },
    { days: 0, items: 4 },
  ];
  const materialPlan: MaterialCode[] = [
    "PET", "ALUMINUM", "PET", "GLASS", "PET", "HDPE", "ALUMINUM",
    "PET", "PP", "PET", "ALUMINUM", "HDPE", "PET", "GLASS",
    "PET", "PS_HIPS", "ALUMINUM", "PET", "HDPE", "PET",
    "PP", "ALUMINUM", "PET", "GLASS", "HDPE", "PET",
    "ALUMINUM", "PET", "PP", "PET", "HDPE", "PET",
    "ALUMINUM", "PET", "GLASS", "HDPE", "PET", "ALUMINUM",
    "PET", "PS_HIPS", "PET", "ALUMINUM", "HDPE", "PET",
    "PET",
  ];
  const machineCodes = ["RVM-SP-001", "RVM-SP-003", "RVM-SP-005", "RVM-SP-007", "RVM-SP-008", "RVM-SP-002"];
  const ops: LedgerOp[] = [];

  let materialIndex = 0;
  let runningLifetime = 500 + 200 + 50; // welcome + first-recycle bonuses + top-up points
  const marinaParticipation = new Map<string, { items: number; weight: number; points: number }>();
  const sessionSummaries: Array<{
    id: string;
    items: number;
    weight: number;
    points: number;
    cashback: number;
    co2: number;
    completedAt: string;
    machineName: string;
    machineCode: string;
  }> = [];
  let depositCount = 0;

  for (let s = 0; s < sessionPlan.length; s += 1) {
    const plan = sessionPlan[s] as { days: number; items: number };
    const completedAt = daysAgo(plan.days);
    const startedAt = new Date(Date.parse(completedAt) - 4 * 60_000).toISOString();
    const sessionId = `ses_seed_${String(s + 1).padStart(2, "0")}`;
    const machineCode = machineCodes[s % machineCodes.length] as string;
    const machineId = machineIdByCode.get(machineCode) as string;
    const sessionItemCount = plan.items;

    // Session row first: deposits reference it. Totals are filled in after.
    run(
      `INSERT INTO sessions (id, user_id, machine_id, status, source, token, started_at, expires_at,
         completed_at, items, weight_grams, points_earned, cashback_cents, co2_grams, receipt_json, created_at)
       VALUES (?, ?, ?, 'completed', 'qr', ?, ?, ?, ?, 0, 0, 0, 0, 0, NULL, ?)`,
      [
        sessionId,
        marinaId,
        machineId,
        `seedtok_${sessionId}`,
        startedAt,
        new Date(Date.parse(startedAt) + 10 * 60_000).toISOString(),
        completedAt,
        startedAt,
      ],
    );

    let points = 0;
    let cashback = 0;
    let weight = 0;
    let co2 = 0;

    for (let i = 0; i < sessionItemCount; i += 1) {
      const material = materialPlan[materialIndex % materialPlan.length] as MaterialCode;
      materialIndex += 1;
      const sku = pick(DEMO_SKUS.filter((item) => item.material === material));
      const weightGrams = Math.max(8, sku.weightGrams + Math.round((random() - 0.5) * 4));
      const multiplier = tierFor(runningLifetime).multiplier;
      const award = awardForDeposit({
        material,
        weightGrams,
        brand: sku.brand,
        at: completedAt,
        tierMultiplier: multiplier,
      });
      points += award.points;
      cashback += award.cashbackCents;
      weight += weightGrams;
      co2 += award.co2Grams;
      depositCount += 1;

      const depositId = `dep_seed_${String(depositCount).padStart(3, "0")}`;
      run(
        `INSERT INTO deposits (id, session_id, user_id, machine_id, gtin, material, sku_name, weight_grams,
           accepted, reject_reason, points, cashback_cents, co2_grams, batch_id, event_id, campaign_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, NULL, ?, ?)`,
        [
          depositId,
          sessionId,
          marinaId,
          machineId,
          sku.gtin,
          material,
          sku.skuName,
          weightGrams,
          award.points,
          award.cashbackCents,
          award.co2Grams,
          `LOTE-${completedAt.slice(0, 10).replace(/-/g, "")}-${machineCode}`,
          award.campaign?.id ?? null,
          new Date(Date.parse(completedAt) + i * 1500).toISOString(),
        ],
      );
      for (const campaign of award.campaigns) {
        run("INSERT INTO deposit_campaigns (deposit_id, campaign_id) VALUES (?, ?)", [
          depositId,
          campaign.id,
        ]);
        const stats = marinaParticipation.get(campaign.id) ?? { items: 0, weight: 0, points: 0 };
        stats.items += 1;
        stats.weight += weightGrams;
        stats.points += award.points;
        marinaParticipation.set(campaign.id, stats);
      }
      runningLifetime += award.points;
    }

    // Two rejected deposits across the history demonstrate anti-fraud.
    if (s === 3) {
      depositCount += 1;
      run(
        `INSERT INTO deposits (id, session_id, user_id, machine_id, gtin, material, sku_name, weight_grams,
           accepted, reject_reason, points, cashback_cents, co2_grams, batch_id, event_id, campaign_id, created_at)
         VALUES (?, ?, ?, ?, '7891000100103', 'PET', 'Água Crystal 500ml', 28, 0, 'DUPLICATE_GTIN',
           0, 0, 0, ?, NULL, NULL, ?)`,
        [
          `dep_seed_${String(depositCount).padStart(3, "0")}`,
          sessionId,
          marinaId,
          machineId,
          `LOTE-${completedAt.slice(0, 10).replace(/-/g, "")}-${machineCode}`,
          new Date(Date.parse(completedAt) + 20_000).toISOString(),
        ],
      );
    }
    if (s === 8) {
      depositCount += 1;
      run(
        `INSERT INTO deposits (id, session_id, user_id, machine_id, gtin, material, sku_name, weight_grams,
           accepted, reject_reason, points, cashback_cents, co2_grams, batch_id, event_id, campaign_id, created_at)
         VALUES (?, ?, ?, ?, '7896045500106', 'GLASS', 'Garrafa Heineken 330ml', 3200, 0, 'INVALID_WEIGHT',
           0, 0, 0, ?, NULL, NULL, ?)`,
        [
          `dep_seed_${String(depositCount).padStart(3, "0")}`,
          sessionId,
          marinaId,
          machineId,
          `LOTE-${completedAt.slice(0, 10).replace(/-/g, "")}-${machineCode}`,
          new Date(Date.parse(completedAt) + 40_000).toISOString(),
        ],
      );
    }

    const machineName = machines.find((machine) => machine.code === machineCode)?.name ?? machineCode;
    const receipt = {
      code: `REC-${completedAt.slice(2, 10).replace(/-/g, "")}-${String(4100 + s).slice(-4)}`,
      issuedAt: completedAt,
      items: sessionItemCount,
      points,
      cashbackCents: cashback,
      co2Grams: co2,
      machineName,
      machineCode,
    };
    run(
      `UPDATE sessions SET items = ?, weight_grams = ?, points_earned = ?, cashback_cents = ?,
         co2_grams = ?, receipt_json = ? WHERE id = ?`,
      [sessionItemCount, weight, points, cashback, co2, JSON.stringify(receipt), sessionId],
    );

    sessionSummaries.push({
      id: sessionId,
      items: sessionItemCount,
      weight,
      points,
      cashback,
      co2,
      completedAt,
      machineName,
      machineCode,
    });

    insertLedgerOp(ops, {
      at: completedAt,
      userId: marinaId,
      points,
      credit: cashback,
      withdrawable: cashback,
      type: "deposit",
      refType: "session",
      refId: sessionId,
      description: `Reciclagem — ${machineName}`,
      idempotencyKey: `session:${sessionId}`,
    });
  }

  // Campaign participation for Marina (aggregate per attributed campaign).
  for (const [campaignId, stats] of marinaParticipation) {
    run(
      `INSERT INTO campaign_participants (campaign_id, user_id, joined_at, items, weight_grams, points_earned)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(campaign_id, user_id) DO UPDATE SET
         items = excluded.items, weight_grams = excluded.weight_grams, points_earned = excluded.points_earned`,
      [campaignId, marinaId, daysAgo(30), stats.items, stats.weight, stats.points],
    );
  }

  // -------------------------------------------------------------------------
  // Peers' last-30-days deposits (leaderboard data)
  // -------------------------------------------------------------------------
  const peerMaterials: MaterialCode[] = ["PET", "ALUMINUM", "GLASS", "PET", "HDPE", "PET"];
  for (const peer of peers) {
    const sessionId = `ses_peer_${peer.id.slice(-6)}`;
    const machineCode = machineCodes[Math.floor(random() * machineCodes.length)] as string;
    const machineId = machineIdByCode.get(machineCode) as string;
    const completedAt = daysAgo(2 + Math.floor(random() * 24));
    const startedAt = new Date(Date.parse(completedAt) - 5 * 60_000).toISOString();
    const parts = 3;
    const base = Math.floor(peer.monthPoints / parts);
    let points = 0;
    let weight = 0;
    let co2 = 0;
    let cashback = 0;
    const depositRows: Array<{
      material: MaterialCode;
      skuName: string;
      gtin: string;
      points: number;
      weight: number;
      co2: number;
      cashback: number;
      createdAt: string;
    }> = [];
    for (let i = 0; i < parts; i += 1) {
      const material = peerMaterials[(peer.id.length + i) % peerMaterials.length] as MaterialCode;
      const sku = pick(DEMO_SKUS.filter((item) => item.material === material));
      const itemPoints = i === parts - 1 ? peer.monthPoints - base * (parts - 1) : base;
      const weightGrams = sku.weightGrams;
      const itemCo2 = Math.round(weightGrams * (material === "ALUMINUM" ? 9.1 : 1.5));
      const itemCashback = material === "ALUMINUM" ? 8 : 5;
      points += itemPoints;
      weight += weightGrams;
      co2 += itemCo2;
      cashback += itemCashback;
      depositRows.push({
        material,
        skuName: sku.skuName,
        gtin: sku.gtin,
        points: itemPoints,
        weight: weightGrams,
        co2: itemCo2,
        cashback: itemCashback,
        createdAt: new Date(Date.parse(completedAt) + i * 2000).toISOString(),
      });
    }

    run(
      `INSERT INTO sessions (id, user_id, machine_id, status, source, token, started_at, expires_at,
         completed_at, items, weight_grams, points_earned, cashback_cents, co2_grams, receipt_json, created_at)
       VALUES (?, ?, ?, 'completed', 'qr', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        sessionId,
        peer.id,
        machineId,
        `seedtok_${sessionId}`,
        startedAt,
        new Date(Date.parse(startedAt) + 10 * 60_000).toISOString(),
        completedAt,
        parts,
        weight,
        points,
        cashback,
        co2,
        startedAt,
      ],
    );

    let index = 0;
    for (const row of depositRows) {
      index += 1;
      const depositId = `dep_peer_${peer.id.slice(-6)}_${index}`;
      run(
        `INSERT INTO deposits (id, session_id, user_id, machine_id, gtin, material, sku_name, weight_grams,
           accepted, reject_reason, points, cashback_cents, co2_grams, batch_id, event_id, campaign_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, NULL, NULL, ?)`,
        [
          depositId,
          sessionId,
          peer.id,
          machineId,
          row.gtin,
          row.material,
          row.skuName,
          row.weight,
          row.points,
          row.cashback,
          row.co2,
          `LOTE-${completedAt.slice(0, 10).replace(/-/g, "")}-${machineCode}`,
          row.createdAt,
        ],
      );
      if (row.material === "PET" || row.material === "ALUMINUM") {
        run("INSERT INTO deposit_campaigns (deposit_id, campaign_id) VALUES (?, 'cmp_outubro')", [depositId]);
        run("INSERT INTO deposit_campaigns (deposit_id, campaign_id) VALUES (?, 'cmp_aurora')", [depositId]);
      } else {
        run("INSERT INTO deposit_campaigns (deposit_id, campaign_id) VALUES (?, 'cmp_aurora')", [depositId]);
      }
    }
  }
  for (const peer of peers) {
    for (const campaignId of ["cmp_aurora", "cmp_outubro"]) {
      const stats = get<{ items: number; weight: number; points: number }>(
        `SELECT COUNT(*) AS items, COALESCE(SUM(d.weight_grams), 0) AS weight,
                COALESCE(SUM(d.points), 0) AS points
         FROM deposits d JOIN deposit_campaigns dc ON dc.deposit_id = d.id
         WHERE dc.campaign_id = ? AND d.user_id = ?`,
        [campaignId, peer.id],
      );
      if (stats && stats.items > 0) {
        run(
          `INSERT INTO campaign_participants (campaign_id, user_id, joined_at, items, weight_grams, points_earned)
           VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(campaign_id, user_id) DO UPDATE SET
             items = excluded.items, weight_grams = excluded.weight_grams, points_earned = excluded.points_earned`,
          [campaignId, peer.id, daysAgo(24), stats.items, stats.weight, stats.points],
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Marina ledger history (redemptions, top-up, bonuses) + notifications
  // -------------------------------------------------------------------------
  const topUpPaymentId = "pay_seed_topup";
  run(
    `INSERT INTO payments (id, user_id, kind, pack_id, status, provider, amount_cents, credit_cents,
       bonus_points, currency, checkout_url, stripe_session_id, stripe_payment_intent_id, code,
       machine_id, metadata_json, created_at, completed_at, updated_at)
     VALUES (?, ?, 'topup', 'pack-20', 'paid', 'mock', 2000, 2000, 50, 'BRL', 'mock://checkout/pay_seed_topup',
       NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
    [topUpPaymentId, marinaId, daysAgo(89), daysAgo(89), daysAgo(89)],
  );
  insertLedgerOp(ops, {
    at: daysAgo(89),
    userId: marinaId,
    points: 50,
    credit: 2000,
    withdrawable: 0,
    type: "topup",
    refType: "payment",
    refId: topUpPaymentId,
    description: "Recarga R$ 20 — pack-20",
    idempotencyKey: "seed:topup",
  });

  insertLedgerOp(ops, {
    at: daysAgo(90),
    userId: marinaId,
    points: 500,
    type: "welcome_bonus",
    refType: "campaign",
    refId: "cmp_indique",
    description: "Bônus de boas-vindas WANO",
    idempotencyKey: "seed:welcome",
  });
  insertLedgerOp(ops, {
    at: daysAgo(86),
    userId: marinaId,
    points: 200,
    type: "campaign_bonus",
    refType: "campaign",
    refId: "cmp_outubro",
    description: "Bônus primeira reciclagem",
    idempotencyKey: "seed:first-recycle",
  });

  // Referral: Marina invited Fernanda.
  run(
    `INSERT INTO referrals (id, referrer_user_id, referred_user_id, code, status, bonus_points, created_at, applied_at)
     VALUES ('ref_seed_fernanda', ?, 'usr_peer_fernanda', 'MARINA10', 'applied', 500, ?, ?)`,
    [marinaId, daysAgo(34), daysAgo(34)],
  );
  insertLedgerOp(ops, {
    at: daysAgo(34),
    userId: marinaId,
    points: 500,
    type: "referral_bonus",
    refType: "referral",
    refId: "ref_seed_fernanda",
    description: "Indicação aceita — Fernanda Rocha",
    idempotencyKey: "seed:referral",
  });

  insertLedgerOp(ops, {
    at: daysAgo(30),
    userId: marinaId,
    points: 100,
    type: "campaign_bonus",
    refType: "campaign",
    refId: "cmp_aurora",
    description: "Bônus de aniversário WANO",
    idempotencyKey: "seed:birthday",
  });
  insertLedgerOp(ops, {
    at: daysAgo(60),
    userId: marinaId,
    points: 150,
    type: "campaign_bonus",
    refType: "campaign",
    refId: "cmp_aurora",
    description: "Top 3 do condomínio em agosto",
    idempotencyKey: "seed:top3-august",
  });
  insertLedgerOp(ops, {
    at: daysAgo(55),
    userId: marinaId,
    points: 120,
    type: "campaign_bonus",
    refType: "campaign",
    refId: "cmp_outubro",
    description: "Primeira reciclagem de setembro",
    idempotencyKey: "seed:september-first",
  });
  insertLedgerOp(ops, {
    at: daysAgo(43),
    userId: marinaId,
    points: 80,
    type: "streak_bonus",
    refType: "weekly_goal",
    refId: isoWeekKey(daysAgo(43)),
    description: "Meta semanal concluída",
    idempotencyKey: "seed:weekly-43",
  });
  insertLedgerOp(ops, {
    at: daysAgo(36),
    userId: marinaId,
    points: 80,
    type: "streak_bonus",
    refType: "weekly_goal",
    refId: isoWeekKey(daysAgo(36)),
    description: "Meta semanal concluída",
    idempotencyKey: "seed:weekly-36",
  });
  insertLedgerOp(ops, {
    at: daysAgo(28),
    userId: marinaId,
    points: 100,
    type: "referral_bonus",
    refType: "referral",
    refId: "ref_seed_fernanda",
    description: "Bônus de indicação — amiga reciclou",
    idempotencyKey: "seed:referral-extra",
  });
  insertLedgerOp(ops, {
    at: daysAgo(25),
    userId: marinaId,
    points: 600,
    type: "campaign_bonus",
    refType: "campaign",
    refId: "cmp_aurora",
    description: "Desafio Aurora — bônus de participação",
    idempotencyKey: "seed:challenge",
  });
  insertLedgerOp(ops, {
    at: daysAgo(22),
    userId: marinaId,
    points: 50,
    type: "streak_bonus",
    refType: "weekly_goal",
    refId: isoWeekKey(daysAgo(22)),
    description: "Meta semanal concluída",
    idempotencyKey: "seed:weekly-22",
  });
  insertLedgerOp(ops, {
    at: daysAgo(15),
    userId: marinaId,
    points: 50,
    type: "streak_bonus",
    refType: "weekly_goal",
    refId: isoWeekKey(daysAgo(15)),
    description: "Meta semanal concluída",
    idempotencyKey: "seed:weekly-15",
  });
  insertLedgerOp(ops, {
    at: daysAgo(8),
    userId: marinaId,
    points: 50,
    type: "streak_bonus",
    refType: "weekly_goal",
    refId: isoWeekKey(daysAgo(8)),
    description: "Meta semanal concluída",
    idempotencyKey: "seed:weekly-8",
  });
  insertLedgerOp(ops, {
    at: daysAgo(11),
    userId: marinaId,
    points: 100,
    type: "streak_bonus",
    refType: "streak",
    refId: "4-weeks",
    description: "Sequência de 4 semanas reciclando",
    idempotencyKey: "seed:streak",
  });

  // Redemptions: 2 active + 1 used.
  const redemptionPlan = [
    { id: "rdm_seed_coffee", code: "7K2M9QXP", rewardId: "rwd_coffee", points: 350, value: 1200, status: "active", days: 16, usedDays: null },
    { id: "rdm_seed_cinema", code: "3F8H5JWN", rewardId: "rwd_cinema", points: 1200, value: 4000, status: "active", days: 9, usedDays: null },
    { id: "rdm_seed_transit", code: "9B4C6DRT", rewardId: "rwd_transit", points: 700, value: 2000, status: "used", days: 20, usedDays: 18 },
  ];
  for (const item of redemptionPlan) {
    const createdAt = daysAgo(item.days);
    run(
      `INSERT INTO redemptions (id, code, user_id, reward_id, quantity, points_spent, value_cents, status,
         qr_payload, delivery_json, expires_at, created_at, used_at, fulfilled_at)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, NULL, ?, ?, ?, NULL)`,
      [
        item.id,
        item.code,
        marinaId,
        item.rewardId,
        item.points,
        item.value,
        item.status,
        `recio://redeem/${item.code}`,
        addDays(item.days + 90),
        createdAt,
        item.usedDays ? daysAgo(item.usedDays) : null,
      ],
    );
    insertLedgerOp(ops, {
      at: createdAt,
      userId: marinaId,
      points: -item.points,
      type: "redeem",
      refType: "redemption",
      refId: item.id,
      description: `Resgate — ${rewards.find((reward) => reward.id === item.rewardId)?.title ?? item.rewardId}`,
      idempotencyKey: `redeem:${item.id}`,
    });
  }

  const miniMarketPaymentId = "pay_seed_mini";
  run(
    `INSERT INTO payments (id, user_id, kind, pack_id, status, provider, amount_cents, credit_cents,
       bonus_points, currency, checkout_url, stripe_session_id, stripe_payment_intent_id, code,
       machine_id, metadata_json, created_at, completed_at, updated_at)
     VALUES (?, ?, 'mini_market', NULL, 'paid', 'mock', 850, 850, 0, 'BRL', NULL, NULL, NULL, '482913',
       ?, ?, ?, ?, ?)`,
    [
      miniMarketPaymentId,
      marinaId,
      machineIdByCode.get("RVM-SP-001") ?? null,
      JSON.stringify({ partner: "Quiosque Aurora", machineCode: "RVM-SP-001" }),
      daysAgo(3),
      daysAgo(3),
      daysAgo(3),
    ],
  );
  insertLedgerOp(ops, {
    at: daysAgo(3),
    userId: marinaId,
    credit: -850,
    withdrawable: -850,
    type: "mini_market",
    refType: "payment",
    refId: miniMarketPaymentId,
    description: "Mini-market — Quiosque Aurora",
    idempotencyKey: "seed:mini-market",
  });

  // -------------------------------------------------------------------------
  // Apply ledger in chronological order (keeps balance snapshots coherent)
  // -------------------------------------------------------------------------
  const targetPoints = 1860;
  const targetCredit = 4270;
  const spentPoints = 2250;
  const topUpCredit = 2000;
  const neededLifetime = targetPoints + spentPoints;

  ops.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const positivePoints = ops.reduce((total, op) => total + Math.max(0, op.points ?? 0), 0);
  const positiveCredit = ops.reduce((total, op) => total + (op.credit ?? 0), 0);

  // The demo wallet is produced by a campaign bonus large enough to hit the
  // exact target balances; placed mid-history so balances never go negative.
  const pointsBonus = neededLifetime - positivePoints;
  if (pointsBonus < 0) {
    throw new Error(
      `seed: positive points ${positivePoints} already exceed lifetime target ${neededLifetime}`,
    );
  }
  if (pointsBonus > 0) {
    ops.push({
      at: daysAgo(10),
      userId: marinaId,
      points: pointsBonus,
      type: "campaign_bonus",
      refType: "campaign",
      refId: "cmp_outubro",
      description: "Bônus de campanha Outubro Circular",
      idempotencyKey: "seed:promo-points",
    });
  }

  const promoCredit = targetCredit - positiveCredit;
  if (promoCredit < 0) {
    throw new Error(`seed: credit exceeds target by ${Math.abs(promoCredit)} cents`);
  }
  if (promoCredit > 0) {
    ops.push({
      at: daysAgo(9),
      userId: marinaId,
      credit: promoCredit,
      withdrawable: promoCredit,
      type: "campaign_bonus",
      refType: "campaign",
      refId: "cmp_outubro",
      description: "Cashback bônus de lançamento WANO",
      idempotencyKey: "seed:promo-cashback",
    });
  }

  ops.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  for (const op of ops) {
    applyLedger({
      userId: op.userId,
      pointsDelta: op.points ?? 0,
      creditDeltaCents: op.credit ?? 0,
      withdrawableDeltaCents: op.withdrawable ?? 0,
      type: op.type,
      refType: op.refType ?? null,
      refId: op.refId ?? null,
      description: op.description,
      idempotencyKey: op.idempotencyKey ?? null,
      createdAt: op.at,
    });
  }

  const finalWallet = getWallet(marinaId);
  if (finalWallet.points !== targetPoints) {
    throw new Error(`seed: points target mismatch: ${finalWallet.points} != ${targetPoints}`);
  }
  if (finalWallet.creditCents !== targetCredit) {
    throw new Error(`seed: credit target mismatch: ${finalWallet.creditCents} != ${targetCredit}`);
  }
  if (finalWallet.withdrawableCents !== targetCredit - topUpCredit) {
    throw new Error(
      `seed: withdrawable target mismatch: ${finalWallet.withdrawableCents} != ${targetCredit - topUpCredit}`,
    );
  }

  // -------------------------------------------------------------------------
  // Notifications (6 items, 2 unread)
  // -------------------------------------------------------------------------
  const notifications = [
    { days: 0.2, type: "campaign", title: "Outubro Circular começou", body: "Garrafas PET valem 2x pontos até o fim do mês.", icon: "bottle", deepLink: "recio://campaigns/cmp_outubro", read: false },
    { days: 0.6, type: "redemption_created", title: "Resgate confirmado", body: "Café especial na Padoca — use o código 7K2M9QXP.", icon: "gift", deepLink: "recio://redemptions/rdm_seed_coffee", read: false },
    { days: 3, type: "mini_market_paid", title: "Compra no mini-market", body: "R$ 8,50 debitados no Quiosque Aurora.", icon: "store", deepLink: "recio://wallet", read: true },
    { days: 6, type: "session_completed", title: "Reciclagem concluída", body: "Você reciclou 5 itens e ganhou 74 pontos + R$ 0,31 de cashback.", icon: "recycle", deepLink: "recio://wallet", read: true },
    { days: 9, type: "campaign", title: "Desafio Aurora: você está no top 3", body: "Faltam 120 kg para o condomínio bater a meta.", icon: "trophy", deepLink: "recio://campaigns/cmp_aurora", read: true },
    { days: 12, type: "referral_friend", title: "Seu convite funcionou!", body: "Fernanda Rocha entrou com o código MARINA10. +500 pontos.", icon: "users", deepLink: "recio://referral", read: true },
  ];
  for (const item of notifications) {
    run(
      `INSERT INTO notifications (id, user_id, type, title, body, icon, deep_link, read_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId("ntf"),
        marinaId,
        item.type,
        item.title,
        item.body,
        item.icon,
        item.deepLink,
        item.read ? addDays(-item.days + 0.1) : null,
        addDays(-item.days),
      ],
    );
  }

  // Update Marina's lifetime to the ledger sum (single source of truth).
  const lifetime = get<{ total: number }>(
    "SELECT COALESCE(SUM(points_delta), 0) AS total FROM ledger_entries WHERE user_id = ? AND points_delta > 0",
    [marinaId],
  );
  run("UPDATE users SET lifetime_points = ?, updated_at = ? WHERE id = ?", [
    lifetime?.total ?? 0,
    nowTs,
    marinaId,
  ]);

  const summary: SeedSummary = {
    users: get<{ total: number }>("SELECT COUNT(*) AS total FROM users")?.total ?? 0,
    machines: get<{ total: number }>("SELECT COUNT(*) AS total FROM machines")?.total ?? 0,
    rewards: get<{ total: number }>("SELECT COUNT(*) AS total FROM rewards")?.total ?? 0,
    campaigns: get<{ total: number }>("SELECT COUNT(*) AS total FROM campaigns")?.total ?? 0,
    sessions: get<{ total: number }>("SELECT COUNT(*) AS total FROM sessions")?.total ?? 0,
    deposits: get<{ total: number }>("SELECT COUNT(*) AS total FROM deposits")?.total ?? 0,
    ledgerEntries: get<{ total: number }>("SELECT COUNT(*) AS total FROM ledger_entries")?.total ?? 0,
  };
  return summary;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const isMain =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  initDb();
  const summary = seedDatabase();
  // eslint-disable-next-line no-console
  console.log("WANO Rewards seed complete:", summary);
  console.log("Demo user: +5511999990000 (code 123456) · Admin: +5511988880000 · Partner: +5511977770000");
  closeDb();
}

