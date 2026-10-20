/** Machines (RVM) lookup and box-level operations. */
import { all, get, run } from "../db/index.ts";
import { ApiError } from "../errors.ts";
import { distanceMeters } from "../utils/geo.ts";
import { nowIso } from "../utils/time.ts";
import type { MachineRow, MachineStatus, MaterialCode } from "../types.ts";

export interface MachineView {
  id: string;
  code: string;
  name: string;
  address: string;
  distanceMeters: number;
  status: MachineStatus;
  materials: MaterialCode[];
  fillPercent: number;
  hours: string;
}

export interface MachineDetailView extends MachineView {
  latitude: number;
  longitude: number;
  lastSeenAt: string | null;
}

function materialsFor(machineId: string): MaterialCode[] {
  return all<{ material: MaterialCode }>(
    "SELECT material FROM machine_materials WHERE machine_id = ? ORDER BY material",
    [machineId],
  ).map((row) => row.material);
}

export function machineView(row: MachineRow): MachineView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    address: row.address,
    distanceMeters: row.distance_meters,
    status: row.status,
    materials: materialsFor(row.id),
    fillPercent: row.fill_percent,
    hours: row.hours,
  };
}

export function machineDetail(row: MachineRow): MachineDetailView {
  return {
    ...machineView(row),
    latitude: row.latitude,
    longitude: row.longitude,
    lastSeenAt: row.last_seen_at,
  };
}

export function findMachineByCode(code: string): MachineRow | undefined {
  return get<MachineRow>("SELECT * FROM machines WHERE code = ? COLLATE NOCASE", [code]);
}

export function requireMachineByCode(code: string): MachineRow {
  const machine = findMachineByCode(code);
  if (!machine) throw ApiError.notFound("Máquina não encontrada");
  return machine;
}

export function findMachineByApiKey(apiKey: string): MachineRow | undefined {
  return get<MachineRow>("SELECT * FROM machines WHERE api_key = ?", [apiKey]);
}

export interface ListMachinesOptions {
  lat?: number | null;
  lng?: number | null;
  condoId?: string | null;
}

export function listMachines(options: ListMachinesOptions = {}): MachineView[] {
  const rows = options.condoId
    ? all<MachineRow>("SELECT * FROM machines WHERE condo_id = ?", [options.condoId])
    : all<MachineRow>("SELECT * FROM machines ORDER BY distance_meters ASC");

  return rows
    .map((row) => {
      const view = machineView(row);
      if (options.lat != null && options.lng != null) {
        return {
          ...view,
          distanceMeters: distanceMeters(
            { lat: options.lat, lng: options.lng },
            { lat: row.latitude, lng: row.longitude },
          ),
        };
      }
      return view;
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

export function assertMachineReady(machine: MachineRow): void {
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
}

/** Updates fill level and derives status (full / online). */
export function updateBoxLevel(code: string, fillPercent: number): MachineRow {
  const machine = requireMachineByCode(code);
  const bounded = Math.max(0, Math.min(100, Math.round(fillPercent)));
  const status: MachineStatus =
    machine.status === "maintenance" ? "maintenance" : bounded >= 100 ? "full" : "online";
  run("UPDATE machines SET fill_percent = ?, status = ?, updated_at = ? WHERE id = ?", [
    bounded,
    status,
    nowIso(),
    machine.id,
  ]);
  return { ...machine, fill_percent: bounded, status };
}

/** Increments fill based on accepted items (roughly 0.4% per item). */
export function bumpFill(machineId: string, items: number): void {
  if (items <= 0) return;
  const machine = get<MachineRow>("SELECT * FROM machines WHERE id = ?", [machineId]);
  if (!machine) return;
  const next = Math.min(100, machine.fill_percent + Math.ceil(items * 0.4));
  const status: MachineStatus =
    machine.status === "maintenance" ? "maintenance" : next >= 100 ? "full" : "online";
  run("UPDATE machines SET fill_percent = ?, status = ?, last_seen_at = ?, updated_at = ? WHERE id = ?", [
    next,
    status,
    nowIso(),
    nowIso(),
    machineId,
  ]);
}

export function touchMachine(machineId: string): void {
  run("UPDATE machines SET last_seen_at = ? WHERE id = ?", [nowIso(), machineId]);
}
