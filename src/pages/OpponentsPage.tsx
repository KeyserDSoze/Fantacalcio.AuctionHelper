import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import type { AppSnapshot, FantasyTeam, PsychologyProfile } from "@/types";
import { PROFILE_LABELS } from "@/types";
import { teamSnapshot } from "@/lib/analytics";

function TeamEditor({ team, data, onSave }: { team: FantasyTeam; data: AppSnapshot; onSave: (t: FantasyTeam) => Promise<void> }) {
  const [draft, setDraft] = useState(team);
  const toggleClub = (club: string) => setDraft((d) => ({ ...d, supportedClubs: d.supportedClubs.includes(club) ? d.supportedClubs.filter((c) => c !== club) : [...d.supportedClubs, club] }));
  return <Dialog><DialogTrigger asChild><Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5" />Modifica</Button></DialogTrigger><DialogContent><DialogTitle className="text-xl font-bold">{team.name}</DialogTitle><DialogDescription className="text-sm text-muted-foreground">Psicologia e tifo alimentano il modello di collisione.</DialogDescription><div className="mt-5 space-y-5"><div><div className="mb-2 text-sm font-medium">Psicologia</div><Select className="w-full" value={draft.profile} onChange={(e) => setDraft({ ...draft, profile: e.target.value as PsychologyProfile })}>{Object.entries(PROFILE_LABELS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</Select></div><div><div className="mb-2 text-sm font-medium">Squadre tifate</div><div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto rounded-lg border p-3">{data.clubs.length ? data.clubs.map((club) => <button key={club.id} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${draft.supportedClubs.includes(club.name) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`} onClick={() => toggleClub(club.name)}>{club.name}</button>) : <span className="text-sm text-muted-foreground">Importa i giocatori per avere l'elenco delle squadre.</span>}</div></div><Button className="w-full" onClick={() => void onSave(draft)}>Salva modifiche</Button></div></DialogContent></Dialog>;
}

export function OpponentsPage({ data, onTeam }: { data: AppSnapshot; onTeam: (t: FantasyTeam) => Promise<void> }) {
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Psicologia avversari</h1><p className="mt-1 text-muted-foreground">Modifica live profilo e tifo: le stime della schermata asta cambiano subito.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.teams.filter((t) => !t.isMe).map((team) => { const snap = teamSnapshot(team, data.players, data.purchases); return <Card key={team.id}><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>{team.name}</CardTitle><div className="mt-2"><Badge className="border-primary/30 bg-primary/10 text-primary">{PROFILE_LABELS[team.profile]}</Badge></div></div><TeamEditor team={team} data={data} onSave={onTeam} /></CardHeader><CardContent><div className="mb-4 flex flex-wrap gap-1">{team.supportedClubs.length ? team.supportedClubs.map((club) => <Badge key={club}>{club}</Badge>) : <span className="text-xs text-muted-foreground">Nessun tifo impostato</span>}</div><div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center"><div><div className="text-xs text-muted-foreground">Crediti</div><div className="font-bold tabular">{snap.remaining}</div></div><div><div className="text-xs text-muted-foreground">Rosa</div><div className="font-bold tabular">{snap.totalPlayers}/25</div></div><div><div className="text-xs text-muted-foreground">Libero</div><div className="font-bold tabular">{snap.freeBudget}</div></div></div></CardContent></Card> })}</div></div>;
}
