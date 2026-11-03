import "./sites-env.mjs";
import { spawn } from "node:child_process";

const forwarded = process.argv.slice(2);
const portIndex = forwarded.findIndex((argument) => argument === "--port");
const port = portIndex >= 0 && forwarded[portIndex + 1] ? forwarded[portIndex + 1] : "8787";
const origin = `http://127.0.0.1:${port}`;
const wrangler = new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url);

const child = spawn(process.execPath, [
  wrangler.pathname,
  "dev",
  "--config", "dist/server/wrangler.json",
  "--local",
  "--persist-to", ".wrangler/state",
  "--ip", "127.0.0.1",
  "--inspector-port", "0",
  ...forwarded,
], { stdio: "inherit", env: process.env });

let syncing = false;
let timer;

async function waitUntilReady() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${origin}/api/manager`, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return true;
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function synchronize() {
  if (syncing) return;
  syncing = true;
  const startedAt = Date.now();
  try {
    const response = await fetch(`${origin}/api/sync`, { method: "POST", signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`[Harta Fotbalului] SQLite actualizat în ${Math.round((Date.now() - startedAt) / 1000)}s.`);
  } catch (error) {
    console.warn(`[Harta Fotbalului] Sincronizarea automată a eșuat: ${error instanceof Error ? error.message : error}`);
  } finally {
    syncing = false;
  }
}

waitUntilReady().then((ready) => {
  if (!ready) return;
  timer = setInterval(synchronize, 10 * 60_000);
});

function stop(signal) {
  if (timer) clearInterval(timer);
  child.kill(signal);
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
child.on("exit", (code) => {
  if (timer) clearInterval(timer);
  process.exitCode = code ?? 0;
});
