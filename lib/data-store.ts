import { createClient, type Client, type InValue, type Row } from "@libsql/client";

export type StoredOfficial = { id: string; profileId?: string; name: string; city: string; county: string; role: "Arbitru" | "Asistent"; league: string };
export type StoredDelegate = { name: string; role: string; county: string };
export type StoredMatch = {
  id: string; date: string; competition: string; round: string; home: string; away: string; stadium: string;
  city: string; county: string; countyCode?: string; status: string; score?: string | null; delegates: StoredDelegate[];
};
export type StoredNotice = { id: string; title: string; date: string; url: string; attachment?: string };

let client: Client | null | undefined;
function database() {
  if (client !== undefined) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return client = null;
  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return client;
}
function chunks<T>(items: T[], size = 80) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}
function value(row: Row, key: string) { const result = row[key]; return result == null ? "" : String(result); }

export async function readSync(scope: string) {
  const db = database();
  if (!db) return null;
  const result = await db.execute({ sql: "SELECT synced_at, status, message FROM sync_state WHERE scope = ?", args: [scope] });
  const row = result.rows[0];
  return row ? { syncedAt: value(row, "synced_at"), status: value(row, "status"), message: value(row, "message") } : null;
}
export async function writeSync(scope: string, status: string, message = "") {
  const db = database();
  if (!db) return;
  await db.execute({ sql: `INSERT INTO sync_state (scope, synced_at, status, message) VALUES (?, ?, ?, ?)
    ON CONFLICT(scope) DO UPDATE SET synced_at=excluded.synced_at, status=excluded.status, message=excluded.message`,
    args: [scope, new Date().toISOString(), status, message] });
}
export async function claimSyncJob(maxAge = 10 * 60_000) {
  const db = database();
  if (!db) return false;
  const now = new Date();
  const staleBefore = new Date(now.getTime() - maxAge).toISOString();
  const result = await db.execute({
    sql: `INSERT INTO sync_state (scope, synced_at, status, message) VALUES ('job', ?, 'running', '')
      ON CONFLICT(scope) DO UPDATE SET synced_at=excluded.synced_at, status='running', message=''
      WHERE sync_state.synced_at < ? OR sync_state.status = 'error'`,
    args: [now.toISOString(), staleBefore],
  });
  return result.rowsAffected > 0;
}
export async function readOfficials() {
  const db = database();
  if (!db) return [];
  const result = await db.execute("SELECT id, profile_id, name, city, county, role, league FROM officials ORDER BY name COLLATE NOCASE");
  return result.rows.map((row): StoredOfficial => ({ id: value(row, "id"), profileId: value(row, "profile_id") || undefined,
    name: value(row, "name"), city: value(row, "city"), county: value(row, "county"), role: value(row, "role") as StoredOfficial["role"], league: value(row, "league") }));
}
export async function replaceOfficials(items: StoredOfficial[]) {
  const db = database();
  if (!db || !items.length) return;
  const updatedAt = new Date().toISOString();
  await db.execute("DELETE FROM officials");
  for (const group of chunks(items)) await db.batch(group.map((item) => ({
    sql: "INSERT INTO officials (id, profile_id, name, city, county, role, league, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    args: [item.id, item.profileId || null, item.name, item.city, item.county, item.role, item.league, updatedAt] as InValue[],
  })), "write");
}
export async function readNotices() {
  const db = database();
  if (!db) return [];
  const result = await db.execute("SELECT id, title, date, url, attachment FROM notices ORDER BY updated_at DESC, date DESC");
  return result.rows.map((row): StoredNotice => ({ id: value(row, "id"), title: value(row, "title"), date: value(row, "date"), url: value(row, "url"), attachment: value(row, "attachment") || undefined }));
}
export async function replaceNotices(items: StoredNotice[]) {
  const db = database();
  if (!db || !items.length) return;
  const updatedAt = new Date().toISOString();
  await db.execute("DELETE FROM notices");
  await db.batch(items.map((item) => ({ sql: "INSERT INTO notices (id, title, date, url, attachment, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    args: [item.id, item.title, item.date, item.url, item.attachment || null, updatedAt] as InValue[] })), "write");
}
export async function readMatches() {
  const db = database();
  if (!db) return [];
  const result = await db.execute(`SELECT id, date, competition, round, home, away, stadium, city, county,
    county_code, status, score, delegates_json FROM matches ORDER BY date DESC`);
  return result.rows.map((row): StoredMatch => ({ id: value(row, "id"), date: value(row, "date"), competition: value(row, "competition"),
    round: value(row, "round"), home: value(row, "home"), away: value(row, "away"), stadium: value(row, "stadium"), city: value(row, "city"),
    county: value(row, "county"), countyCode: value(row, "county_code"), status: value(row, "status"), score: value(row, "score") || null,
    delegates: JSON.parse(value(row, "delegates_json") || "[]") as StoredDelegate[] }));
}
export async function upsertMatches(items: StoredMatch[]) {
  const db = database();
  if (!db || !items.length) return;
  const updatedAt = new Date().toISOString();
  for (const group of chunks(items)) await db.batch(group.map((item) => ({ sql: `INSERT INTO matches
    (id, date, competition, round, home, away, stadium, city, county, county_code, status, score, delegates_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET date=excluded.date, competition=excluded.competition, round=excluded.round,
    home=excluded.home, away=excluded.away, stadium=excluded.stadium, city=excluded.city, county=excluded.county,
    county_code=excluded.county_code, status=excluded.status, score=excluded.score, delegates_json=excluded.delegates_json, updated_at=excluded.updated_at`,
    args: [item.id, item.date, item.competition, item.round, item.home, item.away, item.stadium, item.city, item.county,
      item.countyCode || "", item.status, item.score || null, JSON.stringify(item.delegates), updatedAt] as InValue[] })), "write");
}
export async function readProfile(profileId: string) {
  const db = database();
  if (!db) return null;
  const result = await db.execute({ sql: "SELECT payload_json, updated_at FROM profiles WHERE profile_id = ?", args: [profileId] });
  const row = result.rows[0];
  return row ? { payload: JSON.parse(value(row, "payload_json")) as Record<string, unknown>, updatedAt: value(row, "updated_at") } : null;
}
export async function writeProfile(profileId: string, payload: Record<string, unknown>) {
  const db = database();
  if (!db) return;
  await db.execute({ sql: `INSERT INTO profiles (profile_id, payload_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(profile_id) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at`,
    args: [profileId, JSON.stringify(payload), new Date().toISOString()] });
}
export function isFresh(date: string | undefined | null, maxAge = 10 * 60_000) { return Boolean(date && Date.now() - new Date(date).getTime() < maxAge); }
