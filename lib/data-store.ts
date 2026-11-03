import { env } from "cloudflare:workers";

export type StoredOfficial = {
  id: string;
  profileId?: string;
  name: string;
  city: string;
  county: string;
  role: "Arbitru" | "Asistent";
  league: string;
};

export type StoredDelegate = { name: string; role: string; county: string };

export type StoredMatch = {
  id: string;
  date: string;
  competition: string;
  round: string;
  home: string;
  away: string;
  stadium: string;
  city: string;
  county: string;
  countyCode?: string;
  status: string;
  score?: string | null;
  delegates: StoredDelegate[];
};

export type StoredNotice = { id: string; title: string; date: string; url: string; attachment?: string };

function database() {
  return env.DB || null;
}

function chunks<T>(items: T[], size = 80) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

export async function readSync(scope: string) {
  const db = database();
  if (!db) return null;
  return db.prepare("SELECT synced_at AS syncedAt, status, message FROM sync_state WHERE scope = ?")
    .bind(scope).first<{ syncedAt: string; status: string; message: string }>();
}

export async function writeSync(scope: string, status: string, message = "") {
  const db = database();
  if (!db) return;
  await db.prepare(`INSERT INTO sync_state (scope, synced_at, status, message) VALUES (?, ?, ?, ?)
    ON CONFLICT(scope) DO UPDATE SET synced_at = excluded.synced_at, status = excluded.status, message = excluded.message`)
    .bind(scope, new Date().toISOString(), status, message).run();
}

export async function readOfficials() {
  const db = database();
  if (!db) return [];
  const result = await db.prepare(`SELECT id, profile_id AS profileId, name, city, county, role, league
    FROM officials ORDER BY name COLLATE NOCASE`).all<StoredOfficial>();
  return result.results || [];
}

export async function replaceOfficials(items: StoredOfficial[]) {
  const db = database();
  if (!db || !items.length) return;
  const updatedAt = new Date().toISOString();
  await db.prepare("DELETE FROM officials").run();
  for (const group of chunks(items)) {
    await db.batch(group.map((item) => db.prepare(`INSERT INTO officials
      (id, profile_id, name, city, county, role, league, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(item.id, item.profileId || null, item.name, item.city, item.county, item.role, item.league, updatedAt)));
  }
}

export async function readNotices() {
  const db = database();
  if (!db) return [];
  const result = await db.prepare(`SELECT id, title, date, url, attachment FROM notices ORDER BY updated_at DESC, date DESC`)
    .all<StoredNotice>();
  return result.results || [];
}

export async function replaceNotices(items: StoredNotice[]) {
  const db = database();
  if (!db || !items.length) return;
  const updatedAt = new Date().toISOString();
  await db.prepare("DELETE FROM notices").run();
  await db.batch(items.map((item) => db.prepare(`INSERT INTO notices
    (id, title, date, url, attachment, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(item.id, item.title, item.date, item.url, item.attachment || null, updatedAt)));
}

export async function readMatches() {
  const db = database();
  if (!db) return [];
  const result = await db.prepare(`SELECT id, date, competition, round, home, away, stadium, city, county,
    county_code AS countyCode, status, score, delegates_json AS delegatesJson FROM matches ORDER BY date DESC`)
    .all<Omit<StoredMatch, "delegates"> & { delegatesJson: string }>();
  return (result.results || []).map((item) => ({
    ...item,
    delegates: JSON.parse(item.delegatesJson || "[]") as StoredDelegate[],
  }));
}

export async function upsertMatches(items: StoredMatch[]) {
  const db = database();
  if (!db || !items.length) return;
  const updatedAt = new Date().toISOString();
  for (const group of chunks(items)) {
    await db.batch(group.map((item) => db.prepare(`INSERT INTO matches
      (id, date, competition, round, home, away, stadium, city, county, county_code, status, score, delegates_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET date=excluded.date, competition=excluded.competition, round=excluded.round,
      home=excluded.home, away=excluded.away, stadium=excluded.stadium, city=excluded.city, county=excluded.county,
      county_code=excluded.county_code, status=excluded.status, score=excluded.score,
      delegates_json=excluded.delegates_json, updated_at=excluded.updated_at`)
      .bind(item.id, item.date, item.competition, item.round, item.home, item.away, item.stadium, item.city,
        item.county, item.countyCode || "", item.status, item.score || null, JSON.stringify(item.delegates), updatedAt)));
  }
}

export async function readProfile(profileId: string) {
  const db = database();
  if (!db) return null;
  const row = await db.prepare("SELECT payload_json AS payloadJson, updated_at AS updatedAt FROM profiles WHERE profile_id = ?")
    .bind(profileId).first<{ payloadJson: string; updatedAt: string }>();
  if (!row) return null;
  return { payload: JSON.parse(row.payloadJson) as Record<string, unknown>, updatedAt: row.updatedAt };
}

export async function writeProfile(profileId: string, payload: Record<string, unknown>) {
  const db = database();
  if (!db) return;
  await db.prepare(`INSERT INTO profiles (profile_id, payload_json, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(profile_id) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at`)
    .bind(profileId, JSON.stringify(payload), new Date().toISOString()).run();
}

export function isFresh(date: string | undefined | null, maxAge = 10 * 60_000) {
  return Boolean(date && Date.now() - new Date(date).getTime() < maxAge);
}
