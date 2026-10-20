import { Router } from "express";
import authRouter from "./auth.ts";
import meRouter from "./me.ts";
import homeRouter from "./home.ts";
import impactRouter from "./impact.ts";
import walletRouter from "./wallet.ts";
import sessionsRouter from "./sessions.ts";
import rewardsRouter from "./rewards.ts";
import campaignsRouter from "./campaigns.ts";
import paymentsRouter from "./payments.ts";
import notificationsRouter from "./notifications.ts";
import referralsRouter from "./referrals.ts";
import machinesRouter from "./machines.ts";
import configRouter from "./config.ts";
import healthRouter from "./health.ts";
import adminRouter from "./admin.ts";
import ingestRouter from "./ingest.ts";
import { authenticate } from "../middleware/auth.ts";

const router = Router();

// --- Public ---------------------------------------------------------------
router.use(healthRouter);
router.use(configRouter);
router.use("/auth", authRouter);
router.use(machinesRouter); // read-only machine discovery
router.use(ingestRouter); // machine-to-server, authenticated by X-Machine-Key

// --- Authenticated (single JWT gate) -------------------------------------
const protectedRouter = Router();
protectedRouter.use(authenticate);
protectedRouter.use("/me", meRouter);
protectedRouter.use("/home", homeRouter);
protectedRouter.use("/impact", impactRouter);
protectedRouter.use("/wallet", walletRouter);
protectedRouter.use(sessionsRouter);
protectedRouter.use(rewardsRouter);
protectedRouter.use(campaignsRouter);
protectedRouter.use(paymentsRouter);
protectedRouter.use("/notifications", notificationsRouter);
protectedRouter.use("/referral", referralsRouter);
protectedRouter.use("/admin", adminRouter);

router.use(protectedRouter);

export default router;
