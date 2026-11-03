"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, CalendarDays, ExternalLink, MapPin, ShieldCheck, X } from "lucide-react";
import { Dialog, Tabs } from "radix-ui";

type Official = {
  name: string;
  city: string;
  county: string;
  role: "Arbitru" | "Asistent";
  league: string;
  profileId?: string;
};

type Assignment = {
  teams: string;
  score: string;
  stadium: string;
  city: string;
  season: string;
  competition: string;
  dateLabel: string;
  date: string;
};

type Profile = {
  url: string;
  totalMatches: number;
  seasons: number;
  upcoming: Assignment[];
  recent: Assignment[];
  assignments: Assignment[];
  competitions: Array<{ competition: string; matches: number }>;
  updatedAt?: string;
};

function key(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro")
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

const fifaNames = new Set([
  "Istvan Kovacs", "Marian Barbu", "Radu Petrescu", "Horațiu Feșnic", "Andrei Chivulete",
  "Rareș Vidican", "Szabolcs Kovacs", "Iuliana Demetrescu", "Alina Peșu", "Ana Maria Terteleac",
  "Roxana Timiș", "Mihai Marica", "Mircea Grigoriu", "Ferencz Tunyogi", "Valentin Avram",
  "George Neacșu", "Alexandru Cerei", "Marius Badea", "Alexandru Corb", "Adrian Vornicu",
  "Roxana Ivanov", "Daniela Constantinescu", "Cătălina Nan", "Diana Florea", "Andreea Șușcă",
  "Ana Pușcașu", "Ilinca Mazga",
].map(key));

const varNames = new Set([
  "Cătălin Popa", "Ovidiu Hațegan", "Sebastian Colțescu", "Sorin Costreie", "Marcel Bîrsan",
  "Radu Petrescu", "Iulian Dima", "Andrei Chivulete", "Florin Andrei", "Cristina Trandafir",
  "Iuliana Demetrescu", "Alina Peșu",
].map(key));

function AssignmentList({ items, empty }: { items: Assignment[]; empty: string }) {
  if (!items.length) return <div className="profile-empty"><CalendarDays size={20} /><p>{empty}</p></div>;
  return (
    <div className="profile-assignment-list">
      {items.map((assignment, index) => (
        <div className="profile-assignment" key={`${assignment.date}-${index}`}>
          <div><strong>{assignment.teams}</strong><span>{assignment.competition} · {assignment.season}</span><span>{assignment.stadium}{assignment.city ? ` · ${assignment.city}` : ""}</span></div>
          <div><strong>{assignment.score || "–"}</strong><span>{assignment.dateLabel}</span></div>
        </div>
      ))}
    </div>
  );
}

export function RefereeProfileDialog({
  official,
  open,
  onOpenChange,
}: {
  official: Official | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !official?.profileId) return;
    setLoading(true);
    setProfile(null);
    fetch(`/api/referee/${official.profileId}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((value) => setProfile(value as Profile))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [open, official?.profileId]);

  const badges = useMemo(() => {
    if (!official) return [];
    const normalized = key(official.name);
    const result = [official.league];
    if ([...fifaNames].some((name) => normalized.includes(name) || name.includes(normalized))) result.push("FIFA 2026");
    if ([...varNames].some((name) => normalized.includes(name) || name.includes(normalized))) result.push("VAR");
    return result;
  }, [official]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="profile-dialog" aria-describedby={undefined}>
          <Dialog.Close className="dialog-close" aria-label="Închide"><X size={18} /></Dialog.Close>
          {official && (
            <>
              <div className="profile-header">
                <div className="profile-monogram">{official.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
                <div>
                  <p>{official.role}</p>
                  <Dialog.Title>{official.name}</Dialog.Title>
                  <span><MapPin size={13} /> {official.city}, {official.county}</span>
                </div>
              </div>
              <div className="profile-badges">
                {badges.map((badge) => <span key={badge}><ShieldCheck size={12} /> {badge}</span>)}
              </div>

              {loading ? (
                <div className="profile-loading"><span /><span /><span /></div>
              ) : profile ? (
                <>
                  <div className="profile-stats">
                    <div><strong>{profile.totalMatches}</strong><span>meciuri în arhivă</span></div>
                    <div><strong>{profile.seasons}</strong><span>sezoane active</span></div>
                    <div><strong>{profile.upcoming.length}</strong><span>delegări viitoare</span></div>
                  </div>
                  <Tabs.Root className="profile-tabs" defaultValue="history">
                    <Tabs.List>
                      <Tabs.Trigger value="history">Istoric complet ({profile.assignments.length})</Tabs.Trigger>
                      <Tabs.Trigger value="upcoming">Urmează</Tabs.Trigger>
                      <Tabs.Trigger value="competitions">Competiții</Tabs.Trigger>
                    </Tabs.List>
                    <Tabs.Content value="history"><AssignmentList items={profile.assignments} empty="Nu există meciuri în profil." /></Tabs.Content>
                    <Tabs.Content value="upcoming"><AssignmentList items={profile.upcoming} empty="Nicio delegare viitoare publicată încă." /></Tabs.Content>
                    <Tabs.Content value="competitions">
                      <div className="competition-breakdown">
                        {profile.competitions.map((item) => (
                          <div key={item.competition}><span>{item.competition}</span><strong>{item.matches}</strong></div>
                        ))}
                      </div>
                    </Tabs.Content>
                  </Tabs.Root>
                  <a className="profile-source-link" href={profile.url} target="_blank" rel="noreferrer">
                    Profilul complet CCA <ExternalLink size={13} />
                  </a>
                </>
              ) : (
                <div className="profile-empty"><Award size={20} /><p>Profilul istoric nu este disponibil momentan.</p></div>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
