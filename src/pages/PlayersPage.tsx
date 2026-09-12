import { useMemo, useRef, useState } from "react";
import { Heart, Search, Sparkles, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AppSnapshot, Player, Role } from "@/types";
import { ROLE_LABELS, ROLE_LIMITS } from "@/types";
import { parseFantamasterFile } from "@/lib/excel";

export function PlayersPage({
  data,
  onPlayer,
  onPlayers,
  onCatalog,
}: {
  data: AppSnapshot;
  onPlayer: (p: Player) => Promise<void>;
  onPlayers: (players: Player[]) => Promise<void>;
  onCatalog: (players: Player[], clubs: AppSnapshot["clubs"]) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"ALL" | Role>("ALL");
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState("");
  const pageSize = 50;
  const filtered = useMemo(() => data.players.filter((p) => (role === "ALL" || p.role === role) && `${p.name} ${p.club}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => a.name.localeCompare(b.name,"it")), [data.players, query, role]);
  const paged = filtered.slice(page * pageSize, page * pageSize + pageSize);

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await parseFantamasterFile(file, data.players, data.clubs);
      await onCatalog(parsed.players, parsed.clubs);
      setMessage(`${parsed.players.length} giocatori importati. Tier e preferenze esistenti preservati quando possibile.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore durante l'import.");
    }
  };

  const autoAssignChoices = async () => {
    const roles: Role[] = role === "ALL" ? ["P", "D", "C", "A"] : [role];
    const changes = new Map<string, Player>();

    roles.forEach((currentRole) => {
      const available = data.players.filter((player) => player.status === "AVAILABLE" && player.role === currentRole);
      if (currentRole === "P" && data.auction.goalkeeperMode === "PACKAGE") {
        const byClub = new Map<string, Player[]>();
        available.forEach((player) => byClub.set(player.club, [...(byClub.get(player.club) ?? []), player]));
        const rankedPackages = [...byClub.entries()]
          .map(([club, players]) => ({ club, players: [...players].sort((a, b) => b.basePrice - a.basePrice).slice(0, 3) }))
          .filter((item) => item.players.length === 3)
          .sort((a, b) => b.players.reduce((sum, player) => sum + player.basePrice, 0) - a.players.reduce((sum, player) => sum + player.basePrice, 0));
        const topClubs = new Set(rankedPackages.slice(0, 9).map((item) => item.club));
        available.forEach((player) => changes.set(player.id, { ...player, targetChoice: topClubs.has(player.club) ? 1 : null }));
        return;
      }

      const ranked = [...available].sort((a, b) => b.basePrice - a.basePrice || a.name.localeCompare(b.name, "it"));
      const maxChoice = ROLE_LIMITS[currentRole];
      ranked.forEach((player, index) => {
        const choice = Math.floor(index / 9) + 1;
        changes.set(player.id, { ...player, targetChoice: choice <= maxChoice ? choice : null });
      });
    });

    await onPlayers([...changes.values()]);
    const label = role === "ALL" ? "tutti i ruoli" : ROLE_LABELS[role].toLowerCase();
    setMessage(`Scelte automatiche aggiornate per ${label}: blocchi dinamici da 9 sui soli giocatori ancora liberi.`);
  };

  const choiceCount = (player: Player) => player.role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? 1 : ROLE_LIMITS[player.role];

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div><h1 className="text-3xl font-bold">Giocatori</h1><p className="mt-1 text-muted-foreground">Import FantaMaster, preferenze, tier personali e scelta pianificata.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!data.players.length} onClick={() => void autoAssignChoices()}><Sparkles className="h-4 w-4" />Auto scelte · blocchi da 9</Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />Importa Excel</Button>
      </div>
    </div>
    {message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</div>}
    <Card className="border-primary/20"><CardContent className="p-4 text-sm text-muted-foreground"><strong className="text-foreground">Auto scelte:</strong> ordina i liberi per quotazione. Posizioni 1–9 → 1ª scelta, 10–18 → 2ª, 19–27 → 3ª e così via. Ripremendolo durante l'asta la graduatoria si ricompatta automaticamente togliendo chi è già stato preso. In modalità pacchetto portieri assegna la 1ª scelta ai 9 pacchetti più costosi.</CardContent></Card>
    <Card><CardHeader><CardTitle>Catalogo · {filtered.length} giocatori</CardTitle></CardHeader><CardContent>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Cerca nome o squadra…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} /></div><Select value={role} onChange={(e) => { setRole(e.target.value as typeof role); setPage(0); }}><option value="ALL">Tutti i ruoli</option>{(["P","D","C","A"] as Role[]).map((r) => <option value={r} key={r}>{ROLE_LABELS[r]}</option>)}</Select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="pb-3">Giocatore</th><th>Ruolo</th><th>Quota</th><th>Squadra</th><th>Gradimento</th><th>Mio tier</th><th>Scelta pianificata</th><th>Stato</th></tr></thead><tbody>
        {paged.map((player) => <tr key={player.id} className="border-t"><td className="py-3"><div className="font-semibold">{player.name}</div>{player.isTrequartista && <div className="text-[11px] text-muted-foreground">Trequartista</div>}</td><td><Badge>{player.role}</Badge></td><td className="font-bold tabular">{player.basePrice}</td><td>{player.club}</td><td><div className="flex gap-1"><Button size="sm" variant={player.personalRating === "LIKE" ? "default" : "outline"} onClick={() => void onPlayer({ ...player, personalRating: player.personalRating === "LIKE" ? "NEUTRAL" : "LIKE" })}><Heart className="h-3.5 w-3.5" />Mi piace</Button><Button size="sm" variant={player.personalRating === "AVOID" ? "destructive" : "outline"} onClick={() => void onPlayer({ ...player, personalRating: player.personalRating === "AVOID" ? "NEUTRAL" : "AVOID" })}><XCircle className="h-3.5 w-3.5" />Evita</Button></div></td><td><Select className="h-8 w-24" value={player.priorityTier ?? ""} onChange={(e) => void onPlayer({ ...player, priorityTier: e.target.value ? Number(e.target.value) as 1|2|3 : null })}><option value="">—</option><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></Select></td><td><Select className="h-8 w-32" value={player.targetChoice ?? ""} onChange={(e) => void onPlayer({ ...player, targetChoice: e.target.value ? Number(e.target.value) : null })}><option value="">Non definita</option>{Array.from({length: choiceCount(player)}, (_,i) => i+1).map((n) => <option key={n} value={n}>{n}ª scelta</option>)}</Select></td><td>{player.status === "WON" ? <Badge className="border-primary/30 bg-primary/10 text-primary">Assegnato</Badge> : <Badge>Libero</Badge>}</td></tr>)}
      </tbody></table></div>
      {data.players.length === 0 && <div className="py-14 text-center text-muted-foreground">Importa il file Excel FantaMaster per iniziare.</div>}
      {filtered.length > pageSize && <div className="mt-4 flex items-center justify-end gap-2"><Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p-1)}>Indietro</Button><span className="text-sm text-muted-foreground">Pagina {page+1}/{Math.ceil(filtered.length/pageSize)}</span><Button variant="outline" disabled={(page+1)*pageSize >= filtered.length} onClick={() => setPage((p) => p+1)}>Avanti</Button></div>}
    </CardContent></Card>
  </div>;
}
