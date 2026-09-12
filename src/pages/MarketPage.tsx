import { useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { observedBehavior, purchaseBudgetImpact, teamSnapshot } from "@/lib/analytics";
import { money } from "@/lib/utils";
import type { AppSnapshot, ObservedBid, Purchase, Role } from "@/types";
import { ROLE_LABELS } from "@/types";

export function MarketPage({
  data,
  onUndoPurchase,
  onDeleteBid,
}: {
  data: AppSnapshot;
  onUndoPurchase: (purchase: Purchase) => Promise<void>;
  onDeleteBid: (bid: ObservedBid) => Promise<void>;
}) {
  const [teamId, setTeamId] = useState("all");
  const [role, setRole] = useState<"all" | Role>("all");
  const [detailTeamId, setDetailTeamId] = useState("soze-heaven");

  const events = useMemo(() => {
    const wins = data.purchases
      .filter((purchase) => !purchase.bundleId || purchase.pricePending || purchaseBudgetImpact(purchase) > 0)
      .map((purchase) => {
        const bundle = purchase.bundleId ? data.purchases.filter((item) => item.bundleId === purchase.bundleId) : [purchase];
        const baseReference = Math.max(0, ...bundle.map((item) => data.players.find((player) => player.id === item.playerId)?.basePrice ?? 0));
        return {
          id: purchase.id,
          kind: "WON" as const,
          teamId: purchase.fantasyTeamId,
          playerId: purchase.playerId,
          label: purchase.bundleLabel,
          amount: purchaseBudgetImpact(purchase),
          pending: Boolean(purchase.pricePending),
          baseReference,
          role: purchase.role,
          choiceNumber: purchase.choiceNumber,
          subRound: purchase.subRound,
          timestamp: purchase.timestamp,
          purchase,
        };
      });
    const observations = data.bids.map((bid) => ({
      id: bid.id,
      kind: bid.result,
      teamId: bid.fantasyTeamId,
      playerId: bid.playerId,
      label: undefined as string | undefined,
      amount: bid.amount,
      pending: false,
      baseReference: bid.referenceBasePrice ?? data.players.find((player) => player.id === bid.playerId)?.basePrice ?? 0,
      role: bid.role,
      choiceNumber: bid.choiceNumber,
      subRound: bid.subRound,
      timestamp: bid.timestamp,
      bid,
    }));
    return [...wins, ...observations]
      .filter((event) => teamId === "all" || event.teamId === teamId)
      .filter((event) => role === "all" || event.role === role)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [data, teamId, role]);

  const detailTeam = data.teams.find((team) => team.id === detailTeamId) ?? data.teams[0];
  const snap = teamSnapshot(detailTeam, data.players, data.purchases);
  const behavior = observedBehavior(detailTeam, data.players, data.purchases, data.bids);
  const roster = data.purchases
    .filter((purchase) => purchase.fantasyTeamId === detailTeam.id)
    .map((purchase) => ({ purchase, player: data.players.find((player) => player.id === purchase.playerId) }))
    .filter((item) => item.player)
    .sort((a, b) => a.purchase.role.localeCompare(b.purchase.role) || b.purchase.price - a.purchase.price);
  const latestPurchase = [...data.purchases].filter((purchase) => !purchase.bundleId || purchase.pricePending || purchaseBudgetImpact(purchase) > 0).sort((a, b) => b.timestamp - a.timestamp)[0];

  return <div className="space-y-4 sm:space-y-6">
    <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Mercato & storico</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">Ogni acquisto e ogni busta osservata diventano memoria dell'asta e dati per il modello.</p></div>

    <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.2fr_.8fr]">
      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between"><CardTitle>Timeline asta</CardTitle><div className="grid gap-2 sm:grid-cols-2"><Select className="w-full" value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="all">Tutte le squadre</option>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select><Select className="w-full" value={role} onChange={(event) => setRole(event.target.value as "all" | Role)}><option value="all">Tutti i ruoli</option>{(["P", "D", "C", "A"] as Role[]).map((item) => <option key={item} value={item}>{ROLE_LABELS[item]}</option>)}</Select></div></CardHeader>
        <CardContent className="space-y-2 px-3 pb-4 sm:px-6 sm:pb-6">
          {!events.length && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nessun evento con questi filtri.</div>}
          {events.map((event) => {
            const player = data.players.find((item) => item.id === event.playerId);
            const team = data.teams.find((item) => item.id === event.teamId);
            const ratio = !event.pending && event.baseReference ? event.amount / event.baseReference : 0;
            return <div key={`${event.kind}-${event.id}`} className="rounded-xl border p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge className={event.kind === "WON" ? "border-primary/30 bg-primary/10 text-primary" : event.kind === "TIED" ? "border-amber-500/30 bg-amber-500/10 text-amber-600" : ""}>{event.kind === "WON" ? "PRESO" : event.kind === "TIED" ? "PARI" : "PERSA"}</Badge>{event.pending && <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600">PREZZO DA INSERIRE</Badge>}<span className="truncate font-semibold">{event.label ?? player?.name ?? "Giocatore"}</span></div><div className="mt-1 truncate text-xs text-muted-foreground">{team?.name} · {event.role} · scelta {event.choiceNumber}, round {event.subRound}</div><div className="mt-1 text-[11px] text-muted-foreground">quota {event.baseReference || "—"} · {event.pending ? "prezzo non ancora registrato" : ratio ? `${ratio.toFixed(2)}× quota` : "—"}</div></div><div className="shrink-0 text-right"><div className="text-xl font-black tabular">{event.pending ? "—" : event.amount}</div><div className="mt-2 flex justify-end gap-1">{event.kind === "WON" && latestPurchase?.id === event.id && <Button size="sm" variant="outline" onClick={() => void onUndoPurchase(event.purchase)}><RotateCcw className="h-4 w-4" /><span className="hidden sm:inline">Undo</span></Button>}{event.kind !== "WON" && <Button size="icon" variant="ghost" onClick={() => void onDeleteBid(event.bid)}><Trash2 className="h-4 w-4" /></Button>}</div></div></div></div>;
          })}
        </CardContent>
      </Card>

      <div className="space-y-4 sm:space-y-6">
        <Card><CardHeader><CardTitle>Dettaglio squadra</CardTitle></CardHeader><CardContent className="space-y-4"><Select className="w-full" value={detailTeam.id} onChange={(event) => setDetailTeamId(event.target.value)}>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select><div className="grid grid-cols-2 gap-2 sm:gap-3"><Metric label="Crediti" value={money(snap.remaining)} /><Metric label="Spesi" value={money(snap.spent)} /><Metric label="Rosa" value={`${snap.totalPlayers}/25`} /><Metric label="Budget libero" value={money(snap.freeBudget)} /></div>{snap.pendingPrices > 0 && <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600">Questa squadra ha {snap.pendingPrices} {snap.pendingPrices === 1 ? "prezzo mancante" : "prezzi mancanti"}; i crediti mostrati sono quindi provvisori.</div>}<div className="rounded-xl border p-3 sm:p-4"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comportamento osservato</div><div className="mt-2 flex items-end justify-between gap-3"><div><div className="text-2xl font-black">{behavior.multiplier.toFixed(2)}×</div><div className="text-xs text-muted-foreground">aggressività relativa alla lega</div></div><Badge>{behavior.sampleCount} campioni</Badge></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, behavior.confidence * 100)}%` }} /></div><div className="mt-1 text-xs text-muted-foreground">Confidenza modello: {Math.round(behavior.confidence * 100)}% · media personale {behavior.averageRatio.toFixed(2)}× quota.</div></div></CardContent></Card>

        <Card><CardHeader><CardTitle>Rosa di {detailTeam.name}</CardTitle></CardHeader><CardContent className="space-y-2">{!roster.length && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Rosa ancora vuota.</div>}{roster.map(({ purchase, player }) => <div key={purchase.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"><div className="min-w-0"><div className="truncate font-semibold">{player?.name}</div><div className="truncate text-xs text-muted-foreground">{player?.club} · {purchase.role}{purchase.bundleLabel ? ` · ${purchase.bundleLabel}` : ""}</div></div><div className="shrink-0 text-right"><div className="font-bold tabular">{purchase.pricePending ? <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600">DA INSERIRE</Badge> : purchase.bundleId && purchaseBudgetImpact(purchase) === 0 ? "incl." : purchaseBudgetImpact(purchase)}</div><div className="text-[11px] text-muted-foreground">quota {player?.basePrice}</div></div></div>)}</CardContent></Card>
      </div>
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted p-2.5 sm:p-3"><div className="text-[11px] text-muted-foreground sm:text-xs">{label}</div><div className="mt-1 text-base font-bold tabular sm:text-lg">{value}</div></div>;
}
