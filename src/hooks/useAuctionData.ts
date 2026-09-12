import { useCallback, useEffect, useState } from "react";
import type { AppSnapshot, AuctionState, FantasyTeam, ObservedBid, PendingPriceUpdate, Player, Purchase, SerieAClub } from "@/types";
import { ROLE_LIMITS } from "@/types";
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
  savePlayers,
  saveTeam,
  updatePurchasesAndPlayers,
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
  const updatePlayers = async (players: Player[]) => {
    await savePlayers(players);
    const updated = new Map(players.map((player) => [player.id, player]));
    setData((current) => current ? { ...current, players: current.players.map((player) => updated.get(player.id) ?? player) } : current);
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
  const finalizePendingPrices = async (updates: PendingPriceUpdate[]) => {
    if (!data || !updates.length) return;
    const changedPurchases = new Map<string, Purchase>();
    const changedPlayers = new Map<string, Player>();

    for (const update of updates) {
      const primary = data.purchases.find((purchase) => purchase.id === update.purchaseId);
      if (!primary || !primary.pricePending) continue;
      const group = primary.bundleId
        ? data.purchases.filter((purchase) => purchase.bundleId === primary.bundleId)
        : [primary];
      const sorted = [...group].sort((a, b) => a.timestamp - b.timestamp);
      sorted.forEach((purchase, index) => {
        const nextPurchase: Purchase = {
          ...purchase,
          price: index === 0 ? update.amount : 0,
          budgetImpact: index === 0 ? update.amount : 0,
          pricePending: false,
        };
        changedPurchases.set(nextPurchase.id, nextPurchase);
        const player = data.players.find((item) => item.id === purchase.playerId);
        if (player) changedPlayers.set(player.id, { ...player, purchasePrice: index === 0 ? update.amount : 0 });
      });
    }

    const purchases = [...changedPurchases.values()];
    const players = [...changedPlayers.values()];
    if (!purchases.length) return;
    await updatePurchasesAndPlayers(purchases, players);
    setData((current) => current ? {
      ...current,
      purchases: current.purchases.map((purchase) => changedPurchases.get(purchase.id) ?? purchase),
      players: current.players.map((player) => changedPlayers.get(player.id) ?? player),
    } : current);
  };
  const editPurchase = async (purchase: Purchase, nextTeamId: string, amount: number | null) => {
    if (!data) return;
    const source = data.purchases.find((item) => item.id === purchase.id) ?? purchase;
    const group = (source.bundleId ? data.purchases.filter((item) => item.bundleId === source.bundleId) : [source]).sort((a, b) => a.timestamp - b.timestamp);
    if (!group.length) return;
    const primary = group[0];
    const oldTeamId = primary.fantasyTeamId;
    const changedPurchases = new Map<string, Purchase>();
    const changedPlayers = new Map<string, Player>();

    group.forEach((item, index) => {
      const nextPurchase: Purchase = {
        ...item,
        fantasyTeamId: nextTeamId,
        price: index === 0 ? (amount ?? 0) : 0,
        budgetImpact: index === 0 ? (amount ?? 0) : 0,
        pricePending: index === 0 ? amount === null : false,
      };
      changedPurchases.set(nextPurchase.id, nextPurchase);
      const player = data.players.find((candidate) => candidate.id === item.playerId);
      if (player) changedPlayers.set(player.id, {
        ...player,
        ownerId: nextTeamId,
        purchasePrice: amount === null ? undefined : (index === 0 ? amount : 0),
      });
    });

    await updatePurchasesAndPlayers([...changedPurchases.values()], [...changedPlayers.values()]);

    let nextAuction = data.auction;
    const sameLiveRound = primary.role === data.auction.currentRole && primary.choiceNumber === data.auction.choiceNumber && primary.subRound === data.auction.subRound;
    if (sameLiveRound && oldTeamId !== nextTeamId) {
      const changedIds = new Set(group.map((item) => item.id));
      const oldStillResolved = data.purchases.some((item) =>
        !changedIds.has(item.id) &&
        item.fantasyTeamId === oldTeamId &&
        item.role === data.auction.currentRole &&
        item.choiceNumber === data.auction.choiceNumber &&
        item.subRound === data.auction.subRound
      );
      const resolved = new Set(data.auction.resolvedTeamIds);
      if (!oldStillResolved) resolved.delete(oldTeamId);
      resolved.add(nextTeamId);
      nextAuction = { ...data.auction, resolvedTeamIds: [...resolved] };
      await saveAuctionState(nextAuction);
    }

    setData((current) => current ? {
      ...current,
      auction: nextAuction,
      purchases: current.purchases.map((item) => changedPurchases.get(item.id) ?? item),
      players: current.players.map((item) => changedPlayers.get(item.id) ?? item),
    } : current);
  };
  const quickAddPurchase = async (teamId: string, playerId: string, amount: number | null) => {
    if (!data) return;
    const player = data.players.find((item) => item.id === playerId && item.status === "AVAILABLE");
    const team = data.teams.find((item) => item.id === teamId);
    if (!player || !team) return;

    const packageMode = player.role === "P" && data.auction.goalkeeperMode === "PACKAGE";
    const groupPlayers = packageMode
      ? data.players
          .filter((item) => item.status === "AVAILABLE" && item.role === "P" && item.club === player.club)
          .sort((a, b) => b.basePrice - a.basePrice)
          .slice(0, 3)
      : [player];
    if (packageMode && groupPlayers.length < 2) return;

    const currentRoleCount = data.purchases.filter((purchase) => purchase.fantasyTeamId === teamId && purchase.role === player.role).length;
    if (currentRoleCount + groupPlayers.length > ROLE_LIMITS[player.role]) return;

    const minimum = packageMode ? (groupPlayers[0]?.basePrice ?? player.basePrice) : player.basePrice;
    if (amount !== null && (!Number.isFinite(amount) || amount < minimum)) return;

    const liveRole = player.role === data.auction.currentRole;
    const choiceNumber = liveRole ? data.auction.choiceNumber : 1;
    const subRound = liveRole ? data.auction.subRound : 1;
    const now = Date.now();
    let newPurchases: Purchase[] = [];
    let updatedPlayers: Player[] = [];

    if (packageMode) {
      const bundleId = `gk-${now}-${teamId}-${player.club}`;
      const bundleLabel = `Pacchetto ${player.club}`;
      newPurchases = groupPlayers.map((item, index) => ({
        id: `${bundleId}-${item.id}`,
        playerId: item.id,
        fantasyTeamId: teamId,
        price: index === 0 ? (amount ?? 0) : 0,
        budgetImpact: index === 0 ? (amount ?? 0) : 0,
        pricePending: index === 0 ? amount === null : false,
        bundleId,
        bundleLabel,
        role: "P",
        choiceNumber,
        subRound,
        timestamp: now + index,
      }));
      updatedPlayers = groupPlayers.map((item, index) => ({
        ...item,
        status: "WON" as const,
        ownerId: teamId,
        purchasePrice: amount === null ? undefined : (index === 0 ? amount : 0),
      }));
      await persistPurchaseBundle(newPurchases, updatedPlayers);
    } else {
      const purchase: Purchase = {
        id: `${now}-${player.id}`,
        playerId: player.id,
        fantasyTeamId: teamId,
        price: amount ?? 0,
        budgetImpact: amount ?? 0,
        pricePending: amount === null,
        role: player.role,
        choiceNumber,
        subRound,
        timestamp: now,
      };
      const updatedPlayer: Player = {
        ...player,
        status: "WON",
        ownerId: teamId,
        purchasePrice: amount === null ? undefined : amount,
      };
      newPurchases = [purchase];
      updatedPlayers = [updatedPlayer];
      await persistPurchase(purchase, updatedPlayer);
    }

    let nextAuction = data.auction;
    if (liveRole && !data.auction.resolvedTeamIds.includes(teamId)) {
      nextAuction = { ...data.auction, resolvedTeamIds: [...data.auction.resolvedTeamIds, teamId] };
      await saveAuctionState(nextAuction);
    }

    const updated = new Map(updatedPlayers.map((item) => [item.id, item]));
    setData((current) => current ? {
      ...current,
      auction: nextAuction,
      purchases: [...current.purchases, ...newPurchases],
      players: current.players.map((item) => updated.get(item.id) ?? item),
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
    updatePlayers,
    updateClub,
    updateTeam,
    updateAuction,
    replaceCatalog,
    addPurchase,
    addPurchaseBundle,
    finalizePendingPrices,
    editPurchase,
    quickAddPurchase,
    addBid,
    removeBid,
    undoPurchase,
    exportBackup,
    importBackup,
  };
}
