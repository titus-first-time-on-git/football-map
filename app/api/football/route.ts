type Official = {
  name: string;
  city: string;
  county: string;
  role: "Arbitru" | "Asistent";
  league: string;
};

type Notice = { title: string; date: string; url: string };

const CCA_OFFICIALS = "https://www.frf-cca.ro/arbitri/0/1";
const CCA_NOTICES = "https://www.frf-cca.ro/informatii/informari";
const HLF_DELEGATIONS = "https://hailafotbal.ro/arbitri/delegari";
const CCA_COUNTIES = "https://frf-cca.ro/delegari_judet/";

const fallbackOfficials: Official[] = [
  ["Marcel Bîrsan","București","București","Arbitru"],["Sebastian Colțescu","București","București","Arbitru"],["Radu Petrescu","București","București","Arbitru"],
  ["Horațiu Feșnic","Cluj-Napoca","Cluj","Arbitru"],["Ovidiu Hațegan","Arad","Arad","Arbitru"],["Istvan Kovacs","Carei","Satu Mare","Arbitru"],
  ["Szabolcs Kovacs","Carei","Satu Mare","Arbitru"],["Cătălin Popa","Pitești","Argeș","Arbitru"],["Marian Barbu","Făgăraș","Brașov","Arbitru"],
  ["Viorel Flueran","Craiova","Dolj","Arbitru"],["George Găman","Craiova","Dolj","Arbitru"],["Adrian Cojocaru","Galați","Galați","Arbitru"],
  ["Andrei Moroiță","Ploiești","Prahova","Arbitru"],["Cristian Moldoveanu","Sfântu Gheorghe","Covasna","Arbitru"],["Andrei Florin","Târgu Mureș","Mureș","Arbitru"],
  ["Ionela Peșu","Mangalia","Constanța","Arbitru"],["Ovidiu Artene","Vaslui","Vaslui","Asistent"],["Alexandru Filip","Constanța","Constanța","Asistent"],
  ["Florin Vîșan","Galați","Galați","Asistent"],["Daniel Vlase","Galați","Galați","Asistent"],["George Duță","Bacău","Bacău","Asistent"],
  ["Alexandru Vodă","Alba Iulia","Alba","Asistent"],["Roxana Ivanov","Ploiești","Prahova","Asistent"],["Cosmin Vatamanu","București","București","Asistent"],
].map(([name, city, county, role]) => ({ name, city, county, role: role as Official["role"], league: "Liga 1" }));

const fallbackNotices: Notice[] = [
  { title: "În atenția candidaților care vor să depună contestații", date: "29 oct. 2026", url: CCA_NOTICES },
  { title: "Rezultatele obținute la examenul de promovare Liga 2 și Liga 3", date: "29 oct. 2026", url: CCA_NOTICES },
  { title: "Comunicat CCA — examen", date: "2 oct. 2026", url: CCA_NOTICES },
];

function clean(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]*>/g, "")
    .replace(/Ş/g, "Ș").replace(/ş/g, "ș")
    .replace(/Ţ/g, "Ț").replace(/ţ/g, "ț")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOfficials(html: string): Official[] {
  const assistantStart = html.search(/<h2>\s*Asistenti/i);
  const matches = [...html.matchAll(/<a\s+href="\/arbitru\/\d+"[^>]*>([^<]+\([^<]+\))<\/a>/gi)];
  const result: Official[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const text = clean(match[1]);
    const parts = text.match(/^(.+?)\s*\(\s*(.+?)\s+-\s+(.+?)\s*\)$/);
    if (!parts) continue;
    const name = clean(parts[1]);
    const city = clean(parts[2]);
    const county = clean(parts[3]);
    const role: Official["role"] = assistantStart >= 0 && (match.index ?? 0) > assistantStart ? "Asistent" : "Arbitru";
    const key = `${name}|${role}`;
    if (!seen.has(key)) {
      result.push({ name, city, county, role, league: "Liga 1" });
      seen.add(key);
    }
  }
  return result;
}

function parseNotices(html: string): Notice[] {
  const results: Notice[] = [];
  const seen = new Set<string>();
  const pattern = /<h3[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>[\s\S]{0,700}?informatii_list_date[^>]*>([^<]+)</gi;
  for (const match of html.matchAll(pattern)) {
    const title = clean(match[2]);
    if (!title || seen.has(title)) continue;
    results.push({
      title,
      date: clean(match[3]),
      url: new URL(match[1], "https://www.frf-cca.ro").toString(),
    });
    seen.add(title);
    if (results.length === 6) break;
  }
  return results;
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "HartaFotbalului/1.0 (+data-visualization)" },
      cf: { cacheTtl: 900, cacheEverything: true },
    } as RequestInit);
    return { ok: response.ok, text: response.ok ? await response.text() : "" };
  } catch {
    return { ok: false, text: "" };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const [officialsPage, noticesPage, hlfPage, countiesPage] = await Promise.all([
    fetchText(CCA_OFFICIALS),
    fetchText(CCA_NOTICES),
    fetchText(HLF_DELEGATIONS),
    fetchText(CCA_COUNTIES),
  ]);

  const parsedOfficials = officialsPage.ok ? parseOfficials(officialsPage.text) : [];
  const parsedNotices = noticesPage.ok ? parseNotices(noticesPage.text) : [];
  const officials = parsedOfficials.length >= 10 ? parsedOfficials : fallbackOfficials;
  const notices = parsedNotices.length >= 2 ? parsedNotices : fallbackNotices;
  const liveCount = [officialsPage.ok, noticesPage.ok, countiesPage.ok].filter(Boolean).length;

  return Response.json({
    officials,
    notices,
    sources: [
      { name: "HaiLaFotbal — delegări", url: HLF_DELEGATIONS, status: hlfPage.ok ? "limited" : "limited" },
      { name: "CCA — arbitri Liga 1", url: CCA_OFFICIALS, status: officialsPage.ok ? "live" : "limited" },
      { name: "CCA — informări", url: CCA_NOTICES, status: noticesPage.ok ? "live" : "limited" },
      { name: "CCA — delegări județ", url: CCA_COUNTIES, status: countiesPage.ok ? "live" : "limited" },
    ],
    updatedAt: new Date().toISOString(),
    mode: liveCount === 3 && parsedOfficials.length >= 10 ? "live" : liveCount > 0 ? "mixed" : "fallback",
  }, {
    headers: { "cache-control": "public, max-age=300, s-maxage=900" },
  });
}
