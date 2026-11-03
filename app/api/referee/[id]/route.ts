import { isFresh, readProfile, writeProfile } from "@/lib/data-store";

function clean(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/<[^>]*>/g, "")
    .replace(/Ş/g, "Ș").replace(/ş/g, "ș")
    .replace(/Ţ/g, "Ț").replace(/ţ/g, "ț")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(value: string) {
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const match = value.match(/(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})/);
  if (!match) return null;
  return new Date(Number(match[3]), months[match[2]] ?? 0, Number(match[1]), 12).toISOString();
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "ID invalid" }, { status: 400 });

  const cached = await readProfile(id);
  if (cached && isFresh(cached.updatedAt)) {
    return Response.json({ ...cached.payload, cached: true, updatedAt: cached.updatedAt }, { headers: { "cache-control": "no-store" } });
  }

  const url = `https://www.frf-cca.ro/arbitru/${id}`;
  let html = "";
  try {
    const response = await fetch(url, {
      headers: { "user-agent": "HartaFotbaluluiLocal/3.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Profil indisponibil");
    html = await response.text();
  } catch {
    if (cached) return Response.json({ ...cached.payload, cached: true, stale: true, updatedAt: cached.updatedAt });
    return Response.json({ error: "Profil indisponibil" }, { status: 502 });
  }

  const name = clean(html.match(/<h1[^>]*>[\s\S]*?<strong>Nume:<\/strong>([\s\S]*?)<\/h1>/i)?.[1] || "");
  const fromMatch = html.match(/<h3[^>]*>\s*Din:\s*(?:<[^>]+>\s*)*([^<]+)<\/strong>\s*,\s*judetul\s*<a[^>]*>([^<]+)<\/a>/i);
  const city = clean(fromMatch?.[1] || "");
  const county = clean(fromMatch?.[2] || "");
  const lot = clean(html.match(/<td[^>]*>Lotul<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] || "");

  const assignments = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => clean(cell[1])))
    .filter((cells) => cells.length === 7 && /\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4}/.test(cells[6]))
    .map((cells) => ({
      teams: cells[0],
      score: cells[1],
      stadium: cells[2],
      city: cells[3],
      season: cells[4],
      competition: cells[5],
      dateLabel: cells[6],
      date: parseDate(cells[6]),
    }))
    .filter((assignment) => assignment.date);

  const competitions = new Map<string, number>();
  for (const assignment of assignments) {
    competitions.set(assignment.competition, (competitions.get(assignment.competition) || 0) + 1);
  }
  const now = Date.now();
  const upcoming = assignments
    .filter((assignment) => new Date(assignment.date!).getTime() >= now)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  const recent = assignments
    .filter((assignment) => new Date(assignment.date!).getTime() < now)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

  const payload = {
    id,
    url,
    name,
    city,
    county,
    lot,
    totalMatches: assignments.length,
    seasons: new Set(assignments.map((assignment) => assignment.season)).size,
    upcoming,
    recent,
    assignments: [...assignments].sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime()),
    competitions: [...competitions.entries()]
      .map(([competition, matches]) => ({ competition, matches }))
      .sort((a, b) => b.matches - a.matches),
    firstMatch: assignments[0] || null,
    lastMatch: assignments.at(-1) || null,
  };
  await writeProfile(id, payload);
  return Response.json({ ...payload, cached: false, updatedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
