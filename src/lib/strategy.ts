import { clamp } from "@/lib/utils";
import type { AuctionState, FantasyTeam, ObservedBid, Player, Purchase, PsychologyProfile, Role, SerieAClub } from "@/types";
import { ROLE_LIMITS } from "@/types";
import { getRemainingBudget, minimumCompletionCost, missingByRole, observedBehavior, purchaseBudgetImpact } from "@/lib/analytics";

export type CandidateSource = "MY_LIST" | "TOP9";

export const MIN_GOALKEEPERS_PER_PACKAGE = 2;
export const MAX_GOALKEEPERS_PER_PACKAGE = 3;

export interface OpponentTarget {
  teamId: string;
  playerId: string;
  score: number;
  probability: number;
  expectedBid: number;
}

export interface CandidateAdvice {
  player: Player;
  recommendationScore: number;
  collisionRisk: number;
  contenders: { team: FantasyTeam; probability: number; expectedBid: number }[];
  rolledOver: boolean;
  reason: string;
  expectedMarketPrice: number;
  sensibleBid: number;
  winBid: number;
  winProbability: number;
  maxSustainableBid: number;
}

const STARTING_MARKET_MULTIPLIER: Record<Role, number> = {
  P: 1.3,
  D: 1.55,
  C: 1.85,
  A: 2.25,
};

function seededNoise(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 1000) / 1000;
}

export function goalkeeperPackage(players: Player[], anchor?: Player) {
  if (!anchor) return [];
  return players
    .filter((player) => player.status === "AVAILABLE" && player.role === "P" && player.club === anchor.club)
    .sort((a, b) => b.basePrice - a.basePrice)
    .slice(0, MAX_GOALKEEPERS_PER_PACKAGE);
}

export function auctionPool(players: Player[], auction: AuctionState) {
  const available = players.filter((player) => player.status === "AVAILABLE" && player.role === auction.currentRole);
  if (auction.currentRole !== "P" || auction.goalkeeperMode !== "PACKAGE") return available;
  const byClub = new Map<string, Player[]>();
  available.forEach((player) => byClub.set(player.club, [...(byClub.get(player.club) ?? []), player]));
  return [...byClub.values()]
    .filter((group) => group.length >= MIN_GOALKEEPERS_PER_PACKAGE)
    .map((group) => [...group].sort((a, b) => b.basePrice - a.basePrice)[0]);
}

export function effectiveBasePrice(player: Player, allPlayers: Player[], auction: AuctionState) {
  if (auction.currentRole !== "P" || auction.goalkeeperMode !== "PACKAGE") return player.basePrice;
  return goalkeeperPackage(allPlayers, player).reduce((sum, item) => sum + item.basePrice, 0);
}

function percentile(player: Player, pool: Player[], allPlayers: Player[], auction: AuctionState) {
  if (pool.length <= 1) return 1;
  const sorted = [...pool].sort((a, b) => effectiveBasePrice(a, allPlayers, auction) - effectiveBasePrice(b, allPlayers, auction));
  const index = sorted.findIndex((item) => item.id === player.id);
  return clamp(index / (sorted.length - 1));
}

function clubPower(player: Player, clubs: SerieAClub[]) {
  const tier = clubs.find((club) => club.name === player.club)?.tier;
  if (!tier) return 0.55;
  return clamp(1.1 - tier * 0.18, 0.18, 1);
}

function profileScore(profile: PsychologyProfile, quality: number, cheapness: number, fandom: number, noise: number) {
  switch (profile) {
    case "ULTRA_CONSERVATIVE": return quality * 0.55 + cheapness * 0.35 + fandom * 0.1;
    case "CONSERVATIVE": return quality * 0.67 + cheapness * 0.22 + fandom * 0.11;
    case "MODERATE": return quality * 0.82 + cheapness * 0.08 + fandom * 0.1;
    case "RATIONAL": return quality * 0.88 + fandom * 0.12;
    case "SELECTIVE_AGGRESSIVE": return quality * 0.83 + fandom * 0.17 + (quality > 0.76 ? 0.08 : 0);
    case "TOP_HEAVY": return quality * 1.08 + fandom * 0.12 + (quality > 0.8 ? 0.16 : -0.08);
    case "CHAOTIC": return quality * 0.65 + fandom * 0.1 + (noise - 0.5) * 0.5 + 0.2;
    default: return quality * 0.78 + fandom * 0.1 + cheapness * 0.12;
  }
}

function ratioForPurchase(purchase: Purchase, players: Player[]) {
  if (purchase.bundleId) return null;
  const base = players.find((player) => player.id === purchase.playerId)?.basePrice ?? 0;
  return base > 0 ? purchaseBudgetImpact(purchase) / base : null;
}

function roleMarketMultiplier(role: Role, players: Player[], purchases: Purchase[], bids: ObservedBid[]) {
  const roleSamples: number[] = [];
  const seenBundles = new Set<string>();
  purchases.filter((purchase) => purchase.role === role).forEach((purchase) => {
    if (purchase.bundleId) {
      if (seenBundles.has(purchase.bundleId)) return;
      seenBundles.add(purchase.bundleId);
      const group = purchases.filter((item) => item.bundleId === purchase.bundleId);
      const base = group.reduce((sum, item) => sum + (players.find((player) => player.id === item.playerId)?.basePrice ?? 0), 0);
      const paid = group.reduce((sum, item) => sum + purchaseBudgetImpact(item), 0);
      if (base > 0 && paid > 0) roleSamples.push(paid / base);
      return;
    }
    const ratio = ratioForPurchase(purchase, players);
    if (ratio) roleSamples.push(ratio);
  });
  bids.filter((bid) => bid.role === role).forEach((bid) => {
    const base = bid.referenceBasePrice ?? players.find((player) => player.id === bid.playerId)?.basePrice ?? 0;
    if (base > 0) roleSamples.push(bid.amount / base);
  });

  if (!roleSamples.length) return STARTING_MARKET_MULTIPLIER[role];
  const sorted = [...roleSamples].sort((a, b) => a - b);
  const trimmed = sorted.length >= 5 ? sorted.slice(1, -1) : sorted;
  const observed = trimmed.reduce((sum, value) => sum + value, 0) / trimmed.length;
  const confidence = Math.min(0.88, roleSamples.length / 10);
  return STARTING_MARKET_MULTIPLIER[role] * (1 - confidence) + observed * confidence;
}

function releasedReserve(teamId: string, role: Role, players: Player[], purchases: Purchase[], auction: AuctionState) {
  const missing = missingByRole(teamId, role, purchases);
  if (missing <= 0) return 0;
  const count = role === "P" && auction.goalkeeperMode === "PACKAGE" ? Math.min(MAX_GOALKEEPERS_PER_PACKAGE, missing) : 1;
  return players
    .filter((player) => player.status === "AVAILABLE" && player.role === role)
    .map((player) => player.basePrice)
    .sort((a, b) => a - b)
    .slice(0, count)
    .reduce((sum, value) => sum + value, 0);
}

function sustainableBid(team: FantasyTeam, player: Player, players: Player[], purchases: Purchase[], auction: AuctionState) {
  const remaining = getRemainingBudget(team, purchases);
  const reserve = minimumCompletionCost(team.id, players, purchases);
  const released = releasedReserve(team.id, player.role, players, purchases, auction);
  return Math.max(0, Math.floor(remaining - Math.max(0, reserve - released)));
}

function rawOpponentScore(
  team: FantasyTeam,
  player: Player,
  pool: Player[],
  allPlayers: Player[],
  clubs: SerieAClub[],
  purchases: Purchase[],
  bids: ObservedBid[],
  auction: AuctionState,
) {
  const remaining = getRemainingBudget(team, purchases);
  const targetPrice = effectiveBasePrice(player, allPlayers, auction);
  const missing = missingByRole(team.id, player.role, purchases);
  if (remaining < targetPrice || missing <= 0) return 0;
  if (player.role === "P" && auction.goalkeeperMode === "PACKAGE" && missing < MIN_GOALKEEPERS_PER_PACKAGE) return 0;

  const qualityP = percentile(player, pool, allPlayers, auction);
  const clubP = clubPower(player, clubs);
  const quality = qualityP * 0.72 + clubP * 0.28;
  const maxPrice = Math.max(...pool.map((item) => effectiveBasePrice(item, allPlayers, auction)), 1);
  const cheapness = 1 - targetPrice / maxPrice;
  const fandom = team.supportedClubs.includes(player.club) ? 1 : 0;
  const maxChoice = auction.currentRole === "P" && auction.goalkeeperMode === "PACKAGE" ? 1 : ROLE_LIMITS[auction.currentRole];
  const desiredQuality = 1 - ((auction.choiceNumber - 1) / Math.max(1, maxChoice - 1)) * 0.78;
  const stageFit = 1 - Math.abs(quality - desiredQuality);
  const noise = seededNoise(`${team.id}-${player.id}-${auction.choiceNumber}-${auction.subRound}`);
  const psychology = profileScore(team.profile, quality, cheapness, fandom, noise);
  const learned = observedBehavior(team, allPlayers, purchases, bids);
  const freeBudget = Math.max(0, sustainableBid(team, player, allPlayers, purchases, auction) - targetPrice);
  const budgetHeadroom = clamp((freeBudget + targetPrice) / Math.max(targetPrice * 2.2, 1), 0.15, 1);
  const liveBehavior = clamp((learned.multiplier - 0.7) / 0.8, 0, 1);

  return clamp(psychology * 0.43 + stageFit * 0.24 + budgetHeadroom * 0.13 + fandom * 0.05 + liveBehavior * 0.15, 0, 1.35);
}

function expectedOpponentBid(
  team: FantasyTeam,
  player: Player,
  probability: number,
  pool: Player[],
  players: Player[],
  clubs: SerieAClub[],
  purchases: Purchase[],
  bids: ObservedBid[],
  auction: AuctionState,
) {
  const base = effectiveBasePrice(player, players, auction);
  const market = roleMarketMultiplier(player.role, players, purchases, bids);
  const behavior = observedBehavior(team, players, purchases, bids);
  const quality = percentile(player, pool, players, auction);
  const fandom = team.supportedClubs.includes(player.club) ? 1 : 0;
  const intentPremium = 0.94 + quality * 0.09 + fandom * 0.05 + Math.min(0.08, probability * 0.4);
  const estimate = Math.round(base * market * behavior.multiplier * intentPremium);
  return Math.max(base, Math.min(estimate, sustainableBid(team, player, players, purchases, auction)));
}

export function activeTeamsForState(teams: FantasyTeam[], purchases: Purchase[], auction: AuctionState) {
  return teams.filter((team) => {
    if (auction.resolvedTeamIds.includes(team.id)) return false;
    const missing = missingByRole(team.id, auction.currentRole, purchases);
    if (auction.currentRole === "P" && auction.goalkeeperMode === "PACKAGE") return missing >= MIN_GOALKEEPERS_PER_PACKAGE;
    return missing > 0;
  });
}

export function predictOpponentTargets(
  teams: FantasyTeam[],
  players: Player[],
  clubs: SerieAClub[],
  purchases: Purchase[],
  auction: AuctionState,
  bids: ObservedBid[] = [],
) {
  const pool = auctionPool(players, auction);
  const active = activeTeamsForState(teams, purchases, auction).filter((team) => !team.isMe);
  const result = new Map<string, OpponentTarget[]>();

  active.forEach((team) => {
    const scored = pool
      .map((player) => ({ player, score: rawOpponentScore(team, player, pool, players, clubs, purchases, bids, auction) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 18);
    const weights = scored.map((item) => Math.exp(item.score * 5.2));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    result.set(
      team.id,
      scored.map((item, index) => {
        const probability = weights[index] / total;
        return {
          teamId: team.id,
          playerId: item.player.id,
          score: item.score,
          probability,
          expectedBid: expectedOpponentBid(team, item.player, probability, pool, players, clubs, purchases, bids, auction),
        };
      }),
    );
  });
  return result;
}

function chanceToBeatBid(ourBid: number, opponentBid: number) {
  const spread = Math.max(2, opponentBid * 0.12);
  return 1 / (1 + Math.exp((opponentBid - ourBid) / spread));
}

function buildCandidate(
  player: Player,
  pool: Player[],
  players: Player[],
  clubs: SerieAClub[],
  teams: FantasyTeam[],
  purchases: Purchase[],
  bids: ObservedBid[],
  auction: AuctionState,
  predictions: Map<string, OpponentTarget[]>,
  activeOpponents: FantasyTeam[],
): CandidateAdvice {
  const quality = percentile(player, pool, players, auction) * 0.74 + clubPower(player, clubs) * 0.26;
  const tierValue = player.priorityTier ? ({ 1: 1, 2: 0.78, 3: 0.58 } as const)[player.priorityTier] : 0.5;
  const like = player.personalRating === "LIKE" ? 1 : player.personalRating === "AVOID" ? 0.08 : 0.45;
  const rolledOver = player.targetChoice !== null && player.targetChoice < auction.choiceNumber;
  const rolloverBonus = rolledOver ? Math.min(0.16, (auction.choiceNumber - (player.targetChoice ?? auction.choiceNumber)) * 0.055) : 0;
  const contenders = activeOpponents
    .map((team) => {
      const prediction = predictions.get(team.id)?.find((item) => item.playerId === player.id);
      return { team, probability: prediction?.probability ?? 0, expectedBid: prediction?.expectedBid ?? effectiveBasePrice(player, players, auction) };
    })
    .filter((item) => item.probability >= 0.01)
    .sort((a, b) => b.probability - a.probability);
  const collisionRisk = clamp(1 - contenders.reduce((product, contender) => product * (1 - contender.probability), 1));
  const base = effectiveBasePrice(player, players, auction);
  const marketBase = Math.max(base, Math.round(base * roleMarketMultiplier(player.role, players, purchases, bids)));
  const probabilityWeight = contenders.reduce((sum, contender) => sum + contender.probability, 0);
  const weightedOpponentPrice = probabilityWeight > 0
    ? contenders.reduce((sum, contender) => sum + contender.expectedBid * contender.probability, 0) / probabilityWeight
    : marketBase;
  const expectedMarketPrice = Math.max(base, Math.round(marketBase * 0.45 + weightedOpponentPrice * 0.55));
  const likelyThreats = contenders.filter((contender) => contender.probability >= 0.035);
  const threatCeiling = likelyThreats.length
    ? Math.max(...likelyThreats.map((contender) => contender.expectedBid * (0.9 + Math.min(0.1, contender.probability * 0.45))))
    : expectedMarketPrice;
  const me = teams.find((team) => team.isMe) ?? teams[0];
  const maxSustainableBid = me ? sustainableBid(me, player, players, purchases, auction) : 0;
  const sensibleBid = Math.max(base, Math.min(maxSustainableBid, Math.round(expectedMarketPrice)));
  const rawWinBid = Math.max(base, Math.ceil(threatCeiling) + (likelyThreats.length ? 1 : 0));
  const winBid = Math.max(base, Math.min(maxSustainableBid, rawWinBid));
  const winProbability = clamp(contenders.reduce((probability, contender) => {
    const beat = chanceToBeatBid(winBid, contender.expectedBid);
    return probability * (1 - contender.probability * (1 - beat));
  }, 1), 0.02, 0.99);
  const desire = clamp(quality * 0.4 + tierValue * 0.3 + like * 0.16 + rolloverBonus + (1 - Math.min(1, expectedMarketPrice / Math.max(maxSustainableBid, 1))) * 0.05);
  const recommendationScore = clamp(desire * 0.7 + (1 - collisionRisk) * 0.2 + winProbability * 0.1);
  const reason = rolledOver
    ? "Target rimasto libero da una scelta precedente: resta nel basket e ora rivalutiamo prezzo e concorrenza."
    : collisionRisk < 0.22
      ? "Buon fit per la tornata con concorrenza stimata contenuta."
      : "Target valido, ma più squadre ancora attive possono convergere sullo stesso nome.";
  return { player, recommendationScore, collisionRisk, contenders, rolledOver, reason, expectedMarketPrice, sensibleBid, winBid, winProbability, maxSustainableBid };
}

export function getSozeCandidates(
  players: Player[],
  clubs: SerieAClub[],
  teams: FantasyTeam[],
  purchases: Purchase[],
  auction: AuctionState,
  bids: ObservedBid[] = [],
  source: CandidateSource = "MY_LIST",
) {
  const pool = auctionPool(players, auction);
  const predictions = predictOpponentTargets(teams, players, clubs, purchases, auction, bids);
  const activeOpponents = activeTeamsForState(teams, purchases, auction).filter((team) => !team.isMe);
  const selectedPool = source === "TOP9"
    ? [...pool].sort((a, b) => effectiveBasePrice(b, players, auction) - effectiveBasePrice(a, players, auction)).slice(0, 9)
    : pool.filter((player) => {
        if (player.personalRating === "AVOID") return false;
        if (player.targetChoice !== null) return player.targetChoice <= auction.choiceNumber;
        return player.priorityTier !== null && player.priorityTier <= Math.min(3, auction.choiceNumber);
      });

  return selectedPool
    .map((player) => buildCandidate(player, pool, players, clubs, teams, purchases, bids, auction, predictions, activeOpponents))
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
}