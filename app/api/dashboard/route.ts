import { after } from "next/server";
import { getDashboardData } from "@/lib/dashboard-data";
import { runSyncJob } from "@/lib/sync-job";

export const maxDuration = 120;

export async function GET() {
  const payload = await getDashboardData();
  if (payload.refreshPending) after(() => runSyncJob());
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}
