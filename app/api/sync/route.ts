import { runSyncJob } from "@/lib/sync-job";

export const maxDuration = 120;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return !secret || request.headers.get("authorization") === `Bearer ${secret}`;
}

async function execute(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await runSyncJob(true);
  return Response.json({ ok: true, result }, { headers: { "cache-control": "no-store" } });
}

export const GET = execute;
export const POST = execute;
