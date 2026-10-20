/** Tiny zero-dependency structured logger. */
import { env } from "./env.ts";

type Level = "debug" | "info" | "warn" | "error";

const RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const COLORS: Record<Level, string> = {
  debug: "\u001b[90m",
  info: "\u001b[36m",
  warn: "\u001b[33m",
  error: "\u001b[31m",
};
const RESET = "\u001b[0m";

const threshold = RANK[(env.logLevel as Level) in RANK ? (env.logLevel as Level) : "info"];

function serialize(meta: Record<string, unknown> | undefined): string {
  if (!meta) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue;
    let rendered: string;
    if (value instanceof Error) rendered = `${value.name}: ${value.message}`;
    else if (typeof value === "string") rendered = value;
    else rendered = JSON.stringify(value);
    parts.push(`${key}=${rendered}`);
  }
  return parts.join(" ");
}

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (RANK[level] < threshold) return;
  const time = new Date().toISOString();
  if (env.jsonLogs) {
    const line = JSON.stringify({ time, level, message, ...(meta ?? {}) });
    (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
    return;
  }
  const suffix = serialize(meta);
  const prefix = `${COLORS[level]}${level.toUpperCase().padEnd(5)}${RESET}`;
  (level === "error" ? process.stderr : process.stdout).write(
    `${time} ${prefix} ${message}${suffix ? ` ${suffix}` : ""}\n`,
  );
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};

export type Logger = typeof logger;
