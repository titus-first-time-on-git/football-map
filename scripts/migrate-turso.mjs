import { readFile } from "node:fs/promises";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("TURSO_DATABASE_URL lipsește.");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const migration = await readFile(new URL("../drizzle/0000_brown_human_fly.sql", import.meta.url), "utf8");
const statements = migration.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
for (const sql of statements) await client.execute(sql);
console.log(`Schema Turso aplicată: ${statements.length} instrucțiuni.`);
client.close();
