import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { AppSnapshot, SerieAClub } from "@/types";

export function ClubsPage({ data, onClub }: { data: AppSnapshot; onClub: (c: SerieAClub) => Promise<void> }) {
  return <div className="space-y-4 sm:space-y-6"><div><h1 className="text-2xl font-bold sm:text-3xl">Tier squadre Serie A</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">Le squadre vengono estratte automaticamente dal distinct del catalogo giocatori.</p></div><Card><CardHeader><CardTitle>{data.clubs.length} squadre</CardTitle></CardHeader><CardContent>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.clubs.map((club) => { const count = data.players.filter((p) => p.club === club.name).length; return <div key={club.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:p-4"><div><div className="font-semibold">{club.name}</div><div className="text-xs text-muted-foreground">{count} giocatori nel listone</div></div><Select className="w-full sm:w-auto" value={club.tier ?? ""} onChange={(e) => void onClub({ ...club, tier: e.target.value ? Number(e.target.value) : null })}><option value="">Senza tier</option>{[1,2,3,4,5].map((n) => <option key={n} value={n}>Tier {n}</option>)}</Select></div> })}</div>
    {data.clubs.length === 0 && <div className="py-14 text-center text-muted-foreground">Prima importa il file Excel nella sezione Giocatori.</div>}
  </CardContent></Card></div>;
}
