import { Router } from "express";
import { z } from "zod";
import { get } from "../db/index.ts";
import { parseCoord } from "../utils/geo.ts";
import { listMachines, machineDetail, requireMachineByCode } from "../services/machines.ts";

const router = Router();

const listQuery = z.object({
  lat: z.string().optional(),
  lng: z.string().optional(),
});

router.get("/machines", (req, res) => {
  const query = listQuery.parse(req.query);
  const lat = parseCoord(query.lat);
  const lng = parseCoord(query.lng);
  res.json({
    items: listMachines({
      ...(lat != null ? { lat } : {}),
      ...(lng != null ? { lng } : {}),
    }),
  });
});

router.get("/machines/:code", (req, res) => {
  const machine = requireMachineByCode(req.params.code as string);
  const impact = get<{ items: number; grams: number; co2: number; points: number }>(
    `SELECT COUNT(*) AS items,
            COALESCE(SUM(weight_grams), 0) AS grams,
            COALESCE(SUM(co2_grams), 0) AS co2,
            COALESCE(SUM(points), 0) AS points
     FROM deposits
     WHERE machine_id = ? AND accepted = 1 AND created_at >= ?`,
    [machine.id, new Date(Date.now() - 30 * 86_400_000).toISOString()],
  );
  res.json({
    machine: machineDetail(machine),
    recentImpact: {
      items: impact?.items ?? 0,
      kg: Math.round(((impact?.grams ?? 0) / 1000) * 100) / 100,
      co2Kg: Math.round(((impact?.co2 ?? 0) / 1000) * 100) / 100,
      points: impact?.points ?? 0,
      periodDays: 30,
    },
  });
});

export default router;
