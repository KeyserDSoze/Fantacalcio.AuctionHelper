import type { FantasyTeam, ObservedBid, Player, Purchase, PsychologyProfile, Role } from "@/types";
import { ROLE_LIMITS } from "@/types";
import { clamp } from "@/lib/utils";

export function purchasesByTeam(purchases: Purchase[]) {
  const map = new Map<string, Purchase[]>();
  for (const p of purchases) map.set(p.fantasyTeamId, [...(map.get(p.fantasyTeamId) ?? []), p]);
  return map;
}

export function getTeamSpent(teamId: string, purchases: Purchase[]) {
  return purchases.filter((p) => p.fantasyTeamId === teamId).reduce((sum, p) => sum + p.price, 0);
}

export function getRemainingBudget(team: FantasyTeam, purchases: Purchase[]) {
  return team.initialBudget - getTeamSpent(team.id, purchases);
}

export function roleCount(teamId: string, role: Role, purchases: Purchase[]) {
  return purchases.filter((p) => p.fantasyTeamId === teamId && p.role === role).length;
}

export function missingByRole(teamId: string, role: Role, purchases: Purchase[]) {
  return Math.max(0, ROLE_LIMITS[role] - roleCount(teamId, role, purchases));
}

export function minimumCompletionCost(teamId: string, players: Player[], purchases: Purchase[]) {
  let total = 0;
  (Object.keys(ROLE_LIMITS) as Role[]).forEach((role) => {
    const missing = missingByRole(teamId, role, purchases);
    const cheapest = players
      .filter((p) => p.status === "AVAILABLE" && p.role === role)
      .map((p) => p.basePrice)
      .sort((a, b) => a - b)
      .slice(0, missing);
    total += cheapest.reduce((sum, value) => sum + value, 0);
  });
  return total;
}

export function teamSnapshot(team: FantasyTeam, players: Player[], purchases: Purchase[]) {
  const spent = getTeamSpent(team.id, purchases);
  const remaining = team.initialBudget - spent;
  const reserve = minimumCompletionCost(team.id, players, purchases);
  const counts = Object.fromEntries(
    (Object.keys(ROLE_LIMITS) as Role[]).map((role) => [role, roleCount(team.id, role, purchases)]),
  ) as Record<Role, number>;
  return {
    ...team,
    spent,
    remaining,
    reserve,
    freeBudget: remaining - reserve,
    counts,
    totalPlayers: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

const PRIOR_AGGRESSION: Record<PsychologyProfile, number> = {
  UNKNOWN: 1,
  RATIONAL: 1,
  MODERATE: 0.96,
  SELECTIVE_AGGRESSIVE: 1.12,
  CONSERVATIVE: 0.9,
  CHAOTIC: 1,
  TOP_HEAVY: 1.12,
  ULTRA_CONSERVATIVE: 0.82,
};

function ratioSamples(teamId: string | null, players: Player[], purchases: Purchase[], bids: ObservedBid[]) {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const wins = purchases
    .filter((purchase) => teamId === null || purchase.fantasyTeamId === teamId)
    .map((purchase) => {
      const base = playerMap.get(purchase.playerId)?.basePrice ?? 0;
      return base > 0 ? purchase.price / base : null;
    });
  const observed = bids
    .filter((bid) => teamId === null || bid.fantasyTeamId === teamId)
    .map((bid) => {
      const base = playerMap.get(bid.playerId)?.basePrice ?? 0;
      return base > 0 ? bid.amount / base : null;
    });
  return [...wins, ...observed].filter((value): value is number => value !== null && Number.isFinite(value));
}

export function observedBehavior(team: FantasyTeam, players: Player[], purchases: Purchase[], bids: ObservedBid[]) {
  const teamSamples = ratioSamples(team.id, players, purchases, bids);
  const leagueSamples = ratioSamples(null, players, purchases, bids);
  const averageRatio = teamSamples.length ? teamSamples.reduce((sum, value) => sum + value, 0) / teamSamples.length : 1;
  const leagueAverage = leagueSamples.length ? leagueSamples.reduce((sum, value) => sum + value, 0) / leagueSamples.length : 1;
  const observedRelative = leagueAverage > 0 ? averageRatio / leagueAverage : 1;
  const confidence = Math.min(0.82, teamSamples.length / 8);
  const prior = PRIOR_AGGRESSION[team.profile];
  const multiplier = clamp(prior * (1 - confidence) + observedRelative * confidence, 0.68, 1.5);
  const variance = teamSamples.length > 1
    ? teamSamples.reduce((sum, value) => sum + Math.pow(value - averageRatio, 2), 0) / teamSamples.length
    : 0;
  return {
    sampleCount: teamSamples.length,
    averageRatio,
    leagueAverage,
    observedRelative,
    multiplier,
    confidence,
    volatility: Math.sqrt(variance),
  };
}
