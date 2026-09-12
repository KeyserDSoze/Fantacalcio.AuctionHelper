import { Coins, Crown, Target, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/StatCard";
import type { AppSnapshot, Role } from "@/types";
import { ROLE_LABELS, ROLE_LIMITS } from "@/types";
import { teamSnapshot } from "@/lib/analytics";
import { money } from "@/lib/utils";

export function DashboardPage({ data }: { data: AppSnapshot }) {
  const snapshots = data.teams.map((t) => teamSnapshot(t, data.players, data.purchases)).sort((a, b) => b.remaining - a.remaining);
  const me = snapshots.find((t) => t.isMe)!;
  const recent = [...data.purchases].sort((a, b) => b.timestamp - a.timestamp).slice(0, 8);
  const available = data.players.filter((p) => p.status === "AVAILABLE").length;

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold tracking-tight">Dashboard</h1><p className="mt-1 text-muted-foreground">Situazione economica e andamento dell'asta in tempo reale.</p></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Budget Soze Heaven" value={money(me.remaining)} note={`Budget libero stimato: ${money(me.freeBudget)}`} icon={Coins} />
      <StatCard label="Rosa" value={`${me.totalPlayers}/25`} note="3P · 8D · 8C · 6A" icon={Users} />
      <StatCard label="Giocatori liberi" value={available} note={`${data.players.length} nel database`} icon={Target} />
      <StatCard label="Più ricco" value={snapshots[0]?.name ?? "—"} note={`${money(snapshots[0]?.remaining ?? 0)} crediti`} icon={Crown} />
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <Card><CardHeader><CardTitle>Classifica budget</CardTitle></CardHeader><CardContent className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="pb-3">#</th><th className="pb-3">Squadra</th><th className="pb-3 text-right">Crediti</th><th className="pb-3 text-right">Spesi</th><th className="pb-3 text-right">Budget libero</th><th className="pb-3 text-right">Rosa</th><th className="pb-3">Reparti</th></tr></thead><tbody>
          {snapshots.map((team, index) => <tr key={team.id} className="border-t"><td className="py-3 text-muted-foreground">{index + 1}</td><td className="py-3 font-semibold">{team.name}{team.isMe && <Badge className="ml-2 border-primary/30 bg-primary/10 text-primary">NOI</Badge>}</td><td className="py-3 text-right text-lg font-bold tabular">{money(team.remaining)}</td><td className="py-3 text-right tabular text-muted-foreground">{money(team.spent)}</td><td className="py-3 text-right tabular">{money(team.freeBudget)}</td><td className="py-3 text-right tabular">{team.totalPlayers}/25</td><td className="py-3"><div className="flex gap-1">{(["P","D","C","A"] as Role[]).map((r) => <Badge key={r} className="font-normal">{r} {team.counts[r]}/{ROLE_LIMITS[r]}</Badge>)}</div></td></tr>)}
        </tbody></table>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Ultimi acquisti</CardTitle></CardHeader><CardContent className="space-y-3">
        {recent.length === 0 && <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nessun acquisto registrato.</div>}
        {recent.map((purchase) => { const player = data.players.find((p) => p.id === purchase.playerId); const team = data.teams.find((t) => t.id === purchase.fantasyTeamId); return <div key={purchase.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div><div className="font-semibold">{player?.name}</div><div className="text-xs text-muted-foreground">{team?.name} · {ROLE_LABELS[purchase.role]}</div></div><div className="text-lg font-bold tabular">{purchase.price}</div></div> })}
      </CardContent></Card>
    </div>
  </div>;
}
