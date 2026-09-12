import { useCallback, useEffect, useState } from "react";
import type { AppSnapshot, AuctionState, FantasyTeam, ObservedBid, Player, Purchase, SerieAClub } from "@/types";
import {
  addObservedBid,
  addPurchase as persistPurchase,
  deleteObservedBid,
  deletePurchase as persistDeletePurchase,
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
    const player = data.players.find((item) => item.id === purchase.playerId);
    if (!player) return;
    const restored: Player = { ...player, status: "AVAILABLE", ownerId: undefined, purchasePrice: undefined };
    await persistDeletePurchase(purchase, restored);
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
    setData((current) => current ? {
      ...current,
      auction: nextAuction,
      purchases: current.purchases.filter((item) => item.id !== purchase.id),
      players: current.players.map((item) => item.id === restored.id ? restored : item),
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
    addBid,
    removeBid,
    undoPurchase,
    exportBackup,
    importBackup,
  };
}
