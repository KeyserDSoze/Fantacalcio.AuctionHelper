import { Coins, Crown, RotateCcw, Target, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import type { AppSnapshot, Purchase, Role } from "@/types";
import { ROLE_LABELS, ROLE_LIMITS } from "@/types";
import { purchaseBudgetImpact, teamSnapshot } from "@/lib/analytics";
import { money } from "@/lib/utils";

export function DashboardPage({ data, onUndoPurchase }: { data: AppSnapshot; onUndoPurchase: (purchase: Purchase) => Promise<void> }) {
  const snapshots = data.teams.map((team) => teamSnapshot(team, data.players, data.purchases)).sort((a, b) => b.remaining - a.remaining);
  const me = snapshots.find((team) => team.isMe)!;
  const recent = [...data.purchases]
    .filter((purchase) => !purchase.bundleId || purchaseBudgetImpact(purchase) > 0)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8);
  const latest = recent[0];
  const available = data.players.filter((player) => player.status === "AVAILABLE").length;
  const isClosed = Boolean(data.auction.closedAt);

  return <div className="space-y-4 sm:space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">Situazione economica e andamento dell'asta in tempo reale.</p></div>{latest && <Button className="w-full sm:w-auto" variant="outline" disabled={isClosed} onClick={() => void onUndoPurchase(latest)}><RotateCcw className="h-4 w-4" />Annulla ultimo acquisto</Button>}</div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard label="Budget Soze Heaven" value={money(me.remaining)} note={`Libero: ${money(me.freeBudget)}`} icon={Coins} />
      <StatCard label="Rosa" value={`${me.totalPlayers}/25`} note="3P · 8D · 8C · 6A" icon={Users} />
      <StatCard label="Giocatori liberi" value={available} note={`${data.players.length} totali`} icon={Target} />
      <StatCard label="Più ricco" value={snapshots[0]?.name ?? "—"} note={`${money(snapshots[0]?.remaining ?? 0)} crediti`} icon={Crown} />
    </div>

    <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <Card><CardHeader><CardTitle>Classifica budget</CardTitle></CardHeader><CardContent>
        <div className="space-y-2 md:hidden">
          {snapshots.map((team, index) => <div key={team.id} className={`rounded-xl border p-3 ${team.isMe ? "border-primary/40 bg-primary/5" : ""}`}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-bold text-muted-foreground">#{index + 1}</span><div className="truncate font-semibold">{team.name}</div>{team.isMe && <Badge className="border-primary/30 bg-primary/10 text-primary">NOI</Badge>}</div><div className="mt-1 text-xs text-muted-foreground">Spesi {money(team.spent)} · Rosa {team.totalPlayers}/25</div></div><div className="shrink-0 text-right"><div className="text-xl font-black tabular">{money(team.remaining)}</div><div className="text-[11px] text-muted-foreground">libero {money(team.freeBudget)}</div></div></div>
            <div className="mt-3 grid grid-cols-4 gap-1">{(["P","D","C","A"] as Role[]).map((role) => <div key={role} className="rounded-md bg-muted px-2 py-1.5 text-center text-xs"><strong>{role}</strong> {team.counts[role]}/{ROLE_LIMITS[role]}</div>)}</div>
          </div>)}
        </div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="pb-3">#</th><th className="pb-3">Squadra</th><th className="pb-3 text-right">Crediti</th><th className="pb-3 text-right">Spesi</th><th className="pb-3 text-right">Budget libero</th><th className="pb-3 text-right">Rosa</th><th className="pb-3">Reparti</th></tr></thead><tbody>
          {snapshots.map((team, index) => <tr key={team.id} className="border-t"><td className="py-3 text-muted-foreground">{index + 1}</td><td className="py-3 font-semibold">{team.name}{team.isMe && <Badge className="ml-2 border-primary/30 bg-primary/10 text-primary">NOI</Badge>}</td><td className="py-3 text-right text-lg font-bold tabular">{money(team.remaining)}</td><td className="py-3 text-right tabular text-muted-foreground">{money(team.spent)}</td><td className="py-3 text-right tabular">{money(team.freeBudget)}</td><td className="py-3 text-right tabular">{team.totalPlayers}/25</td><td className="py-3"><div className="flex gap-1">{(["P","D","C","A"] as Role[]).map((role) => <Badge key={role} className="font-normal">{role} {team.counts[role]}/{ROLE_LIMITS[role]}</Badge>)}</div></td></tr>)}
        </tbody></table></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Ultimi acquisti</CardTitle></CardHeader><CardContent className="space-y-2 sm:space-y-3">
        {recent.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nessun acquisto registrato.</div>}
        {recent.map((purchase) => { const player = data.players.find((item) => item.id === purchase.playerId); const team = data.teams.find((item) => item.id === purchase.fantasyTeamId); return <div key={purchase.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><div className="truncate font-semibold">{purchase.bundleLabel ?? player?.name}</div><div className="truncate text-xs text-muted-foreground">{team?.name} · {ROLE_LABELS[purchase.role]}{purchase.bundleLabel ? " · 3 portieri" : ""}</div></div><div className="shrink-0 text-lg font-bold tabular">{purchaseBudgetImpact(purchase)}</div></div> })}
      </CardContent></Card>
    </div>
  </div>;
}
