import { hlfPost } from "@/lib/hailafotbal";
import {
  replaceNotices,
  replaceOfficials,
  upsertMatches,
  writeSync,
  type StoredMatch,
  type StoredNotice,
  type StoredOfficial,
} from "@/lib/data-store";

type Competition = { competitionId: string; name: string; seasonId: number; organizationName?: string };
type Stage = { stageId?: string; competitionStageId?: string; competitionId: string; name: string; isCurrent?: boolean };
type Series = { seriesId: string; stageId: string; name: string };
type Tour = { tourRoundId: string; seriesId: string; startDate: string; orderNo?: number; tourNo?: number };
type Delegate = { matchId: string; delegateType: string; delegateFirstName: string; delegateLastName: string; townCJA?: string; ord?: number };
type RawMatch = {
  matchId: string;
  startDate: string;
  tourRoundOrderDisplay?: number;
  sysCompetitionMatchStatusId?: number;
  homeGoals?: number | null;
  awayGoals?: number | null;
  homeClub?: { name?: string; abbreviation?: string };
  awayClub?: { name?: string; abbreviation?: string };
  stadium?: { name?: string; town?: string; county?: string; countyCode?: string };
};
type MatchGroup = { list?: RawMatch[] };
type MatchesResponse = { matches?: MatchGroup[]; delegates?: Delegate[] };

const CCA_LOTS = [
  { url: "https://www.frf-cca.ro/arbitri/0/1", name: "Liga 1" },
  { url: "https://www.frf-cca.ro/arbitri/0/2", name: "Liga 2" },
  { url: "https://www.frf-cca.ro/arbitri/0/3", name: "Liga 3" },
  { url: "https://www.frf-cca.ro/arbitri/0/5", name: "Juniori Republicani" },
  { url: "https://www.frf-cca.ro/arbitri/0/6", name: "VAR / AVAR" },
] as const;
const CCA_NOTICES = "https://www.frf-cca.ro/informatii/informari";

export const fallbackOfficials: StoredOfficial[] = [
  ["Marcel Bîrsan","București","București","Arbitru"],["Sebastian Colțescu","București","București","Arbitru"],["Radu Petrescu","București","București","Arbitru"],
  ["Horațiu Feșnic","Cluj-Napoca","Cluj","Arbitru"],["Ovidiu Hațegan","Arad","Arad","Arbitru"],["Istvan Kovacs","Carei","Satu Mare","Arbitru"],
  ["Szabolcs Kovacs","Carei","Satu Mare","Arbitru"],["Cătălin Popa","Pitești","Argeș","Arbitru"],["Marian Barbu","Făgăraș","Brașov","Arbitru"],
  ["Viorel Flueran","Craiova","Dolj","Arbitru"],["George Găman","Craiova","Dolj","Arbitru"],["Adrian Cojocaru","Galați","Galați","Arbitru"],
  ["Andrei Moroiță","Ploiești","Prahova","Arbitru"],["Cristian Moldoveanu","Sfântu Gheorghe","Covasna","Arbitru"],["Ionela Peșu","Mangalia","Constanța","Arbitru"],
  ["Ovidiu Artene","Vaslui","Vaslui","Asistent"],["Alexandru Filip","Constanța","Constanța","Asistent"],["Florin Vîșan","Galați","Galați","Asistent"],
  ["Daniel Vlase","Galați","Galați","Asistent"],["George Duță","Bacău","Bacău","Asistent"],["Alexandru Vodă","Alba Iulia","Alba","Asistent"],
  ["Roxana Ivanov","Ploiești","Prahova","Asistent"],["Cosmin Vatamanu","București","București","Asistent"],
].map(([name, city, county, role], index) => ({
  id: `fallback-${index}`,
  name,
  city,
  county,
  role: role as StoredOfficial["role"],
  league: "Liga 1",
}));

export const fallbackMatches: StoredMatch[] = [{
  id: "fallback-arad",
  date: "2026-11-06T17:30:00+02:00",
  competition: "SuperLiga",
  round: "Etapa 15",
  home: "AFC UTA Arad",
  away: "ACS Petrolul 52",
  stadium: "Francisc Neumann",
  city: "Arad",
  county: "Arad",
  status: "programat",
  score: null,
  delegates: [],
}];

function clean(value: string) {
  return value.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/<[^>]*>/g, "").replace(/Ş/g, "Ș").replace(/ş/g, "ș")
    .replace(/Ţ/g, "Ț").replace(/ţ/g, "ț").replace(/\s+/g, " ").trim();
}

function parseOfficials(html: string, league: string) {
  const assistantStart = html.search(/<h2>\s*Asistenti/i);
  const matches = [...html.matchAll(/<a\s+href="\/arbitru\/(\d+)"[^>]*>([^<]+\([^<]+\))<\/a>/gi)];
  return matches.flatMap((match): StoredOfficial[] => {
    const parts = clean(match[2]).match(/^(.+?)\s*\(\s*(.+?)\s+-\s+(.+?)\s*\)$/);
    if (!parts) return [];
    const role = assistantStart >= 0 && (match.index ?? 0) > assistantStart ? "Asistent" : "Arbitru";
    return [{
      id: `${match[1]}-${role}`,
      profileId: match[1],
      name: clean(parts[1]),
      city: clean(parts[2]),
      county: clean(parts[3]),
      role,
      league,
    }];
  });
}

function mergeOfficials(lists: StoredOfficial[][]) {
  const result = new Map<string, StoredOfficial>();
  for (const official of lists.flat()) {
    const key = `${official.profileId || official.name}-${official.role}`;
    const existing = result.get(key);
    if (!existing) result.set(key, official);
    else existing.league = [...new Set([...existing.league.split(" · "), ...official.league.split(" · ")])].join(" · ");
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

function parseNotices(html: string) {
  const results: StoredNotice[] = [];
  const pattern = /<h3[^>]*>\s*<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h3>[\s\S]{0,700}?informatii_list_date[^>]*>([^<]+)</gi;
  for (const match of html.matchAll(pattern)) {
    const title = clean(match[2]);
    if (!title || results.some((item) => item.title === title)) continue;
    results.push({ id: `cca-${results.length}-${title}`, title, date: clean(match[3]), url: new URL(match[1], "https://www.frf-cca.ro").toString() });
  }
  return results;
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: { "user-agent": "HartaFotbaluluiLocal/3.0" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

export async function syncDirectory() {
  try {
    const [pages, noticesHtml] = await Promise.all([
      Promise.all(CCA_LOTS.map((lot) => fetchText(lot.url).catch(() => ""))),
      fetchText(CCA_NOTICES).catch(() => ""),
    ]);
    const officials = mergeOfficials(pages.map((html, index) => html ? parseOfficials(html, CCA_LOTS[index].name) : []));
    const notices = noticesHtml ? parseNotices(noticesHtml) : [];
    if (officials.length >= 10) await replaceOfficials(officials);
    if (notices.length) await replaceNotices(notices);
    await writeSync("directory", officials.length >= 10 ? "ok" : "partial", `${officials.length} oficiali`);
    return { officials: officials.length, notices: notices.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sincronizare CCA eșuată";
    await writeSync("directory", "error", message);
    throw error;
  }
}

function stageId(stage: Stage) { return stage.stageId || stage.competitionStageId || ""; }
function flatten(groups: MatchGroup[] = []) { return groups.flatMap((group) => group.list || []); }
function normalizeTown(value = "") {
  return value.replace(/^SECTORUL \d+\s*-\s*/i, "").replace(/\s*\(.*?\)\s*/g, " ").toLocaleLowerCase("ro")
    .replace(/(^|\s|-)(\p{L})/gu, (_, prefix, letter) => prefix + letter.toLocaleUpperCase("ro")).trim();
}
function delegateName(delegate: Delegate) {
  return `${delegate.delegateLastName || ""} ${delegate.delegateFirstName || ""}`.replace(/\s+/g, " ").trim();
}
function mapMatch(match: RawMatch, competition: Competition, delegates: Delegate[]): StoredMatch {
  return {
    id: match.matchId,
    date: match.startDate,
    competition: competition.name,
    round: match.tourRoundOrderDisplay ? `Etapa ${match.tourRoundOrderDisplay}` : "Etapă",
    home: match.homeClub?.name || match.homeClub?.abbreviation || "Gazde",
    away: match.awayClub?.name || match.awayClub?.abbreviation || "Oaspeți",
    stadium: match.stadium?.name || "Stadion neanunțat",
    city: normalizeTown(match.stadium?.town || ""),
    county: normalizeTown(match.stadium?.county || ""),
    countyCode: match.stadium?.countyCode || "",
    status: match.sysCompetitionMatchStatusId === 3 ? "încheiat" : "programat",
    score: match.homeGoals != null && match.awayGoals != null ? `${match.homeGoals}–${match.awayGoals}` : null,
    delegates: delegates.filter((delegate) => delegate.matchId === match.matchId)
      .sort((a, b) => (a.ord || 99) - (b.ord || 99))
      .map((delegate) => ({ name: delegateName(delegate), role: delegate.delegateType, county: delegate.townCJA || "" })),
  };
}

async function pooled<T, R>(items: T[], worker: (item: T) => Promise<R>, concurrency = 10) {
  const results: R[] = [];
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results.push(await worker(items[index])); } catch { /* One unavailable league must not stop the full sync. */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

export async function syncMatches() {
  try {
    const [seasons, competitions, stages, series, tours] = await Promise.all([
      hlfPost<Array<{ competitionsSeasonId: number; isCurrent: boolean; startYear: string; endYear: string }>>("/GetSeasons", {}),
      hlfPost<Competition[]>("/GetCompetitions", { SportsCategoryId: 1 }),
      hlfPost<Stage[]>("/GetCompetitionStages", {}),
      hlfPost<Series[]>("/GetCompetitionStageSeries", {}),
      hlfPost<Tour[]>("/GetCompetitionStageSeriesTourRounds", {}),
    ]);
    const currentSeason = seasons.find((season) => season.isCurrent) || seasons[0];
    const national = competitions.filter((competition) => competition.seasonId === currentSeason.competitionsSeasonId &&
      /Federaţia Română de Fotbal|Federația Română de Fotbal|Liga Profesionistă/i.test(competition.organizationName || ""));
    const now = Date.now();
    const specs = national.flatMap((competition) => stages
      .filter((stage) => stage.competitionId === competition.competitionId && stage.isCurrent)
      .flatMap((stage) => series.filter((item) => item.stageId === stageId(stage)).flatMap((item) => {
        const ordered = tours.filter((tour) => tour.seriesId === item.seriesId && tour.startDate)
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        const nextIndex = ordered.findIndex((tour) => new Date(tour.startDate).getTime() >= now - 86_400_000);
        const indexes = nextIndex < 0 ? [ordered.length - 1] : [nextIndex - 1, nextIndex, nextIndex + 1];
        return indexes.filter((index) => index >= 0 && index < ordered.length)
          .map((index) => ({ competition, stage, series: item, tour: ordered[index] }));
      })));
    const uniqueSpecs = [...new Map(specs.map((spec) => [spec.tour.tourRoundId, spec])).values()];
    const responses = await pooled(uniqueSpecs, async (spec) => {
      const data = await hlfPost<MatchesResponse>("/GetMatches", {
        SeasonId: currentSeason.competitionsSeasonId,
        CompetitionId: spec.competition.competitionId,
        StageId: stageId(spec.stage),
        SeriesId: spec.series.seriesId,
        TourRoundId: spec.tour.tourRoundId,
      });
      return flatten(data.matches).map((match) => mapMatch(match, spec.competition, data.delegates || []));
    });
    const matches = responses.flat();
    if (matches.length) await upsertMatches(matches);
    const season = `20${currentSeason.startYear}–20${currentSeason.endYear}`;
    await writeSync("matches", matches.length ? "ok" : "partial", JSON.stringify({ season, competitions: national.map((item) => item.name) }));
    return { matches: matches.length, competitions: national.length, season };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sincronizare meciuri eșuată";
    await writeSync("matches", "error", message);
    throw error;
  }
}

let running: Promise<unknown> | null = null;
export function syncAllData() {
  if (running) return running;
  running = Promise.allSettled([syncDirectory(), syncMatches()]).finally(() => { running = null; });
  return running;
}
