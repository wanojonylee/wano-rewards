/** Audit trail for privileged mutations (LGPD + admin). */
import { run } from "../db/index.ts";
import { newId } from "../utils/ids.ts";
import { nowIso } from "../utils/time.ts";

export interface AuditInput {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}

export function writeAudit(input: AuditInput): void {
  run(
    `INSERT INTO audit_logs (id, actor_id, action, entity, entity_id, before_json, after_json, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId("aud"),
      input.actorId,
      input.action,
      input.entity,
      input.entityId ?? null,
      input.before === undefined || input.before === null ? null : JSON.stringify(input.before),
      input.after === undefined || input.after === null ? null : JSON.stringify(input.after),
      input.ip ?? null,
      nowIso(),
    ],
  );
}
