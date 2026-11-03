"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Popover, ToggleGroup } from "radix-ui";
import { RomaniaMap } from "@/components/romania-map";
import { RefereeProfileDialog } from "@/components/referee-profile-dialog";
import { MatchHistoryDialog } from "@/components/match-history-dialog";

type Official = {
  name: string;
  city: string;
  county: string;
  role: "Arbitru" | "Asistent";
  league: string;
  profileId?: string;
};

type Notice = { title: string; date: string; url: string; attachment?: string };
type Source = { name: string; url: string; status: "live" | "redirect" | "limited" };
type DashboardData = {
  officials: Official[];
  notices: Notice[];
  sources: Source[];
  updatedAt: string | null;
  needsSync: boolean;
  storage: "sqlite" | "fallback";
  mode: "live" | "fallback" | "mixed";
};

type ManagerMatch = {
  id: string;
  date: string;
  competition: string;
  round: string;
  home: string;
  away: string;
  stadium: string;
  city: string;
  county: string;
  status: string;
  score?: string | null;
  delegates: Array<{ name: string; role: string; county: string }>;
};

type ManagerData = {
  season: string;
  upcoming: ManagerMatch[];
  recent: ManagerMatch[];
  workload: Array<{ name: string; county: string; central: number; assistant: number; var: number; total: number }>;
  competitions: string[];
  updatedAt: string | null;
  needsSync: boolean;
  storage: "sqlite" | "fallback";
  mode: "live" | "fallback";
};

type ExplorerRow = {
  id: string;
  type: "Meciuri" | "Arbitri" | "Asistenți";
  title: string;
  subtitle: string;
  category: string;
  city: string;
  county: string;
  date: string;
  status: string;
  search: string;
  sourceUrl: string;
  match?: ManagerMatch;
  official?: Official;
  notice?: Notice;
};

const emptyDashboard: DashboardData = {
  officials: [], notices: [], sources: [], updatedAt: null, needsSync: true, storage: "fallback", mode: "mixed",
};

const emptyManager: ManagerData = {
  season: "2026–2027", upcoming: [], recent: [], workload: [], competitions: [], updatedAt: null, needsSync: true, storage: "fallback", mode: "fallback",
};

const PAGE_SIZE = 25;

function SearchableFilter({ value, onValueChange, label, options }: {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const visible = options.filter((option) => option.toLocaleLowerCase("ro").includes(search.toLocaleLowerCase("ro")));
  return (
    <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(""); }}>
      <Popover.Trigger className="filter-select" aria-label={label}>
        <span>{value}</span><ChevronDown size={14} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="searchable-select-content" sideOffset={6} align="start">
          <label className="dropdown-search"><Search size={14} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Caută ${label.toLocaleLowerCase("ro")}`} /></label>
          <div className="searchable-options">
            {visible.map((option) => <button key={option} className={option === value ? "selected" : ""} onClick={() => { onValueChange(option); setOpen(false); }}>
              <span>{option}</span>{option === value && <Check size={13} />}
            </button>)}
            {!visible.length && <p>Niciun rezultat</p>}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default function Home() {
  const [data, setData] = useState(emptyDashboard);
  const [manager, setManager] = useState(emptyManager);
  const [refreshing, setRefreshing] = useState(true);
  const [activeCity, setActiveCity] = useState("București");
  const [mapMode, setMapMode] = useState("matches");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("Toate tipurile");
  const [categoryFilter, setCategoryFilter] = useState("Toate competițiile / loturile");
  const [countyFilter, setCountyFilter] = useState("Toate județele");
  const [page, setPage] = useState(1);
  const [selectedOfficial, setSelectedOfficial] = useState<Official | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<ManagerMatch | null>(null);
  const syncInFlight = useRef(false);

  const loadCache = async () => {
    try {
      const [footballResponse, managerResponse] = await Promise.all([
        fetch("/api/football", { cache: "no-store" }),
        fetch("/api/manager", { cache: "no-store" }),
      ]);
      const nextData = footballResponse.ok ? await footballResponse.json() as DashboardData : null;
      const nextManager = managerResponse.ok ? await managerResponse.json() as ManagerData : null;
      if (nextData) setData(nextData);
      if (nextManager) setManager(nextManager);
      return { needsSync: Boolean(nextData?.needsSync || nextManager?.needsSync) };
    } catch {
      return { needsSync: false };
    }
  };

  const refresh = async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setRefreshing(true);
    try {
      await fetch("/api/sync", { method: "POST", cache: "no-store" });
      await loadCache();
    } finally {
      syncInFlight.current = false;
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadCache().then((result) => {
      if (!active) return;
      setRefreshing(false);
      if (result.needsSync) refresh();
    });
    const timer = window.setInterval(refresh, 10 * 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (mapMode === "matches" && manager.upcoming.length && !manager.upcoming.some((match) => match.city === activeCity)) {
      setActiveCity(manager.upcoming[0].city);
    }
  }, [activeCity, manager.upcoming, mapMode]);

  const groupedOfficials = useMemo(() => data.officials.reduce<Record<string, Official[]>>((acc, official) => {
    (acc[official.city] ||= []).push(official);
    return acc;
  }, {}), [data.officials]);

  const selectedOfficials = (groupedOfficials[activeCity] || []).filter((official) =>
    mapMode === "referees" ? official.role === "Arbitru" : mapMode === "assistants" ? official.role === "Asistent" : true,
  );
  const selectedMatches = manager.upcoming.filter((match) => match.city === activeCity);

  const officialCities = useMemo(() => Object.entries(groupedOfficials).map(([name, officials]) => {
    const referees = officials.filter((official) => official.role === "Arbitru").length;
    const assistants = officials.filter((official) => official.role === "Asistent").length;
    return {
      name,
      county: officials[0]?.county || "",
      count: mapMode === "assistants" ? assistants : mapMode === "referees" ? referees : officials.length,
      referees,
      assistants,
      kind: "officials" as const,
    };
  }).filter((city) => city.count > 0), [groupedOfficials, mapMode]);

  const matchCities = useMemo(() => {
    const grouped = new Map<string, ManagerMatch[]>();
    for (const match of manager.upcoming) {
      if (!match.city) continue;
      grouped.set(match.city, [...(grouped.get(match.city) || []), match]);
    }
    return [...grouped.entries()].map(([name, matches]) => ({
      name,
      county: matches[0]?.county || "",
      count: matches.length,
      referees: 0,
      assistants: 0,
      kind: "matches" as const,
      labels: matches.slice(0, 2).map((match) => `${match.home} – ${match.away}`),
    }));
  }, [manager.upcoming]);

  const mapCities = mapMode === "matches" ? matchCities : officialCities;

  const rows = useMemo<ExplorerRow[]>(() => {
    const matchRows = [...manager.upcoming, ...manager.recent].map((match) => {
      const central = match.delegates.find((delegate) => delegate.role.toLocaleLowerCase("ro") === "arbitru");
      return {
        id: `match-${match.id}`,
        type: "Meciuri" as const,
        title: `${match.home} – ${match.away}`,
        subtitle: central ? `Arbitru: ${central.name} · ${match.delegates.length} oficiali` : "Brigada nu a fost publicată",
        category: match.competition,
        city: match.city,
        county: match.county,
        date: match.date,
        status: match.score ? `${match.score} · ${match.status}` : match.status,
        search: `${match.home} ${match.away} ${match.competition} ${match.round} ${match.city} ${match.county} ${match.stadium} ${match.delegates.map((delegate) => `${delegate.name} ${delegate.role} ${delegate.county}`).join(" ")}`,
        sourceUrl: "https://hailafotbal.ro/arbitri/delegari",
        match,
      };
    });

    const officialRows = data.officials.map((official) => ({
      id: `official-${official.profileId || official.name}-${official.role}`,
      type: official.role === "Arbitru" ? "Arbitri" as const : "Asistenți" as const,
      title: official.name,
      subtitle: official.role,
      category: official.league,
      city: official.city,
      county: official.county,
      date: "",
      status: "Activ în lot",
      search: `${official.name} ${official.role} ${official.league} ${official.city} ${official.county}`,
      sourceUrl: official.profileId ? `https://www.frf-cca.ro/arbitru/${official.profileId}` : "https://www.frf-cca.ro/arbitri/",
      official,
    }));

    return [...matchRows, ...officialRows];
  }, [data.officials, manager.recent, manager.upcoming]);

  const categories = useMemo(() => [
    "Toate competițiile / loturile",
    ...[...new Set([...manager.competitions, ...rows.map((row) => row.category)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "ro")),
  ], [manager.competitions, rows]);
  const counties = useMemo(() => [
    "Toate județele",
    ...[...new Set(rows.map((row) => row.county).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ro")),
  ], [rows]);

  const filteredRows = useMemo(() => {
    const normalized = query.toLocaleLowerCase("ro").trim();
    return rows.filter((row) => {
      const matchesQuery = !normalized || `${row.title} ${row.subtitle} ${row.search}`.toLocaleLowerCase("ro").includes(normalized);
      const matchesType = typeFilter === "Toate tipurile" || row.type === typeFilter;
      const matchesCategory = categoryFilter === "Toate competițiile / loturile" || row.category === categoryFilter;
      const matchesCounty = countyFilter === "Toate județele" || row.county === countyFilter;
      return matchesQuery && matchesType && matchesCategory && matchesCounty;
    });
  }, [categoryFilter, countyFilter, query, rows, typeFilter]);

  useEffect(() => { setPage(1); }, [categoryFilter, countyFilter, query, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const dateFormatter = new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const officialCount = mapMode === "referees"
    ? data.officials.filter((official) => official.role === "Arbitru").length
    : data.officials.filter((official) => official.role === "Asistent").length;
  const lastSync = [data.updatedAt, manager.updatedAt].filter(Boolean).sort().at(-1);
  const mapTypeLabel = mapMode === "matches" ? "Meciuri" : mapMode === "referees" ? "Arbitri" : "Asistenți";

  const openRow = (row: ExplorerRow) => {
    if (row.official) {
      setSelectedOfficial(row.official);
      setProfileOpen(true);
    } else if (row.match) {
      setSelectedMatch(row.match);
    } else if (row.notice) {
      window.open(row.sourceUrl, "_blank", "noopener,noreferrer");
    }
  };

  const filterByActiveCity = () => {
    setQuery(activeCity);
    document.querySelector("#control")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main>
      <header className="topbar">
        <a href="#harta" className="brand" aria-label="Harta Fotbalului">
          <span className="brand-mark"><span /></span>
          <span><strong>HARTA</strong><small>FOTBALULUI</small></span>
        </a>
        <nav aria-label="Navigare principală">
          <a href="#harta">Hartă</a>
          <a href="#control">Control</a>
        </nav>
        <button className="refresh-button" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? "spin" : ""} />
          <span>{refreshing ? "Sincronizare" : "Actualizează"}</span>
        </button>
      </header>

      <section className="map-section" id="harta">
        <div className="section-title">
          <div><span>01</span><h1>Harta arbitrajului</h1></div>
          <p><i className={data.storage === "sqlite" || manager.storage === "sqlite" ? "online" : ""} /> {refreshing ? "Sincronizare în fundal" : lastSync ? `SQLite · ${new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSync))}` : "Cache local pregătit"}</p>
        </div>

        <div className="map-card">
          <div className="map-toolbar">
            <span>{mapMode === "matches" ? `${manager.upcoming.length} meciuri viitoare` : `${officialCount} ${mapTypeLabel.toLocaleLowerCase("ro")} CCA`}</span>
            <ToggleGroup.Root className="map-toggle" type="single" value={mapMode} onValueChange={(value) => {
              if (!value) return;
              setMapMode(value);
              const firstCity = value === "matches" ? matchCities[0]?.name : officialCities[0]?.name;
              if (firstCity) setActiveCity(firstCity);
            }} aria-label="Conținutul hărții">
              <ToggleGroup.Item value="matches">Meciuri</ToggleGroup.Item>
              <ToggleGroup.Item value="referees">Arbitri</ToggleGroup.Item>
              <ToggleGroup.Item value="assistants">Asistenți</ToggleGroup.Item>
            </ToggleGroup.Root>
          </div>

          <div className="map-layout">
            <div className="romania-map">
              <RomaniaMap cities={mapCities} activeCity={activeCity} onCityChange={setActiveCity} />
            </div>
            <aside className="city-panel" aria-live="polite">
              <span className="panel-label"><MapPin size={13} /> {mapMode === "matches" ? "Meciuri în" : `${mapTypeLabel} din`}</span>
              <h2>{activeCity}</h2>
              <p>{(mapMode === "matches" ? selectedMatches[0]?.county : selectedOfficials[0]?.county) || "România"}</p>
              <strong className="city-total">{mapMode === "matches" ? selectedMatches.length : selectedOfficials.length}</strong>
              <small>{mapMode === "matches" ? "meciuri programate" : mapTypeLabel.toLocaleLowerCase("ro")}</small>
              <div className="city-items">
                {mapMode === "matches" ? selectedMatches.slice(0, 4).map((match) => (
                  <button key={match.id} onClick={() => setSelectedMatch(match)}>
                    <CalendarDays size={14} />
                    <span><b>{match.home} – {match.away}</b><small>{dateFormatter.format(new Date(match.date))}</small></span>
                  </button>
                )) : selectedOfficials.slice(0, 4).map((official) => (
                  <button key={`${official.profileId}-${official.role}`} onClick={() => { setSelectedOfficial(official); setProfileOpen(true); }}>
                    <UserRound size={14} />
                    <span><b>{official.name}</b><small>{official.role} · {official.league}</small></span>
                  </button>
                ))}
              </div>
              {(mapMode === "matches" ? selectedMatches.length : selectedOfficials.length) > 0 && (
                <button className="show-in-table" onClick={filterByActiveCity}>Vezi în tabel</button>
              )}
            </aside>
          </div>
        </div>
      </section>

      <section className="control-section" id="control">
        <div className="section-title">
          <div><span>02</span><h2>Centrul de control</h2></div>
          <p>{filteredRows.length} rezultate din cache</p>
        </div>

        <div className="explorer-card">
          <div className="explorer-toolbar">
            <label className="global-search">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută arbitru, echipă, oraș, stadion sau competiție" />
              {query && <button onClick={() => setQuery("")} aria-label="Șterge căutarea"><X size={14} /></button>}
            </label>
            <div className="filter-row">
              <SearchableFilter value={typeFilter} onValueChange={setTypeFilter} label="Tip" options={["Toate tipurile", "Meciuri", "Arbitri", "Asistenți"]} />
              <SearchableFilter value={categoryFilter} onValueChange={setCategoryFilter} label="Competiție sau lot" options={categories} />
              <SearchableFilter value={countyFilter} onValueChange={setCountyFilter} label="Județ" options={counties} />
            </div>
          </div>

          <div className="table-wrap">
            <table className="unified-table">
              <thead>
                <tr><th>Tip</th><th>Informație</th><th>Competiție / lot</th><th>Localitate</th><th>Data / stare</th><th /></tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Tip"><span className={`type-badge ${row.type === "Meciuri" ? "meciuri" : row.type === "Arbitri" ? "arbitri" : "asistenti"}`}>{row.type === "Meciuri" ? <CalendarDays size={13} /> : <ShieldCheck size={13} />}{row.type}</span></td>
                    <td data-label="Informație"><button className="record-title" onClick={() => openRow(row)}><b>{row.title}</b><small>{row.subtitle}</small></button></td>
                    <td data-label="Competiție / lot"><span className="category-text">{row.category}</span></td>
                    <td data-label="Localitate"><b className="location-text">{row.city || "—"}</b><small>{row.county}</small></td>
                    <td data-label="Data / stare"><b className="state-text">{row.date && row.date.includes("T") ? dateFormatter.format(new Date(row.date)) : row.date || row.status}</b>{row.date && <small>{row.status}</small>}</td>
                    <td className="action-cell"><button onClick={() => openRow(row)} aria-label={`Deschide ${row.title}`}><ExternalLink size={15} /></button></td>
                  </tr>
                ))}
                {!visibleRows.length && <tr><td className="empty-results" colSpan={6}>Nu există rezultate pentru filtrele selectate.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>{filteredRows.length ? `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filteredRows.length)} din ${filteredRows.length}` : "0 rezultate"}</span>
            <div>
              <button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Înapoi</button>
              <span>{page} / {pageCount}</span>
              <button disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Înainte</button>
            </div>
          </div>
        </div>
      </section>

      <footer className="simple-footer">© {new Date().getFullYear()} Harta Fotbalului</footer>

      <RefereeProfileDialog official={selectedOfficial} open={profileOpen} onOpenChange={setProfileOpen} />
      <MatchHistoryDialog
        match={selectedMatch}
        officials={data.officials}
        onOpenChange={(open) => !open && setSelectedMatch(null)}
        onOfficialSelect={(official) => { setSelectedOfficial(official); setSelectedMatch(null); setProfileOpen(true); }}
      />
    </main>
  );
}
