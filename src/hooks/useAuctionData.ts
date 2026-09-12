import { useCallback, useEffect, useState } from "react";
import type { AppSnapshot, AuctionState, FantasyTeam, ObservedBid, Player, Purchase, SerieAClub } from "@/types";
import {
  addObservedBid,
  addPurchase as persistPurchase,
  addPurchaseBundle as persistPurchaseBundle,
  deleteObservedBid,
  deletePurchase as persistDeletePurchase,
  deletePurchaseBundle as persistDeletePurchaseBundle,
  exportDatabase,
  importDatabase,
  loadAll,
  replacePlayerCatalog,
  saveAuctionState,
  saveClub,
  savePlayer,
  saveTeam,
} from "@/lib/db";

export function useAuctionData() {
  const [data, setData] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setData(await loadAll());
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const updatePlayer = async (player: Player) => {
    await savePlayer(player);
    setData((current) => current ? { ...current, players: current.players.map((p) => p.id === player.id ? player : p) } : current);
  };
  const updateClub = async (club: SerieAClub) => {
    await saveClub(club);
    setData((current) => current ? { ...current, clubs: current.clubs.map((c) => c.id === club.id ? club : c) } : current);
  };
  const updateTeam = async (team: FantasyTeam) => {
    await saveTeam(team);
    setData((current) => current ? { ...current, teams: current.teams.map((t) => t.id === team.id ? team : t) } : current);
  };
  const updateAuction = async (auction: AuctionState) => {
    await saveAuctionState(auction);
    setData((current) => current ? { ...current, auction } : current);
  };
  const replaceCatalog = async (players: Player[], clubs: SerieAClub[]) => {
    await replacePlayerCatalog(players, clubs);
    setData((current) => current ? { ...current, players, clubs } : current);
  };
  const addPurchase = async (purchase: Purchase, player: Player) => {
    await persistPurchase(purchase, player);
    setData((current) => current ? {
      ...current,
      purchases: [...current.purchases, purchase],
      players: current.players.map((p) => p.id === player.id ? player : p),
    } : current);
  };
  const addPurchaseBundle = async (purchases: Purchase[], players: Player[]) => {
    await persistPurchaseBundle(purchases, players);
    const updated = new Map(players.map((player) => [player.id, player]));
    setData((current) => current ? {
      ...current,
      purchases: [...current.purchases, ...purchases],
      players: current.players.map((player) => updated.get(player.id) ?? player),
    } : current);
  };
  const addBid = async (bid: ObservedBid) => {
    await addObservedBid(bid);
    setData((current) => current ? { ...current, bids: [...current.bids, bid] } : current);
  };
  const removeBid = async (bid: ObservedBid) => {
    await deleteObservedBid(bid);
    setData((current) => current ? { ...current, bids: current.bids.filter((item) => item.id !== bid.id) } : current);
  };
  const undoPurchase = async (purchase: Purchase) => {
    if (!data) return;
    const group = purchase.bundleId ? data.purchases.filter((item) => item.bundleId === purchase.bundleId) : [purchase];
    const restored = group
      .map((item) => data.players.find((player) => player.id === item.playerId))
      .filter((player): player is Player => Boolean(player))
      .map((player) => ({ ...player, status: "AVAILABLE" as const, ownerId: undefined, purchasePrice: undefined }));
    if (!restored.length) return;
    if (group.length > 1 || purchase.bundleId) await persistDeletePurchaseBundle(group, restored);
    else await persistDeletePurchase(purchase, restored[0]);

    let nextAuction = data.auction;
    if (
      purchase.role === data.auction.currentRole &&
      purchase.choiceNumber === data.auction.choiceNumber &&
      purchase.subRound === data.auction.subRound &&
      data.auction.resolvedTeamIds.includes(purchase.fantasyTeamId)
    ) {
      nextAuction = { ...data.auction, resolvedTeamIds: data.auction.resolvedTeamIds.filter((id) => id !== purchase.fantasyTeamId) };
      await saveAuctionState(nextAuction);
    }
    const restoredMap = new Map(restored.map((player) => [player.id, player]));
    const deletedIds = new Set(group.map((item) => item.id));
    setData((current) => current ? {
      ...current,
      auction: nextAuction,
      purchases: current.purchases.filter((item) => !deletedIds.has(item.id)),
      players: current.players.map((item) => restoredMap.get(item.id) ?? item),
    } : current);
  };
  const exportBackup = async () => exportDatabase();
  const importBackup = async (snapshot: AppSnapshot) => {
    await importDatabase(snapshot);
    await refresh();
  };

  return {
    data,
    loading,
    refresh,
    updatePlayer,
    updateClub,
    updateTeam,
    updateAuction,
    replaceCatalog,
    addPurchase,
    addPurchaseBundle,
    addBid,
    removeBid,
    undoPurchase,
    exportBackup,
    importBackup,
  };
}
