import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Coins, Crosshair, Package, RotateCcw, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AppSnapshot, AuctionState, ObservedBid, Player, Purchase, Role } from "@/types";
import { ROLE_LABELS, ROLE_LIMITS } from "@/types";
import { activeTeamsForState, getSozeCandidates, predictOpponentTargets, type CandidateSource } from "@/lib/strategy";
import { observedBehavior, teamSnapshot } from "@/lib/analytics";
import { clamp, money } from "@/lib/utils";

function goalkeeperPackage(players: Player[], anchor?: Player) {
  if (!anchor) return [];
  return players
    .filter((player) => player.status === "AVAILABLE" && player.role === "P" && player.club === anchor.club)
    .sort((a, b) => b.basePrice - a.basePrice)
    .slice(0, 3);
}

function packageRepresentatives(players: Player[]) {
  const byClub = new Map<string, Player[]>();
  players.filter((player) => player.status === "AVAILABLE" && player.role === "P").forEach((player) => {
    byClub.set(player.club, [...(byClub.get(player.club) ?? []), player]);
  });
  return [...byClub.values()]
    .filter((group) => group.length >= 3)
    .map((group) => [...group].sort((a, b) => b.basePrice - a.basePrice)[0])
    .filter((player): player is Player => Boolean(player));
}

export function AuctionPage({
  data,
  onAuction,
  onPurchase,
  onPurchaseBundle,
  onBid,
}: {
  data: AppSnapshot;
  onAuction: (a: AuctionState) => Promise<void>;
  onPurchase: (purchase: Purchase, player: Player) => Promise<void>;
  onPurchaseBundle: (purchases: Purchase[], players: Player[]) => Promise<void>;
  onBid: (bid: ObservedBid) => Promise<void>;
}) {
  const [candidateSource, setCandidateSource] = useState<CandidateSource>("MY_LIST");
  const [teamId, setTeamId] = useState("soze-heaven");
  const [playerQuery, setPlayerQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [bidTeamId, setBidTeamId] = useState("emanuele");
  const [bidPlayerQuery, setBidPlayerQuery] = useState("");
  const [bidPlayerId, setBidPlayerId] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [bidResult, setBidResult] = useState<ObservedBid["result"]>("LOST");
  const [bidError, setBidError] = useState("");

  const isClosed = Boolean(data.auction.closedAt);
  const packageMode = data.auction.currentRole === "P" && data.auction.goalkeeperMode === "PACKAGE";
  const hasGoalkeeperPurchases = data.purchases.some((purchase) => purchase.role === "P");
  const candidates = useMemo(
    () => getSozeCandidates(data.players, data.clubs, data.teams, data.purchases, data.auction, data.bids, candidateSource),
    [data, candidateSource],
  );
  const predictions = useMemo(() => predictOpponentTargets(data.teams, data.players, data.clubs, data.purchases, data.auction, data.bids), [data]);
  const active = activeTeamsForState(data.teams, data.purchases, data.auction);
  const activeIds = new Set(active.map((team) => team.id));
  const snapshots = data.teams.map((team) => teamSnapshot(team, data.players, data.purchases)).sort((a, b) => b.remaining - a.remaining);
  const selectedTeam = data.teams.find((team) => team.id === teamId)!;
  const selectedPlayer = data.players.find((player) => player.id === selectedPlayerId);
  const selectedBidPlayer = data.players.find((player) => player.id === bidPlayerId);
  const selectedPackage = packageMode ? goalkeeperPackage(data.players, selectedPlayer) : [];
  const selectedBidPackage = packageMode ? goalkeeperPackage(data.players, selectedBidPlayer) : [];
  const selectedMinPrice = packageMode ? selectedPackage.reduce((sum, player) => sum + player.basePrice, 0) : selectedPlayer?.basePrice ?? 1;
  const selectedBidMinPrice = packageMode ? selectedBidPackage.reduce((sum, player) => sum + player.basePrice, 0) : selectedBidPlayer?.basePrice ?? 1;
  const rolePool = packageMode ? packageRepresentatives(data.players) : data.players.filter((player) => player.status === "AVAILABLE" && player.role === data.auction.currentRole);
  const availableSearch = rolePool.filter((player) => `${player.name} ${player.club}`.toLowerCase().includes(playerQuery.toLowerCase())).slice(0, 10);
  const bidPool = packageMode ? packageRepresentatives(data.players) : data.players.filter((player) => player.role === data.auction.currentRole);
  const bidSearch = bidPool.filter((player) => `${player.name} ${player.club}`.toLowerCase().includes(bidPlayerQuery.toLowerCase())).slice(0, 10);
  const maxChoice = packageMode ? 1 : ROLE_LIMITS[data.auction.currentRole];
  const recentBids = [...data.bids].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);

  const setPhase = (role: Role, choice = 1) => void onAuction({ ...data.auction, currentRole: role, choiceNumber: choice, subRound: 1, resolvedTeamIds: [] });
  const nextSubRound = () => !isClosed && void onAuction({ ...data.auction, subRound: data.auction.subRound + 1 });
  const nextChoice = () => {
    if (!isClosed && data.auction.choiceNumber < maxChoice) void onAuction({ ...data.auction, choiceNumber: data.auction.choiceNumber + 1, subRound: 1, resolvedTeamIds: [] });
  };

  const selectPlayer = (player: Player, bid = false) => {
    const pack = packageMode ? goalkeeperPackage(data.players, player) : [player];
    const minimum = pack.reduce((sum, item) => sum + item.basePrice, 0);
    if (bid) {
      setBidPlayerId(player.id);
      setBidPlayerQuery(packageMode ? `Pacchetto ${player.club}` : player.name);
      setBidAmount(String(minimum));
    } else {
      setSelectedPlayerId(player.id);
      setPlayerQuery(packageMode ? `Pacchetto ${player.club}` : player.name);
      setPrice(String(minimum));
    }
  };

  const useCandidate = (player: Player, bid: number) => {
    setTeamId("soze-heaven");
    selectPlayer(player);
    setPrice(String(bid));
  };

  const register = async () => {
    setError("");
    if (isClosed) return setError("L'asta è chiusa. Riaprila dal Report finale per fare modifiche.");
    if (!selectedPlayer || !selectedTeam) return setError("Seleziona squadra e giocatore.");
    const numericPrice = Number(price);
    if (packageMode && selectedPackage.length !== 3) return setError(`Il pacchetto ${selectedPlayer.club} non ha 3 portieri disponibili.`);
    if (!numericPrice || numericPrice < selectedMinPrice) return setError(`Offerta minima: ${selectedMinPrice} crediti.`);
    const snap = teamSnapshot(selectedTeam, data.players, data.purchases);
    if (numericPrice > snap.remaining) return setError(`Budget insufficiente: ${snap.remaining} crediti rimasti.`);
    if (packageMode && snap.counts.P > 0) return setError(`${selectedTeam.name} ha già un portiere: in modalità pacchetto servono 3 slot liberi.`);

    const now = Date.now();
    if (packageMode) {
      const bundleId = `gk-${now}-${selectedTeam.id}-${selectedPlayer.club}`;
      const bundleLabel = `Pacchetto ${selectedPlayer.club}`;
      const purchases: Purchase[] = selectedPackage.map((player, index) => ({
        id: `${bundleId}-${player.id}`,
        playerId: player.id,
        fantasyTeamId: selectedTeam.id,
        price: index === 0 ? numericPrice : 0,
        budgetImpact: index === 0 ? numericPrice : 0,
        bundleId,
        bundleLabel,
        role: "P",
        choiceNumber: data.auction.choiceNumber,
        subRound: data.auction.subRound,
        timestamp: now + index,
      }));
      const updatedPlayers = selectedPackage.map((player, index) => ({ ...player, status: "WON" as const, ownerId: selectedTeam.id, purchasePrice: index === 0 ? numericPrice : 0 }));
      await onPurchaseBundle(purchases, updatedPlayers);
    } else {
      const purchase: Purchase = { id: `${now}-${selectedPlayer.id}`, playerId: selectedPlayer.id, fantasyTeamId: selectedTeam.id, price: numericPrice, role: selectedPlayer.role, choiceNumber: data.auction.choiceNumber, subRound: data.auction.subRound, timestamp: now };
      const updatedPlayer: Player = { ...selectedPlayer, status: "WON", ownerId: selectedTeam.id, purchasePrice: numericPrice };
      await onPurchase(purchase, updatedPlayer);
    }

    if (selectedPlayer.role === data.auction.currentRole && activeIds.has(selectedTeam.id)) {
      await onAuction({ ...data.auction, resolvedTeamIds: Array.from(new Set([...data.auction.resolvedTeamIds, selectedTeam.id])) });
    }
    setSelectedPlayerId(""); setPlayerQuery(""); setPrice("");
  };

  const registerBid = async () => {
    setBidError("");
    if (isClosed) return setBidError("L'asta è chiusa.");
    const team = data.teams.find((item) => item.id === bidTeamId);
    if (!selectedBidPlayer || !team) return setBidError("Seleziona squadra e giocatore.");
    const amount = Number(bidAmount);
    if (packageMode && selectedBidPackage.length !== 3) return setBidError(`Il pacchetto ${selectedBidPlayer.club} non ha 3 portieri disponibili.`);
    if (!amount || amount < selectedBidMinPrice) return setBidError(`Offerta minima: ${selectedBidMinPrice} crediti.`);
    await onBid({
      id: `bid-${Date.now()}-${team.id}-${selectedBidPlayer.id}`,
      playerId: selectedBidPlayer.id,
      fantasyTeamId: team.id,
      amount,
      referenceBasePrice: selectedBidMinPrice,
      result: bidResult,
      role: selectedBidPlayer.role,
      choiceNumber: data.auction.choiceNumber,
      subRound: data.auction.subRound,
      timestamp: Date.now(),
    });
    setBidPlayerId(""); setBidPlayerQuery(""); setBidAmount("");
  };

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><h1 className="text-3xl font-bold">Gestione asta</h1><p className="mt-1 text-muted-foreground">Basket dinamico, rollover dei target, prezzi previsti e modello che impara dalle buste reali.</p></div><div className="flex flex-wrap gap-2">{(["P","D","C","A"] as Role[]).map((role) => <Button key={role} disabled={isClosed} variant={data.auction.currentRole === role ? "default" : "outline"} onClick={() => setPhase(role)}>{role} · {ROLE_LABELS[role]}</Button>)}</div></div>

    {isClosed && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-600"><strong>Asta chiusa.</strong> La gestione è in sola lettura. Puoi riaprirla dal Report finale.</div>}

    {data.auction.currentRole === "P" && <Card className="border-primary/30"><CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3"><Package className="mt-0.5 h-5 w-5 text-primary" /><div><div className="font-semibold">Modalità asta portieri</div><div className="text-sm text-muted-foreground">Sceglila prima del primo acquisto. Nel pacchetto entrano insieme i 3 portieri con quotazione più alta della squadra.</div></div></div><Select className="md:w-64" value={data.auction.goalkeeperMode} disabled={hasGoalkeeperPurchases || isClosed} onChange={(event) => void onAuction({ ...data.auction, goalkeeperMode: event.target.value as AuctionState["goalkeeperMode"], choiceNumber: 1, subRound: 1, resolvedTeamIds: [] })}><option value="INDIVIDUAL">3 aste · portieri singoli</option><option value="PACKAGE">1 asta · pacchetto squadra</option></Select></CardContent></Card>}

    <div className="grid gap-4 sm:grid-cols-3">
      <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Fase</div><div className="mt-1 text-2xl font-bold">{ROLE_LABELS[data.auction.currentRole]}</div></CardContent></Card>
      <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Scelta</div><div className="mt-1 text-2xl font-bold">{data.auction.choiceNumber}/{maxChoice} <span className="text-sm font-normal text-muted-foreground">· sottoround {data.auction.subRound}</span></div></CardContent></Card>
      <Card><CardContent className="p-5"><div className="text-xs uppercase text-muted-foreground">Ancora in gioco</div><div className="mt-1 text-2xl font-bold">{active.length}/9</div></CardContent></Card>
    </div>

    <div className="grid gap-6 2xl:grid-cols-[1.22fr_.78fr]">
      <div className="space-y-6">
        <Card>
          <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
            <div><CardTitle>Basket decisionale Soze Heaven</CardTitle><div className="mt-1 text-sm text-muted-foreground">Scegli se ragionare sui tuoi target pianificati oppure sui 9 nomi più costosi ancora disponibili.</div></div>
            <div className="flex rounded-lg border p-1">
              <Button size="sm" variant={candidateSource === "MY_LIST" ? "default" : "ghost"} onClick={() => setCandidateSource("MY_LIST")}>Miei target</Button>
              <Button size="sm" variant={candidateSource === "TOP9" ? "default" : "ghost"} onClick={() => setCandidateSource("TOP9")}>Top 9 rimasti</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {candidates.map((candidate, index) => {
              const base = packageMode ? goalkeeperPackage(data.players, candidate.player).reduce((sum, player) => sum + player.basePrice, 0) : candidate.player.basePrice;
              return <div key={candidate.player.id} className="rounded-xl border p-4">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 font-bold text-primary">{index + 1}</div><div><div className="flex flex-wrap items-center gap-2"><span className="text-lg font-bold">{packageMode ? `Pacchetto ${candidate.player.club}` : candidate.player.name}</span><Badge>{candidate.player.club}</Badge><Badge>{candidate.player.role}</Badge>{candidate.rolledOver && <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-600">ROLLOVER</Badge>}{candidate.player.personalRating === "LIKE" && <Badge className="border-primary/30 bg-primary/10 text-primary">MI PIACE</Badge>}{candidate.player.personalRating === "AVOID" && <Badge className="border-red-500/30 bg-red-500/10 text-red-500">EVITA</Badge>}</div><div className="mt-1 text-sm text-muted-foreground">Quota {base} · Tier personale {candidate.player.priorityTier ?? "—"} · pianificato {candidate.player.targetChoice ? `${candidate.player.targetChoice}ª` : "—"}</div></div></div>
                  <div className="flex items-center gap-4 lg:text-right"><div><div className="text-xs text-muted-foreground">Score</div><div className="text-2xl font-black text-primary">{Math.round(candidate.recommendationScore * 100)}</div></div><div><div className="text-xs text-muted-foreground">Presa con {candidate.winBid}</div><div className="text-2xl font-black">{Math.round(candidate.winProbability * 100)}%</div></div></div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  <Metric label="Mercato atteso" value={`~${candidate.expectedMarketPrice}`} />
                  <Metric label="Offerta sensata" value={String(candidate.sensibleBid)} />
                  <Metric label="Per prenderlo" value={String(candidate.winBid)} emphasis />
                  <Metric label="Tetto sostenibile" value={String(candidate.maxSustainableBid)} />
                  <Metric label="Collisione" value={`${Math.round(candidate.collisionRisk * 100)}%`} />
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1.35fr_auto] lg:items-end">
                  <div><div className="mb-1 flex justify-between text-xs"><span>Probabilità di successo</span><span>{Math.round(candidate.winProbability * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{width:`${clamp(candidate.winProbability) * 100}%`}} /></div><div className="mt-2 text-xs text-muted-foreground">{candidate.reason}</div></div>
                  <div><div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Chi può chiamarlo · probabilità · prezzo previsto</div><div className="flex flex-wrap gap-2">{candidate.contenders.length ? candidate.contenders.slice(0,6).map((contender) => <Badge key={contender.team.id}>{contender.team.name} · {Math.round(contender.probability * 100)}% · ~{contender.expectedBid}</Badge>) : <span className="text-xs text-muted-foreground">Nessun avversario con probabilità rilevante.</span>}</div></div>
                  <Button size="sm" onClick={() => useCandidate(candidate.player, candidate.winBid)}><Crosshair className="h-4 w-4" />Usa {candidate.winBid}</Button>
                </div>
              </div>;
            })}
            {!candidates.length && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{candidateSource === "MY_LIST" ? "Nessun target configurato per questa scelta. Vai su Giocatori oppure usa Auto scelte · blocchi da 9." : "Non ci sono giocatori disponibili in questo ruolo."}</div>}
          </CardContent>
        </Card>

        <Card><CardHeader><CardTitle>Papabili avversari nel sottoround</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
          {active.filter((team) => !team.isMe).map((team) => { const behavior = observedBehavior(team, data.players, data.purchases, data.bids); return <div key={team.id} className="rounded-xl border p-4"><div className="mb-3 flex items-center justify-between gap-2"><div className="font-semibold">{team.name}</div><div className="flex gap-1"><Badge>{team.profile.split("_").join(" ")}</Badge><Badge>{behavior.multiplier.toFixed(2)}×</Badge></div></div><div className="space-y-2">{(predictions.get(team.id) ?? []).slice(0,4).map((prediction) => { const player = data.players.find((item) => item.id === prediction.playerId)!; return <div key={prediction.playerId} className="flex items-center justify-between gap-3 text-sm"><div><span className="font-medium">{packageMode ? `Pacchetto ${player.club}` : player.name}</span><span className="ml-2 text-xs text-muted-foreground">{player.club}</span></div><div className="text-right"><div className="font-semibold tabular">~{prediction.expectedBid}</div><div className="text-xs text-muted-foreground">{Math.round(prediction.probability * 100)}%</div></div></div> })}</div></div> })}
        </CardContent></Card>
      </div>

      <div className="space-y-6">
        <Card><CardHeader><CardTitle>{packageMode ? "Registra pacchetto portieri" : "Registra acquisto"}</CardTitle></CardHeader><CardContent className="space-y-4"><div><div className="mb-1.5 text-sm font-medium">Squadra</div><Select className="w-full" value={teamId} disabled={isClosed} onChange={(event) => setTeamId(event.target.value)}>{snapshots.map((team) => <option value={team.id} key={team.id}>{team.name} · {team.remaining} cr.</option>)}</Select></div><div><div className="mb-1.5 text-sm font-medium">{packageMode ? "Squadra Serie A" : "Giocatore"}</div><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" disabled={isClosed} value={selectedPlayer ? (packageMode ? `Pacchetto ${selectedPlayer.club}` : selectedPlayer.name) : playerQuery} onChange={(event) => { setSelectedPlayerId(""); setPlayerQuery(event.target.value); }} placeholder={packageMode ? "Cerca squadra o portiere…" : "Cerca tra i giocatori liberi…"} />{!selectedPlayerId && playerQuery && <div className="absolute z-20 mt-1 w-full rounded-lg border bg-background p-1 shadow-xl">{availableSearch.map((player) => { const pack = packageMode ? goalkeeperPackage(data.players, player) : [player]; const base = pack.reduce((sum, item) => sum + item.basePrice, 0); return <button key={player.id} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => selectPlayer(player)}><span><strong>{packageMode ? `Pacchetto ${player.club}` : player.name}</strong> <span className="text-muted-foreground">· {packageMode ? pack.map((item) => item.name).join(", ") : player.club}</span></span><Badge>{player.role} · {base}</Badge></button> })}</div>}</div></div><div><div className="mb-1.5 text-sm font-medium">Prezzo</div><Input type="number" disabled={isClosed} min={selectedMinPrice} value={price} onChange={(event) => setPrice(event.target.value)} /></div>{selectedPlayer && <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Minimo FantaMaster: <strong className="text-foreground">{selectedMinPrice}</strong>. {packageMode && <span>Dentro: <strong className="text-foreground">{selectedPackage.map((player) => player.name).join(", ")}</strong>. </span>}Budget {selectedTeam.name}: <strong className="text-foreground">{teamSnapshot(selectedTeam,data.players,data.purchases).remaining}</strong>.</div>}{error && <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}<Button className="w-full" disabled={isClosed} onClick={() => void register()}><CheckCircle2 className="h-4 w-4" />{packageMode ? "Assegna pacchetto" : "Assegna giocatore"}</Button></CardContent></Card>

        <Card><CardHeader><CardTitle>Registra busta persa / pari</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2"><Select value={bidTeamId} disabled={isClosed} onChange={(event) => setBidTeamId(event.target.value)}>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</Select><Select value={bidResult} disabled={isClosed} onChange={(event) => setBidResult(event.target.value as ObservedBid["result"])}><option value="LOST">Persa</option><option value="TIED">Pareggio</option></Select></div>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" disabled={isClosed} value={selectedBidPlayer ? (packageMode ? `Pacchetto ${selectedBidPlayer.club}` : selectedBidPlayer.name) : bidPlayerQuery} onChange={(event) => { setBidPlayerId(""); setBidPlayerQuery(event.target.value); }} placeholder={packageMode ? "Cerca pacchetto…" : `Cerca ${ROLE_LABELS[data.auction.currentRole].toLowerCase()}…`} />{!bidPlayerId && bidPlayerQuery && <div className="absolute z-20 mt-1 w-full rounded-lg border bg-background p-1 shadow-xl">{bidSearch.map((player) => { const pack = packageMode ? goalkeeperPackage(data.players, player) : [player]; const base = pack.reduce((sum, item) => sum + item.basePrice, 0); return <button key={player.id} className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent" onClick={() => selectPlayer(player, true)}><span><strong>{packageMode ? `Pacchetto ${player.club}` : player.name}</strong> <span className="text-muted-foreground">· {player.club}</span></span><Badge>{base}</Badge></button> })}</div>}</div>
          <Input type="number" disabled={isClosed} min={selectedBidMinPrice} value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} placeholder="Importo offerto" />
          {bidError && <div className="text-sm text-red-500">{bidError}</div>}
          <Button variant="outline" className="w-full" disabled={isClosed} onClick={() => void registerBid()}>Salva busta osservata</Button>
          {!!recentBids.length && <div className="space-y-1 border-t pt-3">{recentBids.map((bid) => { const player = data.players.find((item) => item.id === bid.playerId); const team = data.teams.find((item) => item.id === bid.fantasyTeamId); return <div key={bid.id} className="flex justify-between text-xs text-muted-foreground"><span>{team?.name} · {player?.name} · {bid.result === "TIED" ? "pari" : "persa"}</span><strong className="text-foreground">{bid.amount}</strong></div>; })}</div>}
        </CardContent></Card>

        <Card><CardHeader><CardTitle>Stato squadre</CardTitle></CardHeader><CardContent className="space-y-2">{snapshots.map((team) => <div key={team.id} className={`flex items-center justify-between rounded-lg border p-3 ${activeIds.has(team.id) ? "border-primary/30 bg-primary/5" : "opacity-65"}`}><div><div className="text-sm font-semibold">{team.name}</div><div className="text-xs text-muted-foreground">{activeIds.has(team.id) ? "Ancora attivo" : "Risolto / fuori fase"}</div></div><div className="flex items-center gap-2"><Coins className="h-4 w-4 text-muted-foreground" /><span className="font-bold tabular">{money(team.remaining)}</span></div></div>)}</CardContent></Card>

        <Card><CardHeader><CardTitle>Controlli tornata</CardTitle></CardHeader><CardContent className="space-y-2"><Button variant="outline" className="w-full justify-between" disabled={isClosed} onClick={nextSubRound}>Nuovo sottoround <RotateCcw className="h-4 w-4" /></Button><Button className="w-full justify-between" disabled={isClosed || data.auction.choiceNumber >= maxChoice} onClick={nextChoice}>Prossima scelta <ArrowRight className="h-4 w-4" /></Button><div className="pt-2 text-xs text-muted-foreground">Il nuovo sottoround mantiene fuori le squadre già risolte. La prossima scelta riattiva tutte le squadre che hanno ancora slot nel reparto.</div></CardContent></Card>
      </div>
    </div>
  </div>;
}

function Metric({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={`rounded-lg border p-3 ${emphasis ? "border-primary/30 bg-primary/10" : "bg-muted/40"}`}><div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div><div className={`mt-1 text-lg font-black tabular ${emphasis ? "text-primary" : ""}`}>{value}</div></div>;
}
