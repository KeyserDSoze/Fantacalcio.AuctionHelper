import { Award, BrainCircuit, Crown, Gauge, LockKeyhole, ShieldCheck, Sparkles, UnlockKeyhole } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppSnapshot, AuctionState, Role } from "@/types";
import { ROLE_LABELS } from "@/types";
import { buildFinalReport } from "@/lib/analytics";

function pct(value: number) {
  return `${Math.round(value)}%`;
}

export function FinalReportPage({ data, onAuction }: { data: AppSnapshot; onAuction: (state: AuctionState) => Promise<void> }) {
  const reports = buildFinalReport(data.teams, data.players, data.clubs, data.purchases, data.bids);
  const winner = reports[0];
  const spender = [...reports].sort((a, b) => b.spent - a.spent)[0];
  const saver = [...reports].sort((a, b) => b.remaining - a.remaining)[0];
  const valueTeam = [...reports].sort((a, b) => b.efficiency - a.efficiency)[0];
  const aggressor = [...reports].sort((a, b) => b.behavior.multiplier - a.behavior.multiplier)[0];
  const wildest = [...reports].sort((a, b) => b.behavior.volatility - a.behavior.volatility)[0];
  const completed = reports.filter((report) => report.completion >= 99.9).length;
  const allComplete = completed === data.teams.length;
  const isClosed = Boolean(data.auction.closedAt);

  const roleWinners = (["P", "D", "C", "A"] as Role[]).map((role) => ({
    role,
    report: [...reports].sort((a, b) => b.roleScores[role] - a.roleScores[role])[0],
  }));

  const toggleClosed = async () => {
    await onAuction({ ...data.auction, closedAt: isClosed ? null : Date.now() });
  };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div><h1 className="text-3xl font-bold">Report finale dell'asta</h1><p className="mt-1 text-muted-foreground">Valutazione della qualità delle rose, efficienza di spesa, personalità osservate e classifica teorica post-asta.</p></div>
      <Button variant={isClosed ? "outline" : "default"} onClick={() => void toggleClosed()}>{isClosed ? <UnlockKeyhole className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}{isClosed ? "Riapri asta" : "Chiudi asta"}</Button>
    </div>

    {!allComplete && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600"><strong>Report provvisorio:</strong> {completed}/{data.teams.length} squadre hanno completato 25 giocatori. Puoi comunque chiudere l'asta, ma la classifica penalizza automaticamente le rose incomplete.</div>}
    {isClosed && <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm"><strong>Asta chiusa.</strong> I risultati sono congelati finché non la riapri. La Gestione asta passa in sola lettura.</div>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="border-primary/30"><CardContent className="p-5"><Crown className="mb-3 h-5 w-5 text-primary" /><div className="text-xs uppercase text-muted-foreground">Miglior asta</div><div className="mt-1 text-xl font-bold">{winner?.team.name ?? "—"}</div><div className="mt-1 text-sm text-muted-foreground">Auction score {winner?.score.toFixed(1) ?? "—"}</div></CardContent></Card>
      <Card><CardContent className="p-5"><Gauge className="mb-3 h-5 w-5" /><div className="text-xs uppercase text-muted-foreground">Miglior valore</div><div className="mt-1 text-xl font-bold">{valueTeam?.team.name ?? "—"}</div><div className="mt-1 text-sm text-muted-foreground">Efficienza {valueTeam ? pct(valueTeam.efficiency) : "—"}</div></CardContent></Card>
      <Card><CardContent className="p-5"><Sparkles className="mb-3 h-5 w-5" /><div className="text-xs uppercase text-muted-foreground">Più aggressivo</div><div className="mt-1 text-xl font-bold">{aggressor?.team.name ?? "—"}</div><div className="mt-1 text-sm text-muted-foreground">{aggressor?.behavior.multiplier.toFixed(2) ?? "—"}× rispetto al ritmo lega</div></CardContent></Card>
      <Card><CardContent className="p-5"><BrainCircuit className="mb-3 h-5 w-5" /><div className="text-xs uppercase text-muted-foreground">Più imprevedibile</div><div className="mt-1 text-xl font-bold">{wildest?.team.name ?? "—"}</div><div className="mt-1 text-sm text-muted-foreground">Volatilità {wildest?.behavior.volatility.toFixed(2) ?? "—"}</div></CardContent></Card>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <Card><CardHeader><CardTitle>Classifica ipotetica post-asta</CardTitle></CardHeader><CardContent><div className="mb-4 text-sm text-muted-foreground">Non è una previsione della classifica reale del campionato: ordina le rose costruite usando quotazioni FantaMaster, tier delle squadre Serie A, equilibrio dei reparti, completezza ed efficienza di spesa.</div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="pb-3">#</th><th className="pb-3">Squadra</th><th className="pb-3 text-right">Score</th><th className="pb-3 text-right">Qualità</th><th className="pb-3 text-right">Efficienza</th><th className="pb-3 text-right">Equilibrio</th><th className="pb-3 text-right">Spesi</th><th className="pb-3 text-right">Rimasti</th></tr></thead><tbody>{reports.map((report, index) => <tr key={report.team.id} className="border-t"><td className="py-3 text-muted-foreground">{index + 1}</td><td className="py-3 font-semibold">{report.team.name}{report.team.isMe && <Badge className="ml-2 border-primary/30 bg-primary/10 text-primary">NOI</Badge>}</td><td className="py-3 text-right text-lg font-black">{report.score.toFixed(1)}</td><td className="py-3 text-right">{pct(report.quality)}</td><td className="py-3 text-right">{pct(report.efficiency)}</td><td className="py-3 text-right">{pct(report.balance)}</td><td className="py-3 text-right">{report.spent}</td><td className="py-3 text-right">{report.remaining}</td></tr>)}</tbody></table></div></CardContent></Card>

      <Card><CardHeader><CardTitle>Highlights dell'asta</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="rounded-xl border p-4"><div className="text-xs uppercase text-muted-foreground">Spesa più alta</div><div className="mt-1 font-bold">{spender?.team.name} · {spender?.spent} crediti</div></div>
        <div className="rounded-xl border p-4"><div className="text-xs uppercase text-muted-foreground">Più crediti avanzati</div><div className="mt-1 font-bold">{saver?.team.name} · {saver?.remaining} crediti</div></div>
        {roleWinners.map(({ role, report }) => <div key={role} className="flex items-center justify-between rounded-xl border p-4"><div><div className="text-xs uppercase text-muted-foreground">Miglior reparto · {ROLE_LABELS[role]}</div><div className="mt-1 font-bold">{report?.team.name}</div></div><Badge>{report?.roleScores[role].toFixed(0)}</Badge></div>)}
      </CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Le personalità emerse davvero</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reports.map((report) => <div key={report.team.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-bold">{report.team.name}</div><div className="mt-1 text-lg font-semibold text-primary">{report.personality}</div></div><ShieldCheck className="h-5 w-5 text-muted-foreground" /></div><p className="mt-3 text-sm text-muted-foreground">{report.personalityDescription}</p><div className="mt-4 flex flex-wrap gap-2"><Badge>{report.behavior.multiplier.toFixed(2)}× aggressività</Badge><Badge>{report.behavior.sampleCount} osservazioni</Badge><Badge>{Math.round(report.behavior.confidence * 100)}% confidenza</Badge></div></div>)}</CardContent></Card>

    <Card><CardHeader><CardTitle>Come leggere il verdetto</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4"><div className="rounded-lg bg-muted p-4"><Award className="mb-2 h-4 w-4" /><strong>Qualità 66%</strong><p className="mt-1 text-xs text-muted-foreground">Forza dei giocatori rispetto al proprio ruolo e tier del club reale.</p></div><div className="rounded-lg bg-muted p-4"><Gauge className="mb-2 h-4 w-4" /><strong>Efficienza 13%</strong><p className="mt-1 text-xs text-muted-foreground">Quanto la squadra ha pagato rispetto al ritmo dei prezzi della lega.</p></div><div className="rounded-lg bg-muted p-4"><ShieldCheck className="mb-2 h-4 w-4" /><strong>Equilibrio 9%</strong><p className="mt-1 text-xs text-muted-foreground">Penalizza rose fortissime in un reparto ma deboli negli altri.</p></div><div className="rounded-lg bg-muted p-4"><Crown className="mb-2 h-4 w-4" /><strong>Completezza + budget 12%</strong><p className="mt-1 text-xs text-muted-foreground">Premia la rosa completa e penalizza crediti inutilizzati in eccesso.</p></div></CardContent></Card>
  </div>;
}
