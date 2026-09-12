import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Coins, Pencil, RotateCcw, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { purchaseBudgetImpact, teamSnapshot } from "@/lib/analytics";
import type { AppSnapshot, Purchase, Role } from "@/types";
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

function displayPrice(purchase: Purchase, data: AppSnapshot) {
  const group = groupForPurchase(purchase, data);
  const primary = group[0] ?? purchase;
  if (primary.pricePending) return "Da inserire";
  const total = group.reduce((sum, item) => sum + purchaseBudgetImpact(item), 0);
  return purchase.bundleId ? `${total} cr. · bundle` : `${total} cr.`;
}

export function RosterModal({
  data,
  teamId,
  onOpenChange,
  onEditPurchase,
  onUndoPurchase,
}: {
  data: AppSnapshot;
  teamId: string;
  onOpenChange: (open: boolean) => void;
  onEditPurchase: (purchase: Purchase, nextTeamId: string, amount: number | null) => Promise<void>;
  onUndoPurchase: (purchase: Purchase) => Promise<void>;
}) {
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editError, setEditError] = useState("");
  const [confirmRelease, setConfirmRelease] = useState(false);
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
  const selectedCurrentCost = selectedGroup.reduce((sum, item) => sum + purchaseBudgetImpact(item), 0);
  const selectedMinimum = selectedGroup.length
    ? Math.max(...selectedGroup.map((purchase) => data.players.find((player) => player.id === purchase.playerId)?.basePrice ?? 0))
    : selectedPlayer?.basePrice ?? 0;
  const isClosed = Boolean(data.auction.closedAt);

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
      <DialogContent className="max-w-4xl p-4 sm:p-6">
        <DialogTitle className="pr-10 text-xl font-black sm:text-2xl">{team.isMe ? "La mia rosa · Soze Heaven" : `Rosa · ${team.name}`}</DialogTitle>
        <DialogDescription>Clicca un giocatore per correggere prezzo o proprietario. Tutte le modifiche aggiornano subito budget, storico e algoritmo.</DialogDescription>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <MiniStat label="Spesi" value={snapshot.spent} />
          <MiniStat label="Rimasti" value={snapshot.remaining} />
          <MiniStat label="Rosa" value={`${snapshot.totalPlayers}/25`} />
          <MiniStat label="Liberi" value={snapshot.freeBudget} />
        </div>
        {snapshot.pendingPrices > 0 && <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">Budget provvisorio: {snapshot.pendingPrices} {snapshot.pendingPrices === 1 ? "prezzo è ancora da inserire" : "prezzi sono ancora da inserire"}.</div>}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(["P", "D", "C", "A"] as Role[]).map((role) => {
            const rolePurchases = roster.filter((purchase) => purchase.role === role);
            return <section key={role} className="rounded-xl border p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between"><div className="font-bold">{ROLE_LABELS[role]}</div><Badge>{rolePurchases.length}/{ROLE_LIMITS[role]}</Badge></div>
              <div className="space-y-2">
                {rolePurchases.map((purchase) => {
                  const player = data.players.find((item) => item.id === purchase.playerId);
                  if (!player) return null;
                  const primary = primaryForPurchase(purchase, data);
                  return <button key={purchase.id} type="button" className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-left transition hover:border-primary/40 hover:bg-accent/40" onClick={() => openPlayer(purchase)}>
                    <div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><span className="truncate font-semibold">{player.name}</span>{purchase.bundleId && <Badge className="shrink-0">BUNDLE</Badge>}</div><div className="mt-0.5 text-[11px] text-muted-foreground">{player.club} · quota {player.basePrice}{purchase.bundleId && primary.id !== purchase.id ? " · incluso nello stesso pacchetto" : ""}</div></div>
                    <div className={`shrink-0 text-right text-xs font-bold ${primary.pricePending ? "text-amber-600" : ""}`}>{displayPrice(purchase, data)}</div>
                  </button>;
                })}
                {!rolePurchases.length && <div className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Nessun giocatore</div>}
              </div>
            </section>;
          })}
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(selectedPurchaseId)} onOpenChange={(open) => { if (!open) setSelectedPurchaseId(""); }}>
      <DialogContent className="max-w-lg p-4 sm:p-6">
        <DialogTitle className="pr-10 text-xl font-black">Modifica acquisto</DialogTitle>
        <DialogDescription>{selectedPrimary?.bundleId ? "La modifica vale per l'intero pacchetto portieri." : "Correggi squadra o prezzo del giocatore."}</DialogDescription>
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
