type ApiConfig = {
  baseUrl: string;
  apiUser: string;
  apiPassword: string;
  pathPrefix: string;
};

type TokenCache = { token: string; expiresAt: number };

let configCache: ApiConfig | null = null;
let tokenCache: TokenCache | null = null;
let tokenPromise: Promise<string> | null = null;

const HLF_HOME = "https://hailafotbal.ro/arbitri/delegari";
const HLF_ORIGIN = "https://hailafotbal.ro/";
const LAST_KNOWN_CONFIG_CHUNKS = ["chunk-7XH6ONXL.js"];

function configFromSource(source: string): ApiConfig | null {
  if (!source.includes("apiPassword") || !source.includes("apiUser")) return null;
  const baseUrl = source.match(/baseUrl:"([^"]+)"/)?.[1];
  const apiUser = source.match(/apiUser:"([^"]+)"/)?.[1];
  const apiPassword = source.match(/apiPassword:"([^"]+)"/)?.[1];
  const pathPrefix = source.match(/pathPrefix:"([^"]+)"/)?.[1] || "/HaiLaFotbal";
  return baseUrl && apiUser && apiPassword ? { baseUrl, apiUser, apiPassword, pathPrefix } : null;
}

async function text(url: string) {
  const response = await fetch(url, {
    headers: { "user-agent": "HartaFotbaluluiLocal/2.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HaiLaFotbal ${response.status}: ${url}`);
  return response.text();
}

async function discoverConfig(): Promise<ApiConfig> {
  if (configCache) return configCache;

  for (const chunk of LAST_KNOWN_CONFIG_CHUNKS) {
    try {
      const knownConfig = configFromSource(await text(new URL(chunk, HLF_ORIGIN).toString()));
      if (knownConfig) {
        configCache = knownConfig;
        return configCache;
      }
    } catch {
      // Continue with discovery when HaiLaFotbal publishes a new frontend build.
    }
  }

  const html = await text(HLF_HOME);
  const mainPath = html.match(/src="(main-[^"]+\.js)"/)?.[1];
  if (!mainPath) throw new Error("Nu am găsit bundle-ul HaiLaFotbal.");

  const main = await text(new URL(mainPath, HLF_ORIGIN).toString());
  const chunks = [...main.matchAll(/from"\.\/(chunk-[^"]+\.js)"/g)].map((match) => match[1]);
  const uniqueChunks = [...new Set(chunks)];
  const imports = [...main.matchAll(/import\{([^}]*)\}from"\.\/(chunk-[^"]+\.js)"/g)];
  const preferredChunk = imports.find((match) =>
    [...match[1].matchAll(/\bas ([A-Za-z_$][\w$]*)\b/g)]
      .some((binding) => new RegExp(`\\b${binding[1]}\\.api\\b`).test(main)),
  )?.[2];
  const orderedChunks = preferredChunk
    ? [preferredChunk, ...uniqueChunks.filter((chunk) => chunk !== preferredChunk)]
    : uniqueChunks;

  for (const chunk of orderedChunks) {
    try {
      const source = await text(new URL(chunk, HLF_ORIGIN).toString());
      const discoveredConfig = configFromSource(source);
      if (!discoveredConfig) continue;
      configCache = discoveredConfig;
      return configCache;
    } catch {
      // Continue with the other public chunks if one CDN request is unavailable.
    }
  }

  throw new Error("Configurația API publică nu a putut fi descoperită.");
}

async function getToken(config: ApiConfig) {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  if (tokenPromise) return tokenPromise;
  tokenPromise = (async () => {
    const response = await fetch(`${config.baseUrl}/Auth/GetToken`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiUser: config.apiUser, apiPassword: config.apiPassword }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Autentificare FRF Data Lake: ${response.status}`);
    const body = await response.json() as { token?: string };
    if (!body.token) throw new Error("FRF Data Lake nu a returnat token.");
    tokenCache = { token: body.token, expiresAt: Date.now() + 8 * 60_000 };
    return body.token;
  })().finally(() => { tokenPromise = null; });
  return tokenPromise;
}

export async function hlfPost<T>(path: string, payload: Record<string, unknown>) {
  const config = await discoverConfig();
  let token = await getToken(config);

  const request = () => fetch(`${config.baseUrl}${config.pathPrefix}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });

  let response = await request();
  if (response.status === 401) {
    tokenCache = null;
    token = await getToken(config);
    response = await request();
  }
  if (!response.ok) throw new Error(`FRF Data Lake ${path}: ${response.status}`);
  const body = await response.json() as { responseData?: T; erorrMessages?: string[] };
  if (body.erorrMessages?.length) throw new Error(body.erorrMessages.join(", "));
  return body.responseData as T;
}
