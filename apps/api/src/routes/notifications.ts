import { Router } from "express";
import { markAllNotificationsRead, markNotificationRead, listNotifications } from "../services/notifications.ts";
import { authUser } from "./helpers.ts";

const router = Router();

router.get("/", (req, res) => {
  const user = authUser(req);
  res.json(listNotifications(user.id, 50));
});

router.post("/read-all", (req, res) => {
  const user = authUser(req);
  const updated = markAllNotificationsRead(user.id);
  res.json({ updated, unread: 0 });
});

router.post("/:id/read", (req, res) => {
  const user = authUser(req);
  res.json({ notification: markNotificationRead(user.id, req.params.id as string) });
});

export default router;
