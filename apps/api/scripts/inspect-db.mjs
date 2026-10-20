/** Dev utility: prints a compact summary of the SQLite database. */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file = process.argv[2] ?? path.join(root, "data", "recio.db");
const db = new DatabaseSync(file);
const all = (sql, ...params) => db.prepare(sql).all(...params);

console.log("db:", file);
console.log("wallet Marina:", all("SELECT points, credit_cents, withdrawable_cents FROM wallet WHERE user_id = 'usr_marina'"));
console.log("user Marina:", all("SELECT name, lifetime_points, referral_code FROM users WHERE id = 'usr_marina'"));
console.log("counts:", all(`SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM machines) AS machines,
  (SELECT COUNT(*) FROM rewards) AS rewards,
  (SELECT COUNT(*) FROM campaigns) AS campaigns,
  (SELECT COUNT(*) FROM sessions WHERE user_id = 'usr_marina') AS marina_sessions,
  (SELECT COUNT(*) FROM deposits WHERE user_id = 'usr_marina') AS marina_deposits,
  (SELECT COUNT(*) FROM ledger_entries WHERE user_id = 'usr_marina') AS marina_ledger`));
console.log("deposits:", all("SELECT accepted, COUNT(*) AS n, SUM(points) AS points, SUM(cashback_cents) AS cashback FROM deposits WHERE user_id = 'usr_marina' GROUP BY accepted"));
console.log("redemptions:", all("SELECT code, status, points_spent FROM redemptions WHERE user_id = 'usr_marina'"));
console.log("notifications:", all("SELECT COUNT(*) AS total, SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unread FROM notifications WHERE user_id = 'usr_marina'"));
console.log("ledger span:", all("SELECT COUNT(*) AS n, MIN(created_at) AS first, MAX(created_at) AS last FROM ledger_entries WHERE user_id = 'usr_marina'"));
console.log("campaigns:", all("SELECT slug, multiplier, bonus_points, target_unit, scope FROM campaigns"));
console.log("participation:", all("SELECT campaign_id, items, weight_grams, points_earned FROM campaign_participants WHERE user_id = 'usr_marina'"));
console.log("30d points:", all(`SELECT u.name, SUM(d.points) AS points FROM deposits d JOIN users u ON u.id = d.user_id
  WHERE d.created_at >= ? GROUP BY u.id ORDER BY points DESC`, new Date(Date.now() - 30 * 86400000).toISOString()));
db.close();
