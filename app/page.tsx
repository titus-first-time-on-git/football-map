"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  Clock3,
  Database,
  ExternalLink,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Select, ToggleGroup } from "radix-ui";
import { RomaniaMap } from "@/components/romania-map";

type Official = {
  name: string;
  city: string;
  county: string;
  role: "Arbitru" | "Asistent";
  league: string;
};

type Notice = { title: string; date: string; url: string; attachment?: string };
type Source = { name: string; url: string; status: "live" | "redirect" | "limited" };
type DashboardData = {
  officials: Official[];
  notices: Notice[];
  sources: Source[];
  updatedAt: string;
  mode: "live" | "fallback" | "mixed";
};

const fallbackOfficials: Official[] = [
  { name: "Marcel Bîrsan", city: "București", county: "București", role: "Arbitru", league: "Liga 1" },
  { name: "Sebastian Colțescu", city: "București", county: "București", role: "Arbitru", league: "Liga 1" },
  { name: "Radu Petrescu", city: "București", county: "București", role: "Arbitru", league: "Liga 1" },
  { name: "Horațiu Feșnic", city: "Cluj-Napoca", county: "Cluj", role: "Arbitru", league: "Liga 1" },
  { name: "Ovidiu Hațegan", city: "Arad", county: "Arad", role: "Arbitru", league: "Liga 1" },
  { name: "Istvan Kovacs", city: "Carei", county: "Satu Mare", role: "Arbitru", league: "Liga 1" },
  { name: "Szabolcs Kovacs", city: "Carei", county: "Satu Mare", role: "Arbitru", league: "Liga 1" },
  { name: "Cătălin Popa", city: "Pitești", county: "Argeș", role: "Arbitru", league: "Liga 1" },
  { name: "Marian Barbu", city: "Făgăraș", county: "Brașov", role: "Arbitru", league: "Liga 1" },
  { name: "Viorel Flueran", city: "Craiova", county: "Dolj", role: "Arbitru", league: "Liga 1" },
  { name: "George Găman", city: "Craiova", county: "Dolj", role: "Arbitru", league: "Liga 1" },
  { name: "Adrian Cojocaru", city: "Galați", county: "Galați", role: "Arbitru", league: "Liga 1" },
  { name: "Andrei Moroiță", city: "Ploiești", county: "Prahova", role: "Arbitru", league: "Liga 1" },
  { name: "Cristian Moldoveanu", city: "Sfântu Gheorghe", county: "Covasna", role: "Arbitru", league: "Liga 1" },
  { name: "Andrei Florin", city: "Târgu Mureș", county: "Mureș", role: "Arbitru", league: "Liga 1" },
  { name: "Ionela Peșu", city: "Mangalia", county: "Constanța", role: "Arbitru", league: "Liga 1" },
  { name: "Ovidiu Artene", city: "Vaslui", county: "Vaslui", role: "Asistent", league: "Liga 1" },
  { name: "Alexandru Filip", city: "Constanța", county: "Constanța", role: "Asistent", league: "Liga 1" },
  { name: "Florin Vîșan", city: "Galați", county: "Galați", role: "Asistent", league: "Liga 1" },
  { name: "Daniel Vlase", city: "Galați", county: "Galați", role: "Asistent", league: "Liga 1" },
  { name: "George Duță", city: "Bacău", county: "Bacău", role: "Asistent", league: "Liga 1" },
  { name: "Alexandru Vodă", city: "Alba Iulia", county: "Alba", role: "Asistent", league: "Liga 1" },
  { name: "Roxana Ivanov", city: "Ploiești", county: "Prahova", role: "Asistent", league: "Liga 1" },
  { name: "Cosmin Vatamanu", city: "București", county: "București", role: "Asistent", league: "Liga 1" },
];

const fallbackNotices: Notice[] = [
  { title: "În atenția candidaților care vor să depună contestații", date: "29 oct. 2026", url: "https://www.frf-cca.ro/informatii/informari" },
  { title: "Rezultatele obținute la examenul de promovare Liga 2 și Liga 3", date: "29 oct. 2026", url: "https://www.frf-cca.ro/informatii/informari" },
  { title: "Comunicat CCA — examen", date: "2 oct. 2026", url: "https://www.frf-cca.ro/informatii/informari" },
];

const fallbackSources: Source[] = [
  { name: "HaiLaFotbal — delegări", url: "https://hailafotbal.ro/arbitri/delegari", status: "limited" },
  { name: "CCA — arbitri Liga 1", url: "https://www.frf-cca.ro/arbitri/0/1", status: "live" },
  { name: "CCA — informări", url: "https://www.frf-cca.ro/informatii/informari", status: "live" },
  { name: "CCA — delegări județ", url: "https://frf-cca.ro/delegari_judet/", status: "live" },
];

const initialData: DashboardData = {
  officials: fallbackOfficials,
  notices: fallbackNotices,
  sources: fallbackSources,
  updatedAt: new Date("2026-11-03T08:30:00Z").toISOString(),
  mode: "mixed",
};

export default function Home() {
  const [data, setData] = useState(initialData);
  const [activeCity, setActiveCity] = useState("București");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("Toate rolurile");
  const [mapMetric, setMapMetric] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/football", { cache: "no-store" });
      if (response.ok) setData(await response.json());
    } catch {
      // Keep the verified snapshot visible when a source is unavailable.
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const grouped = useMemo(() => {
    return data.officials.reduce<Record<string, Official[]>>((acc, official) => {
      (acc[official.city] ||= []).push(official);
      return acc;
    }, {});
  }, [data.officials]);

  const selectedOfficials = grouped[activeCity] || [];
  const mapCities = Object.entries(grouped).map(([name, officials]) => {
    const referees = officials.filter((official) => official.role === "Arbitru").length;
    const assistants = officials.filter((official) => official.role === "Asistent").length;
    return {
      name,
      county: officials[0]?.county || "",
      count: mapMetric === "referees" ? referees : mapMetric === "assistants" ? assistants : officials.length,
      referees,
      assistants,
    };
  }).filter((city) => city.count > 0);
  const filtered = data.officials.filter((item) => {
    const text = `${item.name} ${item.city} ${item.county}`.toLocaleLowerCase("ro");
    return text.includes(query.toLocaleLowerCase("ro")) && (role === "Toate rolurile" || item.role === role);
  });
  const counties = new Set(data.officials.map((item) => item.county)).size;

  return (
    <main>
      <header className="topbar">
        <a href="#top" className="brand" aria-label="Harta Fotbalului — acasă">
          <span className="brand-mark"><span /></span>
          <span><strong>HARTA</strong><small>FOTBALULUI</small></span>
        </a>
        <nav aria-label="Navigare principală">
          <a className="active" href="#harta">Hartă</a>
          <a href="#arbitri">Arbitri</a>
          <a href="#informari">Informări</a>
          <a href="#surse">Surse</a>
        </nav>
        <button className="refresh-top" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? "spin" : ""} />
          {refreshing ? "Se actualizează" : "Actualizează datele"}
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> DATE DESPRE ARBITRAJUL ROMÂNESC</div>
          <h1>Fotbalul românesc,<br /><em>pus pe hartă.</em></h1>
          <p>Descoperă arbitrii, delegările și informările CCA într-o singură interfață clară, organizată pe orașe și județe.</p>
          <a href="#harta" className="primary-cta">Explorează harta <ArrowUpRight size={17} /></a>
        </div>
        <div className="hero-stats" aria-label="Rezumat date">
          <div><strong>{data.officials.length}</strong><span>oficiali în lotul<br />Liga 1</span></div>
          <div><strong>{counties}</strong><span>județe<br />reprezentate</span></div>
          <div><strong>{data.notices.length}</strong><span>informări<br />recente</span></div>
        </div>
      </section>

      <section className="map-section" id="harta">
        <div className="section-heading">
          <div><span className="section-index">01</span><h2>Harta arbitrajului</h2></div>
          <p>Treci cu cursorul peste un oraș pentru a vedea oficialii asociați.</p>
        </div>

        <div className="map-card">
          <div className="map-toolbar">
            <div className="live-pill"><span /> GEOMETRIE GISCO 2024 · DATE CCA</div>
            <ToggleGroup.Root className="map-metric" type="single" value={mapMetric} onValueChange={(value) => value && setMapMetric(value)} aria-label="Filtrează marcajele hărții">
              <ToggleGroup.Item value="all">Toți</ToggleGroup.Item>
              <ToggleGroup.Item value="referees">Arbitri</ToggleGroup.Item>
              <ToggleGroup.Item value="assistants">Asistenți</ToggleGroup.Item>
            </ToggleGroup.Root>
          </div>
          <div className="map-layout">
            <div className="romania-map">
              <RomaniaMap cities={mapCities} activeCity={activeCity} onCityChange={setActiveCity} />
            </div>

            <aside className="city-panel" aria-live="polite">
              <div className="panel-kicker"><MapPin size={14} /> ORAȘ SELECTAT</div>
              <h3>{activeCity}</h3>
              <p className="county-name">{selectedOfficials[0]?.county || "România"}</p>
              <div className="city-number"><strong>{selectedOfficials.length}</strong><span>oficiali<br />în lot</span></div>
              <div className="official-list">
                {selectedOfficials.slice(0, 4).map((official) => (
                  <div key={official.name}>
                    <span className="avatar">{official.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span>
                    <span><strong>{official.name}</strong><small>{official.role} · {official.league}</small></span>
                  </div>
                ))}
                {!selectedOfficials.length && <p>Niciun oficial identificat în sursele curente.</p>}
              </div>
              {selectedOfficials.length > 4 && <button className="more-link" onClick={() => { setQuery(activeCity); document.querySelector("#arbitri")?.scrollIntoView({ behavior: "smooth" }); }}>Vezi toți cei {selectedOfficials.length} oficiali <ArrowUpRight size={14} /></button>}
            </aside>
          </div>
        </div>
      </section>

      <section className="data-section" id="arbitri">
        <div className="section-heading">
          <div><span className="section-index">02</span><h2>Lotul de arbitri</h2></div>
          <p>Informații agregate din lista oficială CCA.</p>
        </div>
        <div className="table-card">
          <div className="table-actions">
            <label className="search-field"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută după nume, oraș sau județ" /></label>
            <Select.Root value={role} onValueChange={setRole}>
              <Select.Trigger className="radix-select-trigger" aria-label="Filtrează după rol">
                <Select.Value />
                <Select.Icon><ChevronDown size={15} /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className="radix-select-content" position="popper" sideOffset={6}>
                  <Select.Viewport>
                    {["Toate rolurile", "Arbitru", "Asistent"].map((item) => (
                      <Select.Item className="radix-select-item" value={item} key={item}>
                        <Select.ItemText>{item}</Select.ItemText>
                        <Select.ItemIndicator><Check size={14} /></Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Nume</th><th>Rol</th><th>Localitate</th><th>Județ</th><th>Lot</th></tr></thead>
              <tbody>{filtered.slice(0, 12).map((official) => (
                <tr key={`${official.name}-${official.role}`} onMouseEnter={() => setActiveCity(official.city)}>
                  <td><span className="table-avatar">{official.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span><strong>{official.name}</strong></td>
                  <td><span className={`role-badge ${official.role === "Asistent" ? "assistant" : ""}`}>{official.role}</span></td>
                  <td>{official.city}</td><td>{official.county}</td><td>{official.league}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="table-footer"><span>Se afișează {Math.min(12, filtered.length)} din {filtered.length} rezultate</span><a href="https://www.frf-cca.ro/arbitri/0/1" target="_blank" rel="noreferrer">Vezi lista completă la CCA <ExternalLink size={13} /></a></div>
        </div>
      </section>

      <section className="updates-section" id="informari">
        <div className="section-heading light">
          <div><span className="section-index">03</span><h2>Ultimele informări</h2></div>
          <a href="https://www.frf-cca.ro/informatii/informari" target="_blank" rel="noreferrer">Toate informările <ArrowUpRight size={15} /></a>
        </div>
        <div className="notice-grid">
          {data.notices.slice(0, 3).map((notice, i) => (
            <a href={notice.url} target="_blank" rel="noreferrer" className="notice-card" key={`${notice.title}-${i}`}>
              <span className="notice-icon">{i === 0 ? <Sparkles size={20} /> : i === 1 ? <ShieldCheck size={20} /> : <CalendarDays size={20} />}</span>
              <small>{notice.date}</small><h3>{notice.title}</h3><span className="read-more">Deschide informarea <ArrowUpRight size={14} /></span>
            </a>
          ))}
        </div>
      </section>

      <section className="sources-section" id="surse">
        <div className="source-intro"><div className="eyebrow"><span /> TRANSPARENȚĂ</div><h2>Date din surse oficiale,<br /><em>într-un singur loc.</em></h2><p>Aplicația verifică paginile HaiLaFotbal și CCA, normalizează informația și păstrează o copie verificată pentru continuitate.</p></div>
        <div className="source-list">
          <div className="source-head"><Database size={18} /> STAREA SURSELOR <span>actualizat {new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" }).format(new Date(data.updatedAt))}</span></div>
          {data.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.name}><span className={`status-light ${source.status}`} /><span><strong>{source.name}</strong><small>{new URL(source.url).hostname}</small></span><span className="source-status">{source.status === "live" ? "ONLINE" : source.status === "redirect" ? "REDIRECT" : "LIMITAT"}</span><ArrowUpRight size={15} /></a>)}
        </div>
      </section>

      <footer><div className="brand footer-brand"><span className="brand-mark"><span /></span><span><strong>HARTA</strong><small>FOTBALULUI</small></span></div><p>Proiect independent de vizualizare. Datele aparțin surselor indicate.</p><div><Clock3 size={14} /> Sincronizare la cerere <span>·</span> <CircleCheck size={14} /> {data.mode === "live" ? "Date live" : "Date verificate"}</div></footer>
    </main>
  );
}
