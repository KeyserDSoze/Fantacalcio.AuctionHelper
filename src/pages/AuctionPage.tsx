import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Coins, RotateCcw, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AppSnapshot, AuctionState, Player, Purchase, Role } from "@/types";
import { ROLE_LABELS, ROLE_LIMITS } from "@/types";
import { activeTeamsForState, getSozeCandidates, predictOpponentTargets } from "@/lib/strategy";
import { teamSnapshot } from "@/lib/analytics";
import { clamp, money } from "@/lib/utils";

export function AuctionPage({ data, onAuction, onPurchase }: { data: AppSnapshot; onAuction: (a: AuctionState) => Promise<void>; onPurchase: (purchase: Purchase, player: Player) => Promise<void> }) {
  const [teamId, setTeamId] = useState("soze-heaven");
  const [playerQuery, setPlayerQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const candidates = useMemo(() => getSozeCandidates(data.players, data.clubs, data.teams, data.purchases, data.auction), [data]);
  const predictions = useMemo(() => predictOpponentTargets(data.teams, data.players, data.clubs, data.purchases, data.auction), [data]);
  const active = activeTeamsForState(data.teams, data.purchases, data.auction);
  const activeIds = new Set(active.map((t) => t.id));
  const snapshots = data.teams.map((t) => teamSnapshot(t, data.players, data.purchases)).sort((a,b) => b.remaining-a.remaining);
  const selectedTeam = data.teams.find((t) => t.id === teamId)!;
  const selectedPlayer = data.players.find((p) => p.id === selectedPlayerId);
  const availableSearch = data.players.filter((p) => p.status === "AVAILABLE" && `${p.name} ${p.club}`.toLowerCase().includes(playerQuery.toLowerCase())).slice(0, 10);
  const maxChoice = ROLE_LIMITS[data.auction.currentRole];

  const setPhase = (role: Role, choice = 1) => void onAuction({ key: "auction", currentRole: role, choiceNumber: choice, subRound: 1, resolvedTeamIds: [] });
  const nextSubRound = () => void onAuction({ ...data.auction, subRound: data.auction.subRound + 1 });
  const nextChoice = () => {
    if (data.auction.choiceNumber < maxChoice) void onAuction({ ...data.auction, choiceNumber: data.auction.choiceNumber + 1, subRound: 1, resolvedTeamIds: [] });
  };

  const register = async () => {
    setError("");
    if (!selectedPlayer || !selectedTeam) return setError("Seleziona squadra e giocatore.");
    const numericPrice = Number(price);
    if (!numericPrice || numericPrice < selectedPlayer.basePrice) return setError(`Offerta minima: ${selectedPlayer.basePrice} crediti.`);
    const snap = teamSnapshot(selectedTeam, data.players, data.purchases);
    if (numericPrice > snap.remaining) return setError(`Budget insufficiente: ${snap.remaining} crediti rimasti.`);
    const purchase: Purchase = { id: `${Date.now()}-${selectedPlayer.id}`, playerId: selectedPlayer.id, fantasyTeamId: selectedTeam.id, price: numericPrice, role: selectedPlayer.role, choiceNumber: data.auction.choiceNumber, subRound: data.auction.subRound, timestamp: Date.now() };
    const updatedPlayer: Player = { ...selectedPlayer, status: "WON", ownerId: selectedTeam.id, purchasePrice: numericPrice };
    await onPurchase(purchase, updatedPlayer);
    if (selectedPlayer.role === data.auction.currentRole && activeIds.has(selectedTeam.id)) await onAuction({ ...data.auction, resolvedTeamIds: [...data.auction.resolvedTeamIds, selectedTeam.id] });
    setSelectedPlayerId(""); setPlayerQuery(""); setPrice("");
  };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><h1 className="text-3xl font-bold">Gestione asta</h1><p className="mt-1 text-muted-foreground">Basket dinamico, rollover dei target e previsione degli avversari ancora attivi.</p></div><div className="flex flex-wrap gap-2">{(["P","D","C","A"] as Role[]).map((r) => <Button key={r} variant={data.auction.currentRole === r ? "default" : "outline"} onClick={() => setPhase(r)}>{r} · {ROLE_LABELS[r]}</Button>)}</div></div>

    <div className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Fase</div><div className="mt-1 text-2xl font-bold">{ROLE_LABELS[data.auction.currentRole]}</div></CardContent></Card>
      <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Scelta</div><div className="mt-1 text-2xl font-bold">{data.auction.choiceNumber}/{maxChoice} <span className="text-sm font-normal text-muted-foreground">· sottoround {data.auction.subRound}</span></div></CardContent></Card>
      <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Ancora in gioco</div><div className="mt-1 text-2xl font-bold">{active.length}/9</div></CardContent></Card>
    </div>

    <div className="grid gap-6 2xl:grid-cols-[1.15fr_.85fr]">
      <div className="space-y-6">
        <Card><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle>Le nostre migliori chiamate</CardTitle><div className="mt-1 text-sm text-muted-foreground">Include automaticamente i target delle scelte precedenti ancora liberi.</div></div><Sparkles className="h-5 w-5 text-primary" /></CardHeader><CardContent className="space-y-3">
          {candidates.slice(0, 12).map((candidate, index) => <div key={candidate.player.id} className="rounded-xl border p-4"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-start"><div className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary">{index+1}</div><div><div className="flex flex-wrap items-center gap-2"><span className="text-lg font-bold">{candidate.player.name}</span><Badge>{candidate.player.club}</Badge><Badge>{candidate.player.role}</Badge>{candidate.rolledOver && <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600">ROLLOVER</Badge>}</div><div className="mt-1 text-sm text-muted-foreground">Quota {candidate.player.basePrice} · Tier personale {candidate.player.priorityTier ?? "—"} · pianificato {candidate.player.targetChoice ? `${candidate.player.targetChoice}ª` : "—"}</div></div></div><div className="text-right"><div className="text-xs text-muted-foreground">Recommendation</div><div className="text-2xl font-black text-primary">{Math.round(candidate.recommendationScore*100)}</div></div></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.2fr]"><div><div className="mb-1 flex justify-between text-xs"><span>Rischio collisione</span><span className={candidate.collisionRisk > .5 ? "text-red-500" : candidate.collisionRisk > .25 ? "text-amber-500" : "text-primary"}>{Math.round(candidate.collisionRisk*100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${clamp(candidate.collisionRisk)*100}%`}} /></div><div className="mt-2 text-xs text-muted-foreground">{candidate.reason}</div></div><div><div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Possibili collisioni</div><div className="flex flex-wrap gap-2">{candidate.contenders.length ? candidate.contenders.slice(0,4).map((c) => <Badge key={c.team.id}>{c.team.name} · {Math.round(c.probability*100)}%</Badge>) : <span className="text-xs text-muted-foreground">Nessun avversario con probabilità rilevante.</span>}</div></div></div>
          </div>)}
          {!candidates.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nessun target configurato per questa scelta. Vai su Giocatori e assegna tier/scelta pianificata.</div>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Papabili avversari nel sottoround</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
          {active.filter((t) => !t.isMe).map((team) => <div key={team.id} className="rounded-xl border p-4"><div className="mb-3 flex items-center justify-between"><div className="font-semibold">{team.name}</div><Badge>{team.profile.replace(/_/g," ")}</Badge></div><div className="space-y-2">{(predictions.get(team.id) ?? []).slice(0,3).map((prediction) => { const player = data.players.find((p) => p.id === prediction.playerId)!; return <div key={prediction.playerId} className="flex items-center justify-between text-sm"><div><span className="font-medium">{player.name}</span><span className="ml-2 text-xs text-muted-foreground">{player.club}</span></div><span className="tabular text-muted-foreground">{Math.round(prediction.probability*100)}%</span></div> })}</div></div>)}
        </CardContent></Card>
      </div>

      <div className="space-y-6">
        <Card><CardHeader><CardTitle>Registra acquisto</CardTitle></CardHeader><CardContent className="space-y-4"><div><div className="mb-1.5 text-sm font-medium">Squadra</div><Select className="w-full" value={teamId} onChange={(e) => setTeamId(e.target.value)}>{snapshots.map((t) => <option value={t.id} key={t.id}>{t.name} · {t.remaining} cr.</option>)}</Select></div><div><div className="mb-1.5 text-sm font-medium">Giocatore</div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={selectedPlayer ? selectedPlayer.name : playerQuery} onChange={(e) => { setSelectedPlayerId(""); setPlayerQuery(e.target.value); }} placeholder="Cerca tra i giocatori liberi…" />{!selectedPlayerId && playerQuery && <div className="absolute z-20 mt-1 w-full rounded-lg border bg-background p-1 shadow-xl">{availableSearch.map((p) => <button key={p.id} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => {setSelectedPlayerId(p.id); setPlayerQuery(p.name); setPrice(String(p.basePrice));}}><span><strong>{p.name}</strong> <span className="text-muted-foreground">· {p.club}</span></span><Badge>{p.role} · {p.basePrice}</Badge></button>)}</div>}</div></div><div><div className="mb-1.5 text-sm font-medium">Prezzo</div><Input type="number" min={selectedPlayer?.basePrice ?? 1} value={price} onChange={(e) => setPrice(e.target.value)} /></div>{selectedPlayer && <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Minimo FantaMaster: <strong className="text-foreground">{selectedPlayer.basePrice}</strong>. Budget {selectedTeam.name}: <strong className="text-foreground">{teamSnapshot(selectedTeam,data.players,data.purchases).remaining}</strong>.</div>}{error && <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}<Button className="w-full" onClick={() => void register()}><CheckCircle2 className="h-4 w-4" />Assegna giocatore</Button></CardContent></Card>

        <Card><CardHeader><CardTitle>Stato squadre</CardTitle></CardHeader><CardContent className="space-y-2">{snapshots.map((team) => <div key={team.id} className={`flex items-center justify-between rounded-lg border p-3 ${activeIds.has(team.id) ? "border-primary/30 bg-primary/5" : "opacity-65"}`}><div><div className="text-sm font-semibold">{team.name}</div><div className="text-xs text-muted-foreground">{activeIds.has(team.id) ? "Ancora attivo" : "Risolto / fuori fase"}</div></div><div className="flex items-center gap-2"><Coins className="h-4 w-4 text-muted-foreground" /><span className="font-bold tabular">{money(team.remaining)}</span></div></div>)}</CardContent></Card>

        <Card><CardHeader><CardTitle>Controlli tornata</CardTitle></CardHeader><CardContent className="space-y-2"><Button variant="outline" className="w-full justify-between" onClick={nextSubRound}>Nuovo sottoround <RotateCcw className="h-4 w-4" /></Button><Button className="w-full justify-between" disabled={data.auction.choiceNumber >= maxChoice} onClick={nextChoice}>Prossima scelta <ArrowRight className="h-4 w-4" /></Button><div className="pt-2 text-xs text-muted-foreground">Il nuovo sottoround mantiene fuori le squadre già risolte. La prossima scelta riattiva tutte le squadre che hanno ancora slot nel reparto.</div></CardContent></Card>
      </div>
    </div>
  </div>;
}
