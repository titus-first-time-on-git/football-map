import { fallbackOfficials } from "@/lib/data-sync";
import { isFresh, readNotices, readOfficials, readSync } from "@/lib/data-store";

export async function GET() {
  const [storedOfficials, notices, state] = await Promise.all([
    readOfficials(),
    readNotices(),
    readSync("directory"),
  ]);
  const officials = storedOfficials.length ? storedOfficials : fallbackOfficials;
  return Response.json({
    officials,
    notices,
    sources: [
      { name: "HaiLaFotbal — delegări", url: "https://hailafotbal.ro/arbitri/delegari", status: "live" },
      { name: "CCA — loturi naționale", url: "https://www.frf-cca.ro/arbitri/", status: state?.status === "ok" ? "live" : "limited" },
    ],
    updatedAt: state?.syncedAt || null,
    needsSync: !isFresh(state?.syncedAt),
    mode: storedOfficials.length ? (state?.status === "ok" ? "live" : "mixed") : "fallback",
    storage: storedOfficials.length ? "sqlite" : "fallback",
  }, { headers: { "cache-control": "no-store" } });
}
