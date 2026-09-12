import { clamp } from "@/lib/utils";
import type { AuctionState, FantasyTeam, Player, Purchase, PsychologyProfile, SerieAClub } from "@/types";
import { ROLE_LIMITS } from "@/types";
import { getRemainingBudget, minimumCompletionCost, missingByRole } from "@/lib/analytics";

export interface OpponentTarget {
  teamId: string;
  playerId: string;
  score: number;
  probability: number;
}

export interface CandidateAdvice {
  player: Player;
  recommendationScore: number;
  collisionRisk: number;
  contenders: { team: FantasyTeam; probability: number }[];
  rolledOver: boolean;
  reason: string;
}

function seededNoise(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return ((hash >>> 0) % 1000) / 1000;
}

function percentile(player: Player, pool: Player[]) {
  if (pool.length <= 1) return 1;
  const sorted = [...pool].sort((a, b) => a.basePrice - b.basePrice);
  const index = sorted.findIndex((p) => p.id === player.id);
  return clamp(index / (sorted.length - 1));
}

function clubPower(player: Player, clubs: SerieAClub[]) {
  const tier = clubs.find((c) => c.name === player.club)?.tier;
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

function rawOpponentScore(
  team: FantasyTeam,
  player: Player,
  pool: Player[],
  allPlayers: Player[],
  clubs: SerieAClub[],
  purchases: Purchase[],
  auction: AuctionState,
) {
  const remaining = getRemainingBudget(team, purchases);
  const reserve = minimumCompletionCost(team.id, allPlayers, purchases);
  if (remaining < player.basePrice || missingByRole(team.id, player.role, purchases) <= 0) return 0;

  const qualityP = percentile(player, pool);
  const clubP = clubPower(player, clubs);
  const quality = qualityP * 0.72 + clubP * 0.28;
  const maxPrice = Math.max(...pool.map((p) => p.basePrice), 1);
  const cheapness = 1 - player.basePrice / maxPrice;
  const fandom = team.supportedClubs.includes(player.club) ? 1 : 0;
  const maxChoice = ROLE_LIMITS[auction.currentRole];
  const desiredQuality = 1 - ((auction.choiceNumber - 1) / Math.max(1, maxChoice - 1)) * 0.78;
  const stageFit = 1 - Math.abs(quality - desiredQuality);
  const noise = seededNoise(`${team.id}-${player.id}-${auction.choiceNumber}-${auction.subRound}`);
  const psychology = profileScore(team.profile, quality, cheapness, fandom, noise);
  const freeBudget = Math.max(0, remaining - reserve);
  const budgetHeadroom = clamp((freeBudget + player.basePrice) / Math.max(player.basePrice * 2.2, 1), 0.15, 1);

  return clamp(psychology * 0.53 + stageFit * 0.27 + budgetHeadroom * 0.15 + fandom * 0.05, 0, 1.35);
}

export function activeTeamsForState(teams: FantasyTeam[], purchases: Purchase[], auction: AuctionState) {
  return teams.filter(
    (team) =>
      !auction.resolvedTeamIds.includes(team.id) &&
      missingByRole(team.id, auction.currentRole, purchases) > 0,
  );
}

export function predictOpponentTargets(
  teams: FantasyTeam[],
  players: Player[],
  clubs: SerieAClub[],
  purchases: Purchase[],
  auction: AuctionState,
) {
  const pool = players.filter((p) => p.status === "AVAILABLE" && p.role === auction.currentRole);
  const active = activeTeamsForState(teams, purchases, auction).filter((t) => !t.isMe);
  const result = new Map<string, OpponentTarget[]>();

  active.forEach((team) => {
    const scored = pool
      .map((player) => ({ player, score: rawOpponentScore(team, player, pool, players, clubs, purchases, auction) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 14);
    const weights = scored.map((x) => Math.exp(x.score * 5.2));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    result.set(
      team.id,
      scored.map((x, i) => ({ teamId: team.id, playerId: x.player.id, score: x.score, probability: weights[i] / total })),
    );
  });
  return result;
}

export function getSozeCandidates(
  players: Player[],
  clubs: SerieAClub[],
  teams: FantasyTeam[],
  purchases: Purchase[],
  auction: AuctionState,
) {
  const pool = players.filter((p) => p.status === "AVAILABLE" && p.role === auction.currentRole);
  const predictions = predictOpponentTargets(teams, players, clubs, purchases, auction);
  const activeOpponents = activeTeamsForState(teams, purchases, auction).filter((t) => !t.isMe);

  return pool
    .filter((player) => {
      if (player.personalRating === "AVOID") return false;
      if (player.targetChoice !== null) return player.targetChoice <= auction.choiceNumber;
      return player.priorityTier !== null && player.priorityTier <= Math.min(3, auction.choiceNumber);
    })
    .map<CandidateAdvice>((player) => {
      const quality = percentile(player, pool) * 0.74 + clubPower(player, clubs) * 0.26;
      const tierValue = player.priorityTier ? ({ 1: 1, 2: 0.78, 3: 0.58 } as const)[player.priorityTier] : 0.5;
      const like = player.personalRating === "LIKE" ? 1 : 0.45;
      const rolledOver = player.targetChoice !== null && player.targetChoice < auction.choiceNumber;
      const rolloverBonus = rolledOver ? Math.min(0.16, (auction.choiceNumber - (player.targetChoice ?? auction.choiceNumber)) * 0.055) : 0;

      const contenders = activeOpponents
        .map((team) => ({
          team,
          probability: predictions.get(team.id)?.find((x) => x.playerId === player.id)?.probability ?? 0,
        }))
        .filter((x) => x.probability >= 0.015)
        .sort((a, b) => b.probability - a.probability);
      const collisionRisk = clamp(1 - contenders.reduce((p, c) => p * (1 - c.probability), 1));
      const desire = clamp(quality * 0.43 + tierValue * 0.32 + like * 0.17 + rolloverBonus);
      const recommendationScore = clamp(desire * 0.73 + (1 - collisionRisk) * 0.27);
      const reason = rolledOver
        ? "Target rimasto libero da una scelta precedente: valore strategico ancora alto."
        : collisionRisk < 0.22
          ? "Buon fit per questa scelta e collisione stimata contenuta."
          : "Target valido, ma con concorrenza probabile tra gli avversari ancora attivi.";
      return { player, recommendationScore, collisionRisk, contenders, rolledOver, reason };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
}
