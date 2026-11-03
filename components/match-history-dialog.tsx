"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ExternalLink, MapPin, ShieldCheck, UsersRound, X } from "lucide-react";
import { Dialog, Tabs } from "radix-ui";

type Delegate = { name: string; role: string; county: string };
export type MatchRecord = {
  id: string; date: string; competition: string; round: string; home: string; away: string;
  stadium: string; city: string; county: string; status: string; score?: string | null; delegates: Delegate[];
};
type Official = { name: string; city: string; county: string; role: "Arbitru" | "Asistent"; league: string; profileId?: string };
type Detail = { match: MatchRecord; teamHistory: MatchRecord[]; officialHistory: MatchRecord[] };

function nameKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("ro")
    .replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean).sort().join(" ");
}

function MatchList({ items, empty }: { items: MatchRecord[]; empty: string }) {
  if (!items.length) return <div className="profile-empty"><CalendarDays size={20} /><p>{empty}</p></div>;
  return <div className="history-match-list">{items.map((item) => (
    <div key={item.id}>
      <span><b>{item.home} – {item.away}</b><small>{item.competition} · {item.round}</small></span>
      <span><b>{item.score || "vs"}</b><small>{new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(new Date(item.date))}</small></span>
    </div>
  ))}</div>;
}

export function MatchHistoryDialog({ match, officials, onOpenChange, onOfficialSelect }: {
  match: MatchRecord | null;
  officials: Official[];
  onOpenChange: (open: boolean) => void;
  onOfficialSelect: (official: Official) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!match) return;
    setDetail(null);
    setLoading(true);
    fetch(`/api/match/${encodeURIComponent(match.id)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((value) => setDetail(value as Detail)).catch(() => setDetail({ match, teamHistory: [], officialHistory: [] }))
      .finally(() => setLoading(false));
  }, [match]);

  const current = detail?.match || match;
  const date = current ? new Intl.DateTimeFormat("ro-RO", { dateStyle: "full", timeStyle: "short" }).format(new Date(current.date)) : "";
  return (
    <Dialog.Root open={Boolean(match)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="match-dialog history-dialog" aria-describedby={undefined}>
          <Dialog.Close className="dialog-close" aria-label="Închide"><X size={18} /></Dialog.Close>
          {current && <>
            <span className="dialog-kicker">Meciuri · {current.competition} · {current.round}</span>
            <Dialog.Title><span>{current.home}</span><em>{current.score || "vs"}</em><span>{current.away}</span></Dialog.Title>
            <div className="match-place"><CalendarDays size={15} /><span><b>{date}</b><small>{current.status}</small></span></div>
            <Tabs.Root className="profile-tabs match-tabs" defaultValue="details">
              <Tabs.List>
                <Tabs.Trigger value="details">Detalii</Tabs.Trigger>
                <Tabs.Trigger value="delegates">Brigadă ({current.delegates.length})</Tabs.Trigger>
                <Tabs.Trigger value="teams">Istoric echipe ({detail?.teamHistory.length || 0})</Tabs.Trigger>
                <Tabs.Trigger value="officials">Istoric oficiali ({detail?.officialHistory.length || 0})</Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="details">
                <div className="match-detail-grid">
                  <div><MapPin size={16} /><span><small>Stadion</small><b>{current.stadium}</b><em>{current.city}, {current.county}</em></span></div>
                  <div><ShieldCheck size={16} /><span><small>Competiție</small><b>{current.competition}</b><em>{current.round}</em></span></div>
                  <div><CalendarDays size={16} /><span><small>Data și ora</small><b>{date}</b><em>{current.status}</em></span></div>
                  <div><UsersRound size={16} /><span><small>Brigadă</small><b>{current.delegates.length} oficiali</b><em>{current.delegates.length ? "Delegare publicată" : "Nepublicată"}</em></span></div>
                </div>
              </Tabs.Content>
              <Tabs.Content value="delegates">
                <div className="delegate-list full-delegate-list">
                  {current.delegates.length ? current.delegates.map((delegate) => {
                    const official = officials.find((item) => nameKey(item.name) === nameKey(delegate.name));
                    return <button key={`${delegate.name}-${delegate.role}`} disabled={!official} onClick={() => official && onOfficialSelect(official)}>
                      <span>{delegate.role}</span><b>{delegate.name}</b><small>{delegate.county}{official ? " · deschide istoricul" : ""}</small>
                    </button>;
                  }) : <p>Brigada nu a fost publicată încă.</p>}
                </div>
              </Tabs.Content>
              <Tabs.Content value="teams">{loading ? <div className="profile-loading"><span /><span /><span /></div> : <MatchList items={detail?.teamHistory || []} empty="Nu există alte meciuri în cache pentru aceste echipe." />}</Tabs.Content>
              <Tabs.Content value="officials">{loading ? <div className="profile-loading"><span /><span /><span /></div> : <MatchList items={detail?.officialHistory || []} empty="Nu există alte delegări în cache pentru această brigadă." />}</Tabs.Content>
            </Tabs.Root>
            <a className="dialog-source" href="https://hailafotbal.ro/arbitri/delegari" target="_blank" rel="noreferrer">Deschide sursa <ExternalLink size={13} /></a>
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
