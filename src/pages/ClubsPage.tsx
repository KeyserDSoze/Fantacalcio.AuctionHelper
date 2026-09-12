import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { buildClubTierMetrics } from "@/lib/clubTiers";
import type { AppSnapshot, SerieAClub } from "@/types";

export function ClubsPage({ data, onClub }: { data: AppSnapshot; onClub: (c: SerieAClub) => Promise<void> }) {
  const metrics = buildClubTierMetrics(data.players, data.clubs);
  const metricByClub = new Map(metrics.map((metric) => [metric.club, metric]));
  const orderedClubs = [...data.clubs].sort((a, b) => (metricByClub.get(a.name)?.rank ?? 999) - (metricByClub.get(b.name)?.rank ?? 999));

  return <div className="space-y-4 sm:space-y-6">
    <div><h1 className="text-2xl font-bold sm:text-3xl">Tier squadre Serie A</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">Il default nasce dalla somma delle quotazioni dei 15 giocatori più costosi di ogni club. Le 20 squadre vengono ordinate e divise in 4 tier da 5; i tuoi override manuali restano invariati.</p></div>

    <Card className="border-primary/20"><CardContent className="p-4 text-sm text-muted-foreground"><strong className="text-foreground">Tier automatico:</strong> Top 15 per quotazione → somma → classifica club → posizioni 1–5 Tier 1, 6–10 Tier 2, 11–15 Tier 3, 16–20 Tier 4. Se importi un nuovo listone, solo i tier in modalità automatica vengono ricalcolati.</CardContent></Card>

    <Card><CardHeader><CardTitle>{data.clubs.length} squadre</CardTitle></CardHeader><CardContent>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{orderedClubs.map((club) => {
        const metric = metricByClub.get(club.name);
        const count = data.players.filter((p) => p.club === club.name).length;
        const isAuto = club.tierSource === "AUTO";
        return <div key={club.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">#{metric?.rank ?? "—"} · {club.name}</span><Badge className={isAuto ? "border-primary/30 bg-primary/10 text-primary" : ""}>{isAuto ? "AUTO" : "MANUALE"}</Badge></div>
            <div className="mt-1 text-xs text-muted-foreground">Top 15: <strong className="text-foreground">{metric?.top15Value ?? 0}</strong> · auto Tier {metric?.autoTier ?? "—"} · {count} giocatori</div>
          </div>
          <Select
            className="w-full sm:w-auto"
            value={isAuto ? "AUTO" : String(club.tier ?? "")}
            onChange={(e) => {
              if (e.target.value === "AUTO") {
                void onClub({ ...club, tier: metric?.autoTier ?? 4, tierSource: "AUTO" });
              } else {
                void onClub({ ...club, tier: Number(e.target.value), tierSource: "MANUAL" });
              }
            }}
          >
            <option value="AUTO">Automatico · Tier {metric?.autoTier ?? 4}</option>
            {[1,2,3,4,5].map((n) => <option key={n} value={n}>Manuale · Tier {n}</option>)}
          </Select>
        </div>;
      })}</div>
      {data.clubs.length === 0 && <div className="py-14 text-center text-muted-foreground">Prima importa il file Excel nella sezione Giocatori.</div>}
    </CardContent></Card>
  </div>;
}
