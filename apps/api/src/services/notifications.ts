/** In-app notifications. */
import { all, get, run } from "../db/index.ts";
import { newId } from "../utils/ids.ts";
import { nowIso } from "../utils/time.ts";
import type { NotificationRow } from "../types.ts";

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  icon: string | null;
  deepLink: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  icon?: string | null;
  deepLink?: string | null;
  createdAt?: string;
}

export function notificationView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    icon: row.icon,
    deepLink: row.deep_link,
    read: Boolean(row.read_at),
    createdAt: row.created_at,
  };
}

export function notify(input: NotifyInput): NotificationRow {
  const row: NotificationRow = {
    id: newId("ntf"),
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    icon: input.icon ?? "sparkles",
    deep_link: input.deepLink ?? null,
    read_at: null,
    created_at: input.createdAt ?? nowIso(),
  };
  run(
    `INSERT INTO notifications (id, user_id, type, title, body, icon, deep_link, read_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [row.id, row.user_id, row.type, row.title, row.body, row.icon, row.deep_link, row.created_at],
  );
  return row;
}

export function listNotifications(userId: string, limit = 30): { items: NotificationView[]; unread: number } {
  const rows = all<NotificationRow>(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    [userId, limit],
  );
  return { items: rows.map(notificationView), unread: unreadCount(userId) };
}

export function unreadCount(userId: string): number {
  return (
    get<{ total: number }>(
      "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL",
      [userId],
    )?.total ?? 0
  );
}

export function markNotificationRead(userId: string, notificationId: string): NotificationView {
  run("UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?", [
    nowIso(),
    notificationId,
    userId,
  ]);
  const row = get<NotificationRow>("SELECT * FROM notifications WHERE id = ? AND user_id = ?", [
    notificationId,
    userId,
  ]);
  if (!row) {
    return {
      id: notificationId,
      type: "unknown",
      title: "",
      body: "",
      icon: null,
      deepLink: null,
      read: true,
      createdAt: nowIso(),
    };
  }
  return notificationView(row);
}

export function markAllNotificationsRead(userId: string): number {
  const result = run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", [
    nowIso(),
    userId,
  ]);
  return result.changes;
}
