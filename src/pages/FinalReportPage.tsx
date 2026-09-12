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

  return <div className="space-y-4 sm:space-y-6">
    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Report finale dell'asta</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">Qualità rose, efficienza di spesa, personalità osservate e classifica teorica post-asta.</p></div>
      <Button className="w-full sm:w-auto" variant={isClosed ? "outline" : "default"} onClick={() => void toggleClosed()}>{isClosed ? <UnlockKeyhole className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}{isClosed ? "Riapri asta" : "Chiudi asta"}</Button>
    </div>

    {!allComplete && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 sm:p-4"><strong>Report provvisorio:</strong> {completed}/{data.teams.length} squadre hanno completato 25 giocatori. La classifica penalizza automaticamente le rose incomplete.</div>}
    {isClosed && <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm sm:p-4"><strong>Asta chiusa.</strong> I risultati sono congelati finché non la riapri.</div>}

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Card className="border-primary/30"><CardContent className="p-3 sm:p-5"><Crown className="mb-2 h-5 w-5 text-primary sm:mb-3" /><div className="text-[10px] uppercase text-muted-foreground sm:text-xs">Miglior asta</div><div className="mt-1 break-words text-base font-bold sm:text-xl">{winner?.team.name ?? "—"}</div><div className="mt-1 text-xs text-muted-foreground sm:text-sm">Score {winner?.score.toFixed(1) ?? "—"}</div></CardContent></Card>
      <Card><CardContent className="p-3 sm:p-5"><Gauge className="mb-2 h-5 w-5 sm:mb-3" /><div className="text-[10px] uppercase text-muted-foreground sm:text-xs">Miglior valore</div><div className="mt-1 break-words text-base font-bold sm:text-xl">{valueTeam?.team.name ?? "—"}</div><div className="mt-1 text-xs text-muted-foreground sm:text-sm">Efficienza {valueTeam ? pct(valueTeam.efficiency) : "—"}</div></CardContent></Card>
      <Card><CardContent className="p-3 sm:p-5"><Sparkles className="mb-2 h-5 w-5 sm:mb-3" /><div className="text-[10px] uppercase text-muted-foreground sm:text-xs">Più aggressivo</div><div className="mt-1 break-words text-base font-bold sm:text-xl">{aggressor?.team.name ?? "—"}</div><div className="mt-1 text-xs text-muted-foreground sm:text-sm">{aggressor?.behavior.multiplier.toFixed(2) ?? "—"}× lega</div></CardContent></Card>
      <Card><CardContent className="p-3 sm:p-5"><BrainCircuit className="mb-2 h-5 w-5 sm:mb-3" /><div className="text-[10px] uppercase text-muted-foreground sm:text-xs">Più imprevedibile</div><div className="mt-1 break-words text-base font-bold sm:text-xl">{wildest?.team.name ?? "—"}</div><div className="mt-1 text-xs text-muted-foreground sm:text-sm">Volatilità {wildest?.behavior.volatility.toFixed(2) ?? "—"}</div></CardContent></Card>
    </div>

    <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <Card><CardHeader><CardTitle>Classifica ipotetica post-asta</CardTitle></CardHeader><CardContent><div className="mb-4 text-sm text-muted-foreground">Non è una previsione della classifica reale: ordina le rose usando quotazioni FantaMaster, tier Serie A, equilibrio, completezza ed efficienza di spesa.</div>
        <div className="space-y-2 md:hidden">{reports.map((report, index) => <div key={report.team.id} className={`rounded-xl border p-3 ${report.team.isMe ? "border-primary/40 bg-primary/5" : ""}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-bold text-muted-foreground">#{index + 1}</span><div className="truncate font-bold">{report.team.name}</div>{report.team.isMe && <Badge className="border-primary/30 bg-primary/10 text-primary">NOI</Badge>}</div><div className="mt-1 text-xs text-muted-foreground">Spesi {report.spent} · Rimasti {report.remaining}</div></div><div className="shrink-0 text-2xl font-black text-primary">{report.score.toFixed(1)}</div></div><div className="mt-3 grid grid-cols-3 gap-1.5 text-center"><MiniMetric label="Qualità" value={pct(report.quality)} /><MiniMetric label="Efficienza" value={pct(report.efficiency)} /><MiniMetric label="Equilibrio" value={pct(report.balance)} /></div></div>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="pb-3">#</th><th className="pb-3">Squadra</th><th className="pb-3 text-right">Score</th><th className="pb-3 text-right">Qualità</th><th className="pb-3 text-right">Efficienza</th><th className="pb-3 text-right">Equilibrio</th><th className="pb-3 text-right">Spesi</th><th className="pb-3 text-right">Rimasti</th></tr></thead><tbody>{reports.map((report, index) => <tr key={report.team.id} className="border-t"><td className="py-3 text-muted-foreground">{index + 1}</td><td className="py-3 font-semibold">{report.team.name}{report.team.isMe && <Badge className="ml-2 border-primary/30 bg-primary/10 text-primary">NOI</Badge>}</td><td className="py-3 text-right text-lg font-black">{report.score.toFixed(1)}</td><td className="py-3 text-right">{pct(report.quality)}</td><td className="py-3 text-right">{pct(report.efficiency)}</td><td className="py-3 text-right">{pct(report.balance)}</td><td className="py-3 text-right">{report.spent}</td><td className="py-3 text-right">{report.remaining}</td></tr>)}</tbody></table></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Highlights dell'asta</CardTitle></CardHeader><CardContent className="space-y-2 sm:space-y-3">
        <div className="rounded-xl border p-3 sm:p-4"><div className="text-xs uppercase text-muted-foreground">Spesa più alta</div><div className="mt-1 font-bold">{spender?.team.name} · {spender?.spent} crediti</div></div>
        <div className="rounded-xl border p-3 sm:p-4"><div className="text-xs uppercase text-muted-foreground">Più crediti avanzati</div><div className="mt-1 font-bold">{saver?.team.name} · {saver?.remaining} crediti</div></div>
        {roleWinners.map(({ role, report }) => <div key={role} className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:p-4"><div><div className="text-xs uppercase text-muted-foreground">Miglior reparto · {ROLE_LABELS[role]}</div><div className="mt-1 font-bold">{report?.team.name}</div></div><Badge>{report?.roleScores[role].toFixed(0)}</Badge></div>)}
      </CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle>Le personalità emerse davvero</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{reports.map((report) => <div key={report.team.id} className="rounded-xl border p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-bold">{report.team.name}</div><div className="mt-1 text-lg font-semibold text-primary">{report.personality}</div></div><ShieldCheck className="h-5 w-5 shrink-0 text-muted-foreground" /></div><p className="mt-3 text-sm text-muted-foreground">{report.personalityDescription}</p><div className="mt-4 flex flex-wrap gap-2"><Badge>{report.behavior.multiplier.toFixed(2)}× aggressività</Badge><Badge>{report.behavior.sampleCount} osservazioni</Badge><Badge>{Math.round(report.behavior.confidence * 100)}% confidenza</Badge></div></div>)}</CardContent></Card>

    <Card><CardHeader><CardTitle>Come leggere il verdetto</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-lg bg-muted p-3 sm:p-4"><Award className="mb-2 h-4 w-4" /><strong>Qualità 66%</strong><p className="mt-1 text-xs text-muted-foreground">Forza dei giocatori rispetto al proprio ruolo e tier del club reale.</p></div><div className="rounded-lg bg-muted p-3 sm:p-4"><Gauge className="mb-2 h-4 w-4" /><strong>Efficienza 13%</strong><p className="mt-1 text-xs text-muted-foreground">Quanto la squadra ha pagato rispetto al ritmo dei prezzi della lega.</p></div><div className="rounded-lg bg-muted p-3 sm:p-4"><ShieldCheck className="mb-2 h-4 w-4" /><strong>Equilibrio 9%</strong><p className="mt-1 text-xs text-muted-foreground">Penalizza rose fortissime in un reparto ma deboli negli altri.</p></div><div className="rounded-lg bg-muted p-3 sm:p-4"><Crown className="mb-2 h-4 w-4" /><strong>Completezza + budget 12%</strong><p className="mt-1 text-xs text-muted-foreground">Premia la rosa completa e penalizza crediti inutilizzati in eccesso.</p></div></CardContent></Card>
  </div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted p-2"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mt-0.5 text-sm font-bold">{value}</div></div>;
}
