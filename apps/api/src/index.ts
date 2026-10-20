/** API entrypoint: boot DB, optional seed, listen, graceful shutdown. */
import { createServer } from "node:http";
import { createApp } from "./app.ts";
import { env } from "./env.ts";
import { logger } from "./logger.ts";
import { closeDb, countRows, initDb } from "./db/index.ts";
import { pseudonymizeDueUsers } from "./services/lgpd.ts";
import { seedDatabase } from "./seed/seed.ts";

function bootstrap(): void {
  const db = initDb();
  logger.info("database ready", { path: env.dbPath, journal: "WAL", foreignKeys: true });

  if (env.autoSeed && countRows("users") === 0) {
    const summary = seedDatabase({ reset: true });
    logger.info("demo seed applied", { ...summary });
  }
  const pseudonymized = pseudonymizeDueUsers();
  if (pseudonymized > 0) logger.info("lgpd pseudonymization applied", { users: pseudonymized });

  void db;
  const app = createApp();
  const server = createServer(app);

  server.listen(env.port, env.host, () => {
    logger.info("RecIO API listening", {
      url: `http://localhost:${env.port}${env.apiPrefix}`,
      mode: env.mode,
      stripe: env.stripeSecretKey ? "test" : "unconfigured",
      node: process.version,
      version: env.version,
    });
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("graceful shutdown", { signal });
    const timer = setTimeout(() => {
      logger.warn("forcing shutdown after timeout");
      try {
        closeDb();
      } finally {
        process.exit(1);
      }
    }, 10_000);
    timer.unref();
    server.close(() => {
      clearTimeout(timer);
      closeDb();
      logger.info("shutdown complete");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.error("unhandled rejection", { error: reason instanceof Error ? reason : new Error(String(reason)) });
  });
  process.on("uncaughtException", (error) => {
    logger.error("uncaught exception", { error });
    shutdown("uncaughtException");
  });
}

try {
  bootstrap();
} catch (error) {
  logger.error("failed to start API", { error: error instanceof Error ? error : new Error(String(error)) });
  process.exit(1);
}
