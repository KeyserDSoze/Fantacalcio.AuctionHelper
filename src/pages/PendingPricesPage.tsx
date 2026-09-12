import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ReceiptText, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { teamSnapshot } from "@/lib/analytics";
import type { AppSnapshot, PendingPriceUpdate, Purchase } from "@/types";
import { ROLE_LABELS } from "@/types";

function pendingBasePrice(purchase: Purchase, data: AppSnapshot) {
  const group = purchase.bundleId
    ? data.purchases.filter((item) => item.bundleId === purchase.bundleId)
    : [purchase];
  return group.reduce((sum, item) => sum + (data.players.find((player) => player.id === item.playerId)?.basePrice ?? 0), 0);
}

function pendingLabel(purchase: Purchase, data: AppSnapshot) {
  if (purchase.bundleLabel) return purchase.bundleLabel;
  return data.players.find((player) => player.id === purchase.playerId)?.name ?? "Giocatore";
}

export function PendingPricesPage({
  data,
  onSave,
}: {
  data: AppSnapshot;
  onSave: (updates: PendingPriceUpdate[]) => Promise<void>;
}) {
  const pending = useMemo(
    () => data.purchases.filter((purchase) => purchase.pricePending).sort((a, b) => a.timestamp - b.timestamp),
    [data.purchases],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setValues((current) => Object.fromEntries(pending.map((purchase) => [purchase.id, current[purchase.id] ?? ""])));
  }, [pending]);

  const saveAll = async () => {
    setError("");
    setMessage("");
    const updates: PendingPriceUpdate[] = [];
    const totalsByTeam = new Map<string, number>();

    for (const purchase of pending) {
      const raw = (values[purchase.id] ?? "").trim();
      if (!raw) continue;
      const amount = Number(raw);
      const minimum = pendingBasePrice(purchase, data);
      if (!Number.isFinite(amount) || amount <= 0) return setError(`Prezzo non valido per ${pendingLabel(purchase, data)}.`);
      if (amount < minimum) return setError(`${pendingLabel(purchase, data)}: minimo FantaMaster ${minimum}, hai inserito ${amount}.`);
      updates.push({ purchaseId: purchase.id, amount });
      totalsByTeam.set(purchase.fantasyTeamId, (totalsByTeam.get(purchase.fantasyTeamId) ?? 0) + amount);
    }

    if (!updates.length) return setError("Inserisci almeno un prezzo da salvare.");

    for (const [teamId, total] of totalsByTeam) {
      const team = data.teams.find((item) => item.id === teamId);
      if (!team) continue;
      const remaining = teamSnapshot(team, data.players, data.purchases).remaining;
      if (total > remaining) return setError(`${team.name}: i prezzi inseriti (${total}) superano i ${remaining} crediti attualmente disponibili.`);
    }

    await onSave(updates);
    setMessage(`${updates.length} ${updates.length === 1 ? "prezzo aggiornato" : "prezzi aggiornati"}. Budget, storico e algoritmo sono stati ricalcolati.`);
  };

  return <div className="space-y-4 sm:space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Prezzi da completare</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">Segna subito chi ha preso il giocatore e compila i prezzi anche qualche minuto dopo, tutti insieme.</p></div>
      <Button className="min-h-11 sm:w-auto" disabled={!pending.length} onClick={() => void saveAll()}><Save className="h-4 w-4" />Salva prezzi compilati</Button>
    </div>

    <Card className="border-primary/20"><CardContent className="flex gap-3 p-4 text-sm"><ReceiptText className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><strong>{pending.length} prezzi ancora mancanti.</strong><div className="mt-1 text-muted-foreground">Finché un prezzo è vuoto il giocatore è già assegnato e sparisce dai liberi, ma il budget della squadra e le statistiche sui prezzi non vengono ancora modificati.</div></div></CardContent></Card>

    {error && <div className="flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
    {message && <div className="flex gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-primary"><CheckCircle2 className="h-4 w-4 shrink-0" />{message}</div>}

    {!pending.length ? <Card><CardContent className="py-14 text-center"><CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-primary" /><div className="font-semibold">Tutti i prezzi sono completi</div><div className="mt-1 text-sm text-muted-foreground">Quando segni un acquisto senza prezzo comparirà automaticamente qui.</div></CardContent></Card> : <Card>
      <CardHeader><CardTitle>Inserimento rapido</CardTitle></CardHeader>
      <CardContent>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="pb-3">Giocatore</th><th className="pb-3">Squadra</th><th className="pb-3">Ruolo</th><th className="pb-3 text-right">Minimo</th><th className="pb-3">Prezzo reale</th></tr></thead>
            <tbody>{pending.map((purchase) => { const team = data.teams.find((item) => item.id === purchase.fantasyTeamId); const minimum = pendingBasePrice(purchase, data); return <tr key={purchase.id} className="border-t"><td className="py-3 font-semibold">{pendingLabel(purchase, data)}{purchase.bundleLabel && <Badge className="ml-2">Pacchetto</Badge>}</td><td>{team?.name}</td><td>{ROLE_LABELS[purchase.role]}</td><td className="text-right font-bold tabular">{minimum}</td><td className="w-44 pl-4"><Input className="font-bold tabular" type="number" inputMode="numeric" min={minimum} placeholder="—" value={values[purchase.id] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [purchase.id]: event.target.value }))} /></td></tr>; })}</tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">{pending.map((purchase) => { const team = data.teams.find((item) => item.id === purchase.fantasyTeamId); const minimum = pendingBasePrice(purchase, data); return <div key={purchase.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-bold">{pendingLabel(purchase, data)}</div><div className="mt-1 text-xs text-muted-foreground">{team?.name} · {ROLE_LABELS[purchase.role]}</div></div><Badge className="shrink-0">min {minimum}</Badge></div><Input className="mt-3 h-12 text-lg font-black tabular" type="number" inputMode="numeric" min={minimum} placeholder="Inserisci prezzo" value={values[purchase.id] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [purchase.id]: event.target.value }))} /></div>; })}</div>
      </CardContent>
    </Card>}
  </div>;
}
