import { readMatches } from "@/lib/data-store";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ro").replace(/[^a-z0-9]/g, "");
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matches = await readMatches();
  const match = matches.find((item) => item.id === id);
  if (!match) return Response.json({ error: "Meciul nu există în cache" }, { status: 404 });

  const clubs = new Set([normalized(match.home), normalized(match.away)]);
  const delegateNames = new Set(match.delegates.map((delegate) => normalized(delegate.name)));
  const teamHistory = matches.filter((item) => item.id !== id &&
    [item.home, item.away].some((club) => clubs.has(normalized(club))))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const officialHistory = matches.filter((item) => item.id !== id &&
    item.delegates.some((delegate) => delegateNames.has(normalized(delegate.name))))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return Response.json({ match, teamHistory, officialHistory }, { headers: { "cache-control": "no-store" } });
}
