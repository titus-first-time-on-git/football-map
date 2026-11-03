import { fallbackMatches } from "@/lib/data-sync";
import { isFresh, readMatches, readSync, type StoredMatch } from "@/lib/data-store";

function workload(matches: StoredMatch[]) {
  const rows = new Map<string, { name: string; county: string; central: number; assistant: number; var: number; total: number }>();
  for (const match of matches) for (const delegate of match.delegates) {
    const key = delegate.name.toLocaleLowerCase("ro");
    const row = rows.get(key) || { name: delegate.name, county: delegate.county, central: 0, assistant: 0, var: 0, total: 0 };
    const role = delegate.role.toLocaleLowerCase("ro");
    if (role === "arbitru") row.central += 1;
    else if (role.includes("var")) row.var += 1;
    else if (role.includes("asistent")) row.assistant += 1;
    row.total += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total);
}

export async function GET() {
  const [stored, state] = await Promise.all([readMatches(), readSync("matches")]);
  const matches = stored.length ? stored : fallbackMatches;
  const now = Date.now();
  const upcoming = matches.filter((match) => new Date(match.date).getTime() >= now - 12 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const recent = matches.filter((match) => new Date(match.date).getTime() < now - 12 * 60 * 60 * 1000)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  let syncMeta: { season?: string; competitions?: string[] } = {};
  try { syncMeta = JSON.parse(state?.message || "{}"); } catch { /* Keep derived metadata. */ }
  const competitions = [...new Set([...(syncMeta.competitions || []), ...matches.map((match) => match.competition)])]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, "ro"));
  return Response.json({
    season: syncMeta.season || "2026–2027",
    upcoming,
    recent,
    workload: workload(recent),
    competitions,
    updatedAt: state?.syncedAt || null,
    needsSync: !isFresh(state?.syncedAt),
    mode: stored.length ? "live" : "fallback",
    storage: stored.length ? "sqlite" : "fallback",
  }, { headers: { "cache-control": "no-store" } });
}
