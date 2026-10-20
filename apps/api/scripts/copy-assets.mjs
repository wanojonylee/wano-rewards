/** Copies non-TS assets (SQL schema) into dist after `tsc`. */
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
mkdirSync(join(root, "dist", "db"), { recursive: true });
cpSync(join(root, "src", "db", "schema.sql"), join(root, "dist", "db", "schema.sql"));
console.log("copied src/db/schema.sql -> dist/db/schema.sql");
