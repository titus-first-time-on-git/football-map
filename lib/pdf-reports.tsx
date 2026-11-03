import React from "react";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

Font.register({
  family: "Noto Sans",
  fonts: [
    { src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.2.9/files/noto-sans-latin-ext-400-normal.woff", fontWeight: 400 },
    { src: "https://cdn.jsdelivr.net/npm/@fontsource/noto-sans@5.2.9/files/noto-sans-latin-ext-700-normal.woff", fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

type Assignment = { teams: string; score: string; stadium: string; city: string; season: string; competition: string; dateLabel: string; date: string };
type Official = { name: string; city: string; county: string; role: "Arbitru" | "Asistent"; league: string; profileId?: string };
type Profile = {
  totalMatches: number; seasons: number; upcoming: Assignment[]; assignments: Assignment[];
  competitions: Array<{ competition: string; matches: number }>;
};
type Delegate = { name: string; role: string; county: string };
type Match = { id: string; date: string; competition: string; round: string; home: string; away: string; stadium: string; city: string; county: string; status: string; score?: string | null; delegates: Delegate[] };
type MatchDetail = { match: Match; teamHistory: Match[]; officialHistory: Match[] };

const navy = "#182238";
const blue = "#2f76d2";
const pale = "#edf2f8";
const line = "#dbe2eb";
const muted = "#657084";

const styles = StyleSheet.create({
  page: { padding: "34 36 42", fontFamily: "Noto Sans", fontSize: 8, color: navy, backgroundColor: "#ffffff" },
  hero: { backgroundColor: navy, borderRadius: 8, padding: "18 20 16", marginBottom: 18 },
  heroTitle: { color: "#ffffff", fontSize: 24, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
  heroMeta: { color: "#cbd4e3", fontSize: 9, marginTop: 5 },
  badgeRow: { flexDirection: "row", marginTop: 7 },
  badge: { color: "#ffffff", backgroundColor: blue, padding: "3 6", marginRight: 5, fontSize: 8 },
  metrics: { flexDirection: "row", marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#33415d" },
  metric: { flexGrow: 1, flexBasis: 0, borderRightWidth: 1, borderRightColor: "#33415d", paddingHorizontal: 8 },
  metricLast: { flexGrow: 1, flexBasis: 0, paddingHorizontal: 8 },
  metricValue: { color: "#ffffff", fontSize: 18, fontWeight: 700, textAlign: "center" },
  metricLabel: { color: "#aeb9cb", fontSize: 6.5, textAlign: "center", textTransform: "uppercase", marginTop: 2 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", marginBottom: 7, letterSpacing: 0.2 },
  cards: { flexDirection: "row", gap: 7 },
  card: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderColor: line, borderRadius: 5, padding: 9 },
  cardLabel: { color: muted, fontSize: 6.5, textTransform: "uppercase" },
  cardValue: { fontSize: 10, fontWeight: 700, marginTop: 3 },
  cardSub: { color: muted, fontSize: 7, marginTop: 2 },
  table: { borderWidth: 1, borderColor: line, borderRadius: 4, overflow: "hidden" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: line, minHeight: 25, alignItems: "center" },
  rowLast: { flexDirection: "row", minHeight: 25, alignItems: "center" },
  headerRow: { flexDirection: "row", backgroundColor: pale, minHeight: 23, alignItems: "center", borderBottomWidth: 1, borderBottomColor: line },
  cell: { padding: "5 6", fontSize: 7 },
  cellStrong: { padding: "5 6", fontSize: 7, fontWeight: 700 },
  colDate: { width: "15%" }, colMain: { width: "39%" }, colComp: { width: "25%" }, colPlace: { width: "14%" }, colScore: { width: "7%", textAlign: "right" },
  colRole: { width: "22%" }, colName: { width: "53%" }, colCounty: { width: "25%" },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  barLabel: { width: 62, fontSize: 7 }, barTrack: { flexGrow: 1, height: 8, backgroundColor: pale, borderRadius: 2 },
  barFill: { height: 8, backgroundColor: blue, borderRadius: 2 }, barValue: { width: 28, textAlign: "right", fontSize: 7, fontWeight: 700 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 18, paddingTop: 6, borderTopWidth: 1, borderTopColor: line, flexDirection: "row", justifyContent: "space-between", color: muted, fontSize: 6.5 },
  pageHeading: { fontSize: 15, fontWeight: 700, marginBottom: 4 },
  pageSub: { color: muted, fontSize: 8, marginBottom: 13 },
  note: { color: muted, fontSize: 7, lineHeight: 1.4, marginTop: 8 },
});

function Footer() {
  return <View style={styles.footer} fixed><Text>HARTA FOTBALULUI · raport generat automat</Text><Text render={({ pageNumber, totalPages }) => `pagina ${pageNumber} din ${totalPages}`} /></View>;
}
function Metric({ value, label, last = false }: { value: string | number; label: string; last?: boolean }) {
  return <View style={last ? styles.metricLast : styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}
function chunks<T>(items: T[], size: number) { const result: T[][] = []; for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size)); return result; }
function formatDate(value: string) { try { return new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); } catch { return value; } }

function AssignmentTable({ items }: { items: Assignment[] }) {
  return <View style={styles.table}>
    <View style={styles.headerRow}><Text style={[styles.cellStrong, styles.colDate]}>Data</Text><Text style={[styles.cellStrong, styles.colMain]}>Meci</Text><Text style={[styles.cellStrong, styles.colComp]}>Competiție</Text><Text style={[styles.cellStrong, styles.colPlace]}>Localitate</Text><Text style={[styles.cellStrong, styles.colScore]}>Scor</Text></View>
    {items.map((item, index) => <View key={`${item.date}-${index}`} style={index === items.length - 1 ? styles.rowLast : styles.row} wrap={false}>
      <Text style={[styles.cell, styles.colDate]}>{formatDate(item.date)}</Text><Text style={[styles.cellStrong, styles.colMain]}>{item.teams}</Text>
      <Text style={[styles.cell, styles.colComp]}>{item.competition} · {item.season}</Text><Text style={[styles.cell, styles.colPlace]}>{item.city || item.stadium || "—"}</Text><Text style={[styles.cellStrong, styles.colScore]}>{item.score || "—"}</Text>
    </View>)}
  </View>;
}

function MatchTable({ items }: { items: Match[] }) {
  return <View style={styles.table}>
    <View style={styles.headerRow}><Text style={[styles.cellStrong, styles.colDate]}>Data</Text><Text style={[styles.cellStrong, styles.colMain]}>Meci</Text><Text style={[styles.cellStrong, styles.colComp]}>Competiție</Text><Text style={[styles.cellStrong, styles.colPlace]}>Localitate</Text><Text style={[styles.cellStrong, styles.colScore]}>Scor</Text></View>
    {items.map((item, index) => <View key={item.id} style={index === items.length - 1 ? styles.rowLast : styles.row} wrap={false}>
      <Text style={[styles.cell, styles.colDate]}>{formatDate(item.date)}</Text><Text style={[styles.cellStrong, styles.colMain]}>{item.home} – {item.away}</Text>
      <Text style={[styles.cell, styles.colComp]}>{item.competition} · {item.round}</Text><Text style={[styles.cell, styles.colPlace]}>{item.city || "—"}</Text><Text style={[styles.cellStrong, styles.colScore]}>{item.score || "—"}</Text>
    </View>)}
  </View>;
}

function OfficialDocument({ official, profile }: { official: Official; profile: Profile }) {
  const seasonCounts = [...new Map(profile.assignments.map((item) => [item.season, 0])).keys()].map((season) => ({ season, count: profile.assignments.filter((item) => item.season === season).length }));
  const maxSeason = Math.max(1, ...seasonCounts.map((item) => item.count));
  const cityCounts = new Map<string, number>();
  for (const item of profile.assignments) if (item.city) cityCounts.set(item.city, (cityCounts.get(item.city) || 0) + 1);
  const topCity = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const historyPages = chunks(profile.assignments, 31);
  return <Document title={`${official.name} - raport ${official.role.toLowerCase()}`} author="Harta Fotbalului">
    <Page size="A4" style={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{official.name}</Text><Text style={styles.heroMeta}>{official.city} · {official.county}</Text>
        <View style={styles.badgeRow}><Text style={styles.badge}>{official.role.toUpperCase()}</Text><Text style={styles.badge}>{official.league}</Text></View>
        <View style={styles.metrics}><Metric value={profile.totalMatches} label="meciuri"/><Metric value={profile.seasons} label="sezoane"/><Metric value={profile.competitions.length} label="competiții"/><Metric value={profile.upcoming.length} label="delegări viitoare" last/></View>
      </View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Rezumat activitate</Text><View style={styles.cards}>
        <View style={styles.card}><Text style={styles.cardLabel}>Primul meci din arhivă</Text><Text style={styles.cardValue}>{profile.assignments.at(-1) ? formatDate(profile.assignments.at(-1)!.date) : "—"}</Text><Text style={styles.cardSub}>{profile.assignments.at(-1)?.teams || "Fără date"}</Text></View>
        <View style={styles.card}><Text style={styles.cardLabel}>Cel mai recent meci</Text><Text style={styles.cardValue}>{profile.assignments[0] ? formatDate(profile.assignments[0].date) : "—"}</Text><Text style={styles.cardSub}>{profile.assignments[0]?.teams || "Fără date"}</Text></View>
        <View style={styles.card}><Text style={styles.cardLabel}>Localitatea principală</Text><Text style={styles.cardValue}>{topCity?.[0] || "—"}</Text><Text style={styles.cardSub}>{topCity ? `${topCity[1]} meciuri` : "Fără date"}</Text></View>
      </View></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Meciuri pe sezoane</Text>{seasonCounts.map((item) => <View style={styles.barRow} key={item.season}><Text style={styles.barLabel}>{item.season}</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.max(3, (item.count / maxSeason) * 100)}%` }]} /></View><Text style={styles.barValue}>{item.count}</Text></View>)}</View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Competiții principale</Text><View style={styles.table}>{profile.competitions.slice(0, 12).map((item, index) => <View key={item.competition} style={index === Math.min(11, profile.competitions.length - 1) ? styles.rowLast : styles.row}><Text style={[styles.cell, { width: "82%" }]}>{item.competition}</Text><Text style={[styles.cellStrong, { width: "18%", textAlign: "right" }]}>{item.matches}</Text></View>)}</View></View>
      <Text style={styles.note}>Raportul conține exclusiv datele disponibile în arhiva aplicației la momentul generării.</Text><Footer />
    </Page>
    {historyPages.map((items, index) => <Page size="A4" style={styles.page} key={index}><Text style={styles.pageHeading}>Istoric complet</Text><Text style={styles.pageSub}>{official.name} · {official.role} · {items.length} înregistrări pe această pagină</Text><AssignmentTable items={items}/><Footer/></Page>)}
  </Document>;
}

function MatchDocument({ detail }: { detail: MatchDetail }) {
  const { match } = detail;
  const historyPages = chunks(detail.teamHistory, 31);
  const officialPages = chunks(detail.officialHistory, 31);
  return <Document title={`${match.home} - ${match.away} - raport meci`} author="Harta Fotbalului">
    <Page size="A4" style={styles.page}>
      <View style={styles.hero}><Text style={styles.heroTitle}>{match.home} – {match.away}</Text><Text style={styles.heroMeta}>{match.competition} · {match.round}</Text>
        <View style={styles.badgeRow}><Text style={styles.badge}>{match.status.toUpperCase()}</Text><Text style={styles.badge}>{formatDate(match.date)}</Text></View>
        <View style={styles.metrics}><Metric value={match.score || "VS"} label="scor"/><Metric value={match.delegates.length} label="oficiali"/><Metric value={detail.teamHistory.length} label="istoric echipe"/><Metric value={detail.officialHistory.length} label="istoric brigadă" last/></View>
      </View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Datele meciului</Text><View style={styles.cards}>
        <View style={styles.card}><Text style={styles.cardLabel}>Data și ora</Text><Text style={styles.cardValue}>{new Intl.DateTimeFormat("ro-RO", { dateStyle: "long", timeStyle: "short" }).format(new Date(match.date))}</Text></View>
        <View style={styles.card}><Text style={styles.cardLabel}>Stadion</Text><Text style={styles.cardValue}>{match.stadium}</Text><Text style={styles.cardSub}>{match.city}, {match.county}</Text></View>
        <View style={styles.card}><Text style={styles.cardLabel}>Competiție</Text><Text style={styles.cardValue}>{match.competition}</Text><Text style={styles.cardSub}>{match.round}</Text></View>
      </View></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Brigada completă</Text><View style={styles.table}>
        <View style={styles.headerRow}><Text style={[styles.cellStrong, styles.colRole]}>Rol</Text><Text style={[styles.cellStrong, styles.colName]}>Nume</Text><Text style={[styles.cellStrong, styles.colCounty]}>Comisie / județ</Text></View>
        {match.delegates.length ? match.delegates.map((item, index) => <View key={`${item.name}-${item.role}`} style={index === match.delegates.length - 1 ? styles.rowLast : styles.row}><Text style={[styles.cell, styles.colRole]}>{item.role}</Text><Text style={[styles.cellStrong, styles.colName]}>{item.name}</Text><Text style={[styles.cell, styles.colCounty]}>{item.county || "—"}</Text></View>) : <View style={styles.rowLast}><Text style={styles.cell}>Brigada nu a fost publicată.</Text></View>}
      </View></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>Context</Text><View style={styles.cards}><View style={styles.card}><Text style={styles.cardLabel}>Meciuri asociate echipelor</Text><Text style={styles.cardValue}>{detail.teamHistory.length}</Text></View><View style={styles.card}><Text style={styles.cardLabel}>Meciuri asociate oficialilor</Text><Text style={styles.cardValue}>{detail.officialHistory.length}</Text></View></View></View>
      <Text style={styles.note}>Istoricul este calculat din meciurile disponibile în baza aplicației la momentul generării.</Text><Footer/>
    </Page>
    {historyPages.map((items, index) => <Page size="A4" style={styles.page} key={`teams-${index}`}><Text style={styles.pageHeading}>Istoric echipe</Text><Text style={styles.pageSub}>{match.home} / {match.away}</Text><MatchTable items={items}/><Footer/></Page>)}
    {officialPages.map((items, index) => <Page size="A4" style={styles.page} key={`officials-${index}`}><Text style={styles.pageHeading}>Istoric brigadă</Text><Text style={styles.pageSub}>Meciuri în care apar oficialii delegați</Text><MatchTable items={items}/><Footer/></Page>)}
  </Document>;
}

export function renderOfficialPdf(input: { official: Official; profile: Profile }) { return renderToBuffer(<OfficialDocument {...input}/>); }
export function renderMatchPdf(detail: MatchDetail) { return renderToBuffer(<MatchDocument detail={detail}/>); }
