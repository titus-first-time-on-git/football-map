import { claimSyncJob, writeSync } from "@/lib/data-store";
import { syncAllData } from "@/lib/data-sync";

export async function runSyncJob(force = false) {
  if (!force && !(await claimSyncJob())) return { started: false };
  try {
    const results = await syncAllData();
    await writeSync("job", "ok");
    return { started: true, results };
  } catch (error) {
    await writeSync("job", "error", error instanceof Error ? error.message : "Job eșuat");
    throw error;
  }
}
