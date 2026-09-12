import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Coins, Pencil, Plus, RotateCcw, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { purchaseBudgetImpact, teamSnapshot } from "@/lib/analytics";
import type { AppSnapshot, Player, Purchase, Role } from "@/types";
import { ROLE_LABELS, ROLE_LIMITS } from "@/types";

function groupForPurchase(purchase: Purchase, data: AppSnapshot) {
  return (purchase.bundleId
    ? data.purchases.filter((item) => item.bundleId === purchase.bundleId)
    : [purchase]
  ).sort((a, b) => a.timestamp - b.timestamp);
}

function primaryForPurchase(purchase: Purchase, data: AppSnapshot) {
  return groupForPurchase(purchase, data)[0] ?? purchase;
}

function groupCost(group: Purchase[]) {
  return group.reduce((sum, item) => sum + purchaseBudgetImpact(item), 0);
}

function minimumForGroup(group: Purchase[], data: AppSnapshot) {
  return Math.max(0, ...group.map((purchase) => data.players.find((player) => player.id === purchase.playerId)?.basePrice ?? 0));
}

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
    .filter((group) => group.length >= 2)
    .map((group) => [...group].sort((a, b) => b.basePrice - a.basePrice)[0])
    .filter((player): player is Player => Boolean(player));
}

type AddDraft = { query: string; playerId: string; price: string; error: string };

const emptyDraft = (): AddDraft => ({ query: "", playerId: "", price: "", error: "" });
const emptyDrafts = (): Record<Role, AddDraft> => ({ P: emptyDraft(), D: emptyDraft(), C: emptyDraft(), A: emptyDraft() });

export function RosterModal({
  data,
  teamId,
  onOpenChange,
  onTeamChange,
  onEditPurchase,
  onUndoPurchase,
  onQuickAdd,
}: {
  data: AppSnapshot;
  teamId: string;
  onOpenChange: (open: boolean) => void;
  onTeamChange: (teamId: string) => void;
  onEditPurchase: (purchase: Purchase, nextTeamId: string, amount: number | null) => Promise<void>;
  onUndoPurchase: (purchase: Purchase) => Promise<void>;
  onQuickAdd: (teamId: string, playerId: string, amount: number | null) => Promise<void>;
}) {
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editError, setEditError] = useState("");
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [inlineError, setInlineError] = useState("");
  const [addDrafts, setAddDrafts] = useState<Record<Role, AddDraft>>(emptyDrafts);
  const team = data.teams.find((item) => item.id === teamId);
  const snapshot = team ? teamSnapshot(team, data.players, data.purchases) : null;
  const roster = useMemo(
    () => data.purchases.filter((purchase) => purchase.fantasyTeamId === teamId).sort((a, b) => a.timestamp - b.timestamp),
    [data.purchases, teamId],
  );
  const selectedPurchase = data.purchases.find((purchase) => purchase.id === selectedPurchaseId);
  const selectedGroup = selectedPurchase ? groupForPurchase(selectedPurchase, data) : [];
  const selectedPrimary = selectedGroup[0] ?? selectedPurchase;
  const selectedPlayer = selectedPrimary ? data.players.find((player) => player.id === selectedPrimary.playerId) : undefined;
  const selectedCurrentCost = groupCost(selectedGroup);
  const selectedMinimum = selectedGroup.length ? minimumForGroup(selectedGroup, data) : selectedPlayer?.basePrice ?? 0;
  const isClosed = Boolean(data.auction.closedAt);

  useEffect(() => {
    const next: Record<string, string> = {};
    const seen = new Set<string>();
    for (const purchase of roster) {
      const primary = primaryForPurchase(purchase, data);
      if (seen.has(primary.id)) continue;
      seen.add(primary.id);
      const group = groupForPurchase(primary, data);
      next[primary.id] = primary.pricePending ? "" : String(groupCost(group));
    }
    setPriceDrafts(next);
    setInlineError("");
    setAddDrafts(emptyDrafts());
  }, [teamId, data.purchases]);

  useEffect(() => {
    if (!selectedPrimary) return;
    setEditTeamId(selectedPrimary.fantasyTeamId);
    setEditPrice(selectedPrimary.pricePending ? "" : String(selectedCurrentCost));
    setEditError("");
    setConfirmRelease(false);
  }, [selectedPurchaseId]);

  const openPlayer = (purchase: Purchase) => {
    const primary = primaryForPurchase(purchase, data);
    setSelectedPurchaseId(primary.id);
  };

  const saveInlinePrice = async (purchase: Purchase) => {
    if (!team || isClosed) return;
    const primary = primaryForPurchase(purchase, data);
    const group = groupForPurchase(primary, data);
    const minimum = minimumForGroup(group, data);
    const current = groupCost(group);
    const raw = (priceDrafts[primary.id] ?? "").trim();
    const amount = raw === "" ? null : Number(raw);
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) return setInlineError("Prezzo non valido: usa un numero positivo oppure lascia vuoto.");
    if (amount !== null && amount < minimum) return setInlineError(`${primary.bundleLabel ?? data.players.find((player) => player.id === primary.playerId)?.name}: minimo ${minimum}.`);
    const available = snapshot ? snapshot.remaining + current : team.initialBudget;
    if (amount !== null && amount > available) return setInlineError(`${team.name}: massimo ${available} crediti disponibili per questa correzione.`);
    setInlineError("");
    if ((amount === null && primary.pricePending) || (amount !== null && !primary.pricePending && amount === current)) return;
    await onEditPurchase(primary, team.id, amount);
  };

  const removeInline = async (purchase: Purchase) => {
    if (isClosed) return;
    setInlineError("");
    await onUndoPurchase(primaryForPurchase(purchase, data));
  };

  const updateAddDraft = (role: Role, patch: Partial<AddDraft>) => {
    setAddDrafts((current) => ({ ...current, [role]: { ...current[role], ...patch } }));
  };

  const availableForRole = (role: Role) => {
    if (role === "P" && data.auction.goalkeeperMode === "PACKAGE") return packageRepresentatives(data.players);
    return data.players.filter((player) => player.status === "AVAILABLE" && player.role === role);
  };

  const choosePlayer = (role: Role, player: Player) => {
    updateAddDraft(role, {
      playerId: player.id,
      query: role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? `Pacchetto ${player.club}` : player.name,
      price: "",
      error: "",
    });
  };

  const quickAdd = async (role: Role) => {
    if (!team || !snapshot || isClosed) return;
    const draft = addDrafts[role];
    const player = data.players.find((item) => item.id === draft.playerId && item.status === "AVAILABLE");
    if (!player) return updateAddDraft(role, { error: "Seleziona un giocatore libero dalla ricerca." });

    const packagePlayers = role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? goalkeeperPackage(data.players, player) : [player];
    if (role === "P" && data.auction.goalkeeperMode === "PACKAGE" && packagePlayers.length < 2) {
      return updateAddDraft(role, { error: `Il pacchetto ${player.club} deve avere almeno 2 portieri liberi.` });
    }
    if (snapshot.counts[role] + packagePlayers.length > ROLE_LIMITS[role]) {
      return updateAddDraft(role, { error: `Non ci sono abbastanza slot liberi in ${ROLE_LABELS[role].toLowerCase()}.` });
    }

    const minimum = role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? packagePlayers[0]?.basePrice ?? player.basePrice : player.basePrice;
    const raw = draft.price.trim();
    const amount = raw === "" ? null : Number(raw);
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) return updateAddDraft(role, { error: "Prezzo non valido." });
    if (amount !== null && amount < minimum) return updateAddDraft(role, { error: `Minimo FantaMaster: ${minimum}.` });
    if (amount !== null && amount > snapshot.remaining) return updateAddDraft(role, { error: `Budget insufficiente: restano ${snapshot.remaining} crediti.` });

    await onQuickAdd(team.id, player.id, amount);
    updateAddDraft(role, emptyDraft());
  };

  const saveEdit = async () => {
    setEditError("");
    if (!selectedPrimary || !editTeamId) return;
    if (isClosed) return setEditError("L'asta è chiusa. Riaprila dal Report finale per modificare una rosa.");
    const destination = data.teams.find((item) => item.id === editTeamId);
    if (!destination) return setEditError("Squadra di destinazione non valida.");

    const groupIds = new Set(selectedGroup.map((item) => item.id));
    const destinationRoleCount = data.purchases.filter((purchase) =>
      purchase.fantasyTeamId === destination.id &&
      purchase.role === selectedPrimary.role &&
      !groupIds.has(purchase.id)
    ).length;
    if (destinationRoleCount + selectedGroup.length > ROLE_LIMITS[selectedPrimary.role]) {
      return setEditError(`${destination.name} non ha abbastanza slot liberi in ${ROLE_LABELS[selectedPrimary.role].toLowerCase()}.`);
    }

    const raw = editPrice.trim();
    const amount = raw === "" ? null : Number(raw);
    if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) return setEditError("Inserisci un prezzo valido oppure lascia vuoto per segnarlo come da completare.");
    if (amount !== null && amount < selectedMinimum) return setEditError(`Il minimo FantaMaster è ${selectedMinimum} crediti.`);

    const destinationSnapshot = teamSnapshot(destination, data.players, data.purchases);
    const refundable = destination.id === selectedPrimary.fantasyTeamId ? selectedCurrentCost : 0;
    const available = destinationSnapshot.remaining + refundable;
    if (amount !== null && amount > available) return setEditError(`${destination.name} può spendere al massimo ${available} crediti in questa correzione.`);

    await onEditPurchase(selectedPrimary, destination.id, amount);
    setSelectedPurchaseId("");
  };

  const releasePlayer = async () => {
    if (!selectedPrimary || isClosed) return;
    await onUndoPurchase(selectedPrimary);
    setSelectedPurchaseId("");
    setConfirmRelease(false);
  };

  if (!team || !snapshot) return null;

  return <>
    <Dialog open={Boolean(teamId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-3 sm:p-6">
        <DialogTitle className="pr-10 text-xl font-black sm:text-2xl">{team.isMe ? "La mia rosa · Soze Heaven" : `Rosa · ${team.name}`}</DialogTitle>
        <DialogDescription>Modalità rapida stile Excel: modifica il prezzo nella cella e premi Invio, usa × per togliere un giocatore, oppure compila la riga vuota per aggiungerlo.</DialogDescription>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Squadra
            <Select className="mt-1.5 w-full" value={teamId} onChange={(event) => onTeamChange(event.target.value)}>{data.teams.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isMe ? " · NOI" : ""}</option>)}</Select>
          </label>
          <div className="grid grid-cols-4 gap-2">
            <MiniStat label="Spesi" value={snapshot.spent} />
            <MiniStat label="Rimasti" value={snapshot.remaining} />
            <MiniStat label="Rosa" value={`${snapshot.totalPlayers}/25`} />
            <MiniStat label="Liberi" value={snapshot.freeBudget} />
          </div>
        </div>
        {snapshot.pendingPrices > 0 && <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">Budget provvisorio: {snapshot.pendingPrices} {snapshot.pendingPrices === 1 ? "prezzo è ancora da inserire" : "prezzi sono ancora da inserire"}.</div>}
        {inlineError && <div className="mt-3 flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500"><AlertTriangle className="h-4 w-4 shrink-0" />{inlineError}</div>}

        <div className="mt-5 space-y-4">
          {(["P", "D", "C", "A"] as Role[]).map((role) => {
            const seen = new Set<string>();
            const entries = roster.filter((purchase) => purchase.role === role).flatMap((purchase) => {
              const primary = primaryForPurchase(purchase, data);
              if (seen.has(primary.id)) return [];
              seen.add(primary.id);
              const group = groupForPurchase(primary, data);
              const players = group.map((item) => data.players.find((player) => player.id === item.playerId)).filter((player): player is Player => Boolean(player));
              return [{ primary, group, players }];
            });
            const draft = addDrafts[role];
            const pool = availableForRole(role);
            const query = draft.query.trim().toLowerCase();
            const matches = query && !draft.playerId
              ? pool.filter((player) => `${player.name} ${player.club}`.toLowerCase().includes(query)).slice(0, 6)
              : [];
            const selectedAddPlayer = data.players.find((player) => player.id === draft.playerId);
            const selectedPack = role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? goalkeeperPackage(data.players, selectedAddPlayer) : selectedAddPlayer ? [selectedAddPlayer] : [];
            const selectedMin = selectedAddPlayer ? (role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? selectedPack[0]?.basePrice ?? selectedAddPlayer.basePrice : selectedAddPlayer.basePrice) : 0;

            return <section key={role} className="overflow-visible rounded-xl border">
              <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2"><div className="font-bold">{ROLE_LABELS[role]}</div><Badge>{snapshot.counts[role]}/{ROLE_LIMITS[role]}</Badge></div>
              <div className="overflow-x-auto">
                <div className="min-w-[620px]">
                  <div className="grid grid-cols-[minmax(250px,1fr)_90px_120px_82px] gap-2 border-b px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"><div>Giocatore</div><div>Quota</div><div>Prezzo</div><div></div></div>
                  {entries.map(({ primary, group, players }) => {
                    const minimum = minimumForGroup(group, data);
                    const label = primary.bundleId ? (primary.bundleLabel ?? `Pacchetto ${players[0]?.club ?? ""}`) : players[0]?.name ?? "Giocatore";
                    const detail = primary.bundleId ? players.map((player) => player.name).join(", ") : `${players[0]?.club ?? ""}`;
                    return <div key={primary.id} className="grid grid-cols-[minmax(250px,1fr)_90px_120px_82px] items-center gap-2 border-b px-3 py-2 last:border-b-0">
                      <div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-semibold">{label}</span>{primary.bundleId && <Badge className="shrink-0">BUNDLE</Badge>}</div><div className="truncate text-[11px] text-muted-foreground">{detail}</div></div>
                      <div className="font-bold tabular">{minimum}</div>
                      <Input
                        className={`h-9 font-bold tabular ${primary.pricePending ? "border-amber-500/40 text-amber-600" : ""}`}
                        type="number"
                        inputMode="numeric"
                        min={minimum}
                        disabled={isClosed}
                        value={priceDrafts[primary.id] ?? ""}
                        placeholder="—"
                        onChange={(event) => setPriceDrafts((current) => ({ ...current, [primary.id]: event.target.value }))}
                        onKeyDown={(event) => { if (event.key === "Enter") { event.currentTarget.blur(); } }}
                        onBlur={() => void saveInlinePrice(primary)}
                      />
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-9 w-9" title="Modifica dettagli" onClick={() => openPlayer(primary)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-red-500 hover:text-red-500" title="Rimetti libero" disabled={isClosed} onClick={() => void removeInline(primary)}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>;
                  })}

                  {snapshot.counts[role] < ROLE_LIMITS[role] && <div className="grid grid-cols-[minmax(250px,1fr)_90px_120px_82px] items-start gap-2 bg-primary/[0.035] px-3 py-2">
                    <div className="relative">
                      <Input
                        className="h-9"
                        disabled={isClosed}
                        value={draft.query}
                        placeholder={role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? "Aggiungi pacchetto squadra…" : "Aggiungi giocatore…"}
                        onChange={(event) => updateAddDraft(role, { query: event.target.value, playerId: "", error: "" })}
                      />
                      {!!matches.length && <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-background p-1 shadow-xl">{matches.map((player) => {
                        const pack = role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? goalkeeperPackage(data.players, player) : [player];
                        const minimum = role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? pack[0]?.basePrice ?? player.basePrice : player.basePrice;
                        return <button type="button" key={player.id} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-accent" onClick={() => choosePlayer(role, player)}><span className="min-w-0 truncate"><strong>{role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? `Pacchetto ${player.club}` : player.name}</strong><span className="text-muted-foreground"> · {role === "P" && data.auction.goalkeeperMode === "PACKAGE" ? `${pack.length} P` : player.club}</span></span><Badge>{minimum}</Badge></button>;
                      })}</div>}
                      {draft.error && <div className="mt-1 text-[11px] text-red-500">{draft.error}</div>}
                    </div>
                    <div className="pt-2 text-xs font-bold tabular">{selectedAddPlayer ? selectedMin : "—"}</div>
                    <Input
                      className="h-9 font-bold tabular"
                      type="number"
                      inputMode="numeric"
                      min={selectedMin || undefined}
                      disabled={isClosed || !selectedAddPlayer}
                      value={draft.price}
                      placeholder="prezzo"
                      onChange={(event) => updateAddDraft(role, { price: event.target.value, error: "" })}
                      onKeyDown={(event) => { if (event.key === "Enter") void quickAdd(role); }}
                    />
                    <div className="flex justify-end"><Button size="sm" className="h-9 px-3" disabled={isClosed || !selectedAddPlayer} onClick={() => void quickAdd(role)}><Plus className="h-4 w-4" />Aggiungi</Button></div>
                  </div>}
                </div>
              </div>
            </section>;
          })}
        </div>

        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground"><Check className="h-3.5 w-3.5 text-primary" />Prezzo vuoto = da completare dopo. Su un prezzo esistente basta digitare e premere Invio o uscire dalla cella.</div>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(selectedPurchaseId)} onOpenChange={(open) => { if (!open) setSelectedPurchaseId(""); }}>
      <DialogContent className="max-w-lg p-4 sm:p-6">
        <DialogTitle className="pr-10 text-xl font-black">Modifica acquisto</DialogTitle>
        <DialogDescription>{selectedPrimary?.bundleId ? "La modifica vale per l'intero pacchetto portieri." : "Usa questa finestra soprattutto per spostare il giocatore a un'altra squadra."}</DialogDescription>
        {selectedPlayer && <div className="mt-4 rounded-xl border bg-muted/30 p-3"><div className="flex items-center justify-between gap-3"><div><div className="font-bold">{selectedPrimary?.bundleLabel ?? selectedPlayer.name}</div><div className="mt-1 text-xs text-muted-foreground">{selectedPrimary?.bundleId ? selectedGroup.map((purchase) => data.players.find((player) => player.id === purchase.playerId)?.name).filter(Boolean).join(", ") : `${selectedPlayer.club} · ${ROLE_LABELS[selectedPlayer.role]}`}</div></div><Badge>min {selectedMinimum}</Badge></div></div>}

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium">Proprietario<Select className="mt-1.5 w-full" value={editTeamId} disabled={isClosed} onChange={(event) => setEditTeamId(event.target.value)}>{data.teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></label>
          <label className="block text-sm font-medium">Prezzo pagato <span className="font-normal text-muted-foreground">(vuoto = da completare)</span><Input className="mt-1.5 h-12 text-lg font-black tabular" type="number" inputMode="numeric" min={selectedMinimum} value={editPrice} disabled={isClosed} onChange={(event) => setEditPrice(event.target.value)} placeholder="Prezzo da inserire" /></label>
          {editError && <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500"><AlertTriangle className="h-4 w-4 shrink-0" />{editError}</div>}
          {confirmRelease && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm"><div className="font-semibold text-red-500">Rimettere {selectedPrimary?.bundleLabel ?? selectedPlayer?.name} tra i liberi?</div><div className="mt-2 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setConfirmRelease(false)}>Annulla</Button><Button variant="destructive" onClick={() => void releasePlayer()}><RotateCcw className="h-4 w-4" />Conferma</Button></div></div>}
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" disabled={isClosed} onClick={() => setConfirmRelease(true)}><RotateCcw className="h-4 w-4" />Rimetti libero</Button><Button disabled={isClosed} onClick={() => void saveEdit()}><Pencil className="h-4 w-4" />Salva modifica</Button></div>
          {isClosed && <div className="text-xs text-muted-foreground">Asta chiusa: la rosa è consultabile ma non modificabile finché non la riapri dal Report finale.</div>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border bg-muted/30 p-2 text-center"><div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">{label}</div><div className="mt-1 flex items-center justify-center gap-1 text-sm font-black tabular sm:text-base">{label === "Rimasti" && <Coins className="h-3.5 w-3.5" />}{label === "Rosa" && <Users className="h-3.5 w-3.5" />}{value}</div></div>;
}
