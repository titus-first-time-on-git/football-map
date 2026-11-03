import { syncAllData } from "@/lib/data-sync";

export async function POST() {
  const startedAt = Date.now();
  const results = await syncAllData();
  return Response.json({
    ok: true,
    durationMs: Date.now() - startedAt,
    results,
    updatedAt: new Date().toISOString(),
  }, { headers: { "cache-control": "no-store" } });
}
