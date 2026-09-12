import { openDB, type DBSchema } from "idb";
import type { AppSnapshot, AuctionState, FantasyTeam, ObservedBid, Player, Purchase, SerieAClub } from "@/types";
import { DEFAULT_AUCTION, DEFAULT_TEAMS } from "@/lib/defaults";
import { buildDefaultCatalog } from "@/data/defaultCatalog";
import { fillMissingClubTiers } from "@/lib/clubTiers";

interface AuctionDB extends DBSchema {
  players: {
    key: string;
    value: Player;
    indexes: { "by-role": string; "by-club": string; "by-status": string };
  };
  clubs: { key: string; value: SerieAClub };
  teams: { key: string; value: FantasyTeam };
  purchases: {
    key: string;
    value: Purchase;
    indexes: { "by-team": string; "by-player": string; "by-time": number };
  };
  bids: {
    key: string;
    value: ObservedBid;
    indexes: { "by-team": string; "by-player": string; "by-time": number };
  };
  state: { key: string; value: AuctionState };
}

const DB_NAME = "FantacalcioAuctionHelperDB";
const DB_VERSION = 2;

function normalizeAuction(state?: Partial<AuctionState> | null): AuctionState {
  return {
    ...DEFAULT_AUCTION,
    ...(state ?? {}),
    goalkeeperMode: state?.goalkeeperMode ?? "INDIVIDUAL",
    closedAt: state?.closedAt ?? null,
    resolvedTeamIds: state?.resolvedTeamIds ?? [],
  };
}

export async function getDb() {
  const db = await openDB<AuctionDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("players")) {
        const players = database.createObjectStore("players", { keyPath: "id" });
        players.createIndex("by-role", "role");
        players.createIndex("by-club", "club");
        players.createIndex("by-status", "status");
      }
      if (!database.objectStoreNames.contains("clubs")) database.createObjectStore("clubs", { keyPath: "id" });
      if (!database.objectStoreNames.contains("teams")) database.createObjectStore("teams", { keyPath: "id" });
      if (!database.objectStoreNames.contains("purchases")) {
        const purchases = database.createObjectStore("purchases", { keyPath: "id" });
        purchases.createIndex("by-team", "fantasyTeamId");
        purchases.createIndex("by-player", "playerId");
        purchases.createIndex("by-time", "timestamp");
      }
      if (!database.objectStoreNames.contains("bids")) {
        const bids = database.createObjectStore("bids", { keyPath: "id" });
        bids.createIndex("by-team", "fantasyTeamId");
        bids.createIndex("by-player", "playerId");
        bids.createIndex("by-time", "timestamp");
      }
      if (!database.objectStoreNames.contains("state")) database.createObjectStore("state", { keyPath: "key" });
    },
  });

  if ((await db.count("teams")) === 0) {
    const tx = db.transaction("teams", "readwrite");
    await Promise.all(DEFAULT_TEAMS.map((team) => tx.store.put(team)));
    await tx.done;
  }

  if ((await db.count("players")) === 0) {
    const defaults = buildDefaultCatalog();
    const autoTieredClubs = fillMissingClubTiers(defaults.players, defaults.clubs);
    const existingClubs = await db.getAll("clubs");
    const existingClubMap = new Map(existingClubs.map((club) => [club.id, club]));
    const tx = db.transaction(["players", "clubs"], "readwrite");
    for (const player of defaults.players) await tx.objectStore("players").put(player);
    for (const club of autoTieredClubs) {
      const existing = existingClubMap.get(club.id);
      const legacyManual = existing?.tierSource === undefined && existing?.tier != null;
      const manual = existing?.tierSource === "MANUAL" || legacyManual;
      await tx.objectStore("clubs").put(manual ? { ...club, tier: existing?.tier ?? club.tier, tierSource: "MANUAL" } : club);
    }
    await tx.done;
  }

  if (!(await db.get("state", "auction"))) await db.put("state", DEFAULT_AUCTION);
  return db;
}

export async function loadAll(): Promise<AppSnapshot> {
  const db = await getDb();
  const [players, rawClubs, teams, purchases, bids, rawAuction] = await Promise.all([
    db.getAll("players"),
    db.getAll("clubs"),
    db.getAll("teams"),
    db.getAll("purchases"),
    db.getAll("bids"),
    db.get("state", "auction"),
  ]);

  const clubs = fillMissingClubTiers(players, rawClubs);
  const changedClubs = clubs.filter((club, index) => club.tier !== rawClubs[index]?.tier || club.tierSource !== rawClubs[index]?.tierSource);
  if (changedClubs.length) {
    const tx = db.transaction("clubs", "readwrite");
    for (const club of changedClubs) await tx.store.put(club);
    await tx.done;
  }

  const auction = normalizeAuction(rawAuction);
  if (rawAuction && (rawAuction.goalkeeperMode === undefined || rawAuction.closedAt === undefined)) await db.put("state", auction);
  return { players, clubs, teams, purchases, bids, auction };
}

export async function savePlayer(player: Player) {
  const db = await getDb();
  await db.put("players", player);
}

export async function savePlayers(players: Player[]) {
  const db = await getDb();
  const tx = db.transaction("players", "readwrite");
  for (const player of players) await tx.store.put(player);
  await tx.done;
}

export async function saveClub(club: SerieAClub) {
  const db = await getDb();
  await db.put("clubs", club);
}
export async function saveTeam(team: FantasyTeam) {
  const db = await getDb();
  await db.put("teams", team);
}
export async function saveAuctionState(state: AuctionState) {
  const db = await getDb();
  await db.put("state", normalizeAuction(state));
}

export async function replacePlayerCatalog(players: Player[], clubs: SerieAClub[]) {
  const db = await getDb();
  const tieredClubs = fillMissingClubTiers(players, clubs);
  const tx = db.transaction(["players", "clubs"], "readwrite");
  await tx.objectStore("players").clear();
  await tx.objectStore("clubs").clear();
  for (const player of players) await tx.objectStore("players").put(player);
  for (const club of tieredClubs) await tx.objectStore("clubs").put(club);
  await tx.done;
}

export async function addPurchase(purchase: Purchase, updatedPlayer: Player) {
  const db = await getDb();
  const tx = db.transaction(["purchases", "players"], "readwrite");
  await tx.objectStore("purchases").put(purchase);
  await tx.objectStore("players").put(updatedPlayer);
  await tx.done;
}

export async function addPurchaseBundle(purchases: Purchase[], updatedPlayers: Player[]) {
  const db = await getDb();
  const tx = db.transaction(["purchases", "players"], "readwrite");
  for (const purchase of purchases) await tx.objectStore("purchases").put(purchase);
  for (const player of updatedPlayers) await tx.objectStore("players").put(player);
  await tx.done;
}

export async function updatePurchasesAndPlayers(purchases: Purchase[], players: Player[]) {
  const db = await getDb();
  const tx = db.transaction(["purchases", "players"], "readwrite");
  for (const purchase of purchases) await tx.objectStore("purchases").put(purchase);
  for (const player of players) await tx.objectStore("players").put(player);
  await tx.done;
}

export async function deletePurchase(purchase: Purchase, player: Player) {
  const db = await getDb();
  const tx = db.transaction(["purchases", "players"], "readwrite");
  await tx.objectStore("purchases").delete(purchase.id);
  await tx.objectStore("players").put(player);
  await tx.done;
}

export async function deletePurchaseBundle(purchases: Purchase[], players: Player[]) {
  const db = await getDb();
  const tx = db.transaction(["purchases", "players"], "readwrite");
  for (const purchase of purchases) await tx.objectStore("purchases").delete(purchase.id);
  for (const player of players) await tx.objectStore("players").put(player);
  await tx.done;
}

export async function addObservedBid(bid: ObservedBid) {
  const db = await getDb();
  await db.put("bids", bid);
}

export async function deleteObservedBid(bid: ObservedBid) {
  const db = await getDb();
  await db.delete("bids", bid.id);
}

export async function exportDatabase() {
  return loadAll();
}

export async function importDatabase(snapshot: AppSnapshot | (Omit<AppSnapshot, "bids"> & { bids?: ObservedBid[] })) {
  const db = await getDb();
  const tx = db.transaction(["players", "clubs", "teams", "purchases", "bids", "state"], "readwrite");
  await Promise.all([
    tx.objectStore("players").clear(),
    tx.objectStore("clubs").clear(),
    tx.objectStore("teams").clear(),
    tx.objectStore("purchases").clear(),
    tx.objectStore("bids").clear(),
    tx.objectStore("state").clear(),
  ]);
  for (const item of snapshot.players) await tx.objectStore("players").put(item);
  const tieredClubs = fillMissingClubTiers(snapshot.players, snapshot.clubs);
  for (const item of tieredClubs) await tx.objectStore("clubs").put(item);
  for (const item of snapshot.teams) await tx.objectStore("teams").put(item);
  for (const item of snapshot.purchases) await tx.objectStore("purchases").put(item);
  for (const item of snapshot.bids ?? []) await tx.objectStore("bids").put(item);
  await tx.objectStore("state").put(normalizeAuction(snapshot.auction));
  await tx.done;
}
