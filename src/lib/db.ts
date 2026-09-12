import { openDB, type DBSchema } from "idb";
import type { AuctionState, FantasyTeam, ObservedBid, Player, Purchase, SerieAClub } from "@/types";
import { DEFAULT_AUCTION, DEFAULT_TEAMS } from "@/lib/defaults";

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
  if (!(await db.get("state", "auction"))) await db.put("state", DEFAULT_AUCTION);
  return db;
}

export async function loadAll() {
  const db = await getDb();
  const [players, clubs, teams, purchases, bids, auction] = await Promise.all([
    db.getAll("players"),
    db.getAll("clubs"),
    db.getAll("teams"),
    db.getAll("purchases"),
    db.getAll("bids"),
    db.get("state", "auction"),
  ]);
  return { players, clubs, teams, purchases, bids, auction: auction ?? DEFAULT_AUCTION };
}

export async function savePlayer(player: Player) {
  const db = await getDb();
  await db.put("players", player);
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
  await db.put("state", state);
}

export async function replacePlayerCatalog(players: Player[], clubs: SerieAClub[]) {
  const db = await getDb();
  const tx = db.transaction(["players", "clubs"], "readwrite");
  await tx.objectStore("players").clear();
  await tx.objectStore("clubs").clear();
  for (const player of players) await tx.objectStore("players").put(player);
  for (const club of clubs) await tx.objectStore("clubs").put(club);
  await tx.done;
}

export async function addPurchase(purchase: Purchase, updatedPlayer: Player) {
  const db = await getDb();
  const tx = db.transaction(["purchases", "players"], "readwrite");
  await tx.objectStore("purchases").put(purchase);
  await tx.objectStore("players").put(updatedPlayer);
  await tx.done;
}

export async function deletePurchase(purchase: Purchase, player: Player) {
  const db = await getDb();
  const tx = db.transaction(["purchases", "players"], "readwrite");
  await tx.objectStore("purchases").delete(purchase.id);
  await tx.objectStore("players").put(player);
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

export async function importDatabase(snapshot: Awaited<ReturnType<typeof loadAll>> | (Omit<Awaited<ReturnType<typeof loadAll>>, "bids"> & { bids?: ObservedBid[] })) {
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
  for (const item of snapshot.clubs) await tx.objectStore("clubs").put(item);
  for (const item of snapshot.teams) await tx.objectStore("teams").put(item);
  for (const item of snapshot.purchases) await tx.objectStore("purchases").put(item);
  for (const item of snapshot.bids ?? []) await tx.objectStore("bids").put(item);
  await tx.objectStore("state").put(snapshot.auction);
  await tx.done;
}
