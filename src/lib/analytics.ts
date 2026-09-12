import type { FantasyTeam, ObservedBid, Player, Purchase, PsychologyProfile, Role, SerieAClub } from "@/types";
import { ROLE_LIMITS } from "@/types";
import { clamp } from "@/lib/utils";

export function purchasesByTeam(purchases: Purchase[]) {
  const map = new Map<string, Purchase[]>();
  for (const p of purchases) map.set(p.fantasyTeamId, [...(map.get(p.fantasyTeamId) ?? []), p]);
  return map;
}

export function purchaseBudgetImpact(purchase: Purchase) {
  return purchase.budgetImpact ?? purchase.price;
}

export function getTeamSpent(teamId: string, purchases: Purchase[]) {
  return purchases.filter((p) => p.fantasyTeamId === teamId).reduce((sum, p) => sum + purchaseBudgetImpact(p), 0);
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

function purchaseRatioSamples(teamId: string | null, players: Player[], purchases: Purchase[]) {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const relevant = purchases.filter((purchase) => teamId === null || purchase.fantasyTeamId === teamId);
  const bundled = new Map<string, Purchase[]>();
  const normal: Purchase[] = [];
  relevant.forEach((purchase) => {
    if (purchase.bundleId) bundled.set(purchase.bundleId, [...(bundled.get(purchase.bundleId) ?? []), purchase]);
    else normal.push(purchase);
  });
  const ratios = normal.map((purchase) => {
    const base = playerMap.get(purchase.playerId)?.basePrice ?? 0;
    return base > 0 ? purchaseBudgetImpact(purchase) / base : null;
  });
  bundled.forEach((group) => {
    const base = group.reduce((sum, purchase) => sum + (playerMap.get(purchase.playerId)?.basePrice ?? 0), 0);
    const paid = group.reduce((sum, purchase) => sum + purchaseBudgetImpact(purchase), 0);
    if (base > 0) ratios.push(paid / base);
  });
  return ratios.filter((value): value is number => value !== null && Number.isFinite(value));
}

function ratioSamples(teamId: string | null, players: Player[], purchases: Purchase[], bids: ObservedBid[]) {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const wins = purchaseRatioSamples(teamId, players, purchases);
  const observed = bids
    .filter((bid) => teamId === null || bid.fantasyTeamId === teamId)
    .map((bid) => {
      const base = bid.referenceBasePrice ?? playerMap.get(bid.playerId)?.basePrice ?? 0;
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

function percentileInRole(player: Player, players: Player[]) {
  const pool = players.filter((item) => item.role === player.role).sort((a, b) => a.basePrice - b.basePrice);
  if (pool.length <= 1) return 1;
  const index = pool.findIndex((item) => item.id === player.id);
  return index < 0 ? 0 : index / (pool.length - 1);
}

function clubStrength(player: Player, clubs: SerieAClub[]) {
  const tier = clubs.find((club) => club.name === player.club)?.tier;
  return tier ? clamp(1.12 - tier * 0.17, 0.25, 1) : 0.55;
}

export interface FinalTeamReport {
  team: FantasyTeam;
  score: number;
  quality: number;
  efficiency: number;
  balance: number;
  completion: number;
  spent: number;
  remaining: number;
  personality: string;
  personalityDescription: string;
  behavior: ReturnType<typeof observedBehavior>;
  roleScores: Record<Role, number>;
}

export function inferAuctionPersonality(team: FantasyTeam, players: Player[], purchases: Purchase[], bids: ObservedBid[]) {
  const behavior = observedBehavior(team, players, purchases, bids);
  const teamPurchases = purchases.filter((purchase) => purchase.fantasyTeamId === team.id);
  const costs = teamPurchases.map(purchaseBudgetImpact).filter((value) => value > 0).sort((a, b) => b - a);
  const spent = costs.reduce((sum, value) => sum + value, 0);
  const topShare = spent > 0 ? costs.slice(0, 3).reduce((sum, value) => sum + value, 0) / spent : 0;

  if (behavior.sampleCount >= 3 && behavior.volatility >= 0.75) return { label: "Imprevedibile", description: "Alterna offerte molto lontane tra loro: difficile anticiparne il tetto.", behavior };
  if (topShare >= 0.55 && costs.length >= 4) return { label: "Cacciatore di top", description: "Concentra una quota molto alta del budget su pochi nomi forti.", behavior };
  if (behavior.multiplier >= 1.13) return { label: "Aggressivo", description: "Paga mediamente sopra il ritmo della lega pur di chiudere i propri obiettivi.", behavior };
  if (behavior.multiplier <= 0.88) return { label: "Conservativo", description: "Tiene le offerte sotto il ritmo della lega e protegge il budget.", behavior };
  if (behavior.volatility >= 0.4) return { label: "Selettivo", description: "È disciplinato su molti nomi ma accelera nettamente su alcuni obiettivi.", behavior };
  return { label: "Razionale", description: "Si muove vicino ai prezzi medi della lega con variazioni contenute.", behavior };
}

export function buildFinalReport(teams: FantasyTeam[], players: Player[], clubs: SerieAClub[], purchases: Purchase[], bids: ObservedBid[]) {
  const playerMap = new Map(players.map((player) => [player.id, player]));
  const leagueRatios = purchaseRatioSamples(null, players, purchases);
  const leagueAverageRatio = leagueRatios.length ? leagueRatios.reduce((sum, value) => sum + value, 0) / leagueRatios.length : 1;
  const roleWeights: Record<Role, number> = { P: 0.12, D: 0.2, C: 0.3, A: 0.38 };

  const reports: FinalTeamReport[] = teams.map((team) => {
    const teamPurchases = purchases.filter((purchase) => purchase.fantasyTeamId === team.id);
    const roster = teamPurchases.map((purchase) => playerMap.get(purchase.playerId)).filter((player): player is Player => Boolean(player));
    const roleScores = {} as Record<Role, number>;
    (Object.keys(ROLE_LIMITS) as Role[]).forEach((role) => {
      const rolePlayers = roster.filter((player) => player.role === role);
      const raw = rolePlayers.length
        ? rolePlayers.reduce((sum, player) => sum + percentileInRole(player, players) * 0.78 + clubStrength(player, clubs) * 0.22, 0) / rolePlayers.length
        : 0;
      const completeness = Math.min(1, rolePlayers.length / ROLE_LIMITS[role]);
      roleScores[role] = raw * completeness;
    });

    const quality = (Object.keys(roleWeights) as Role[]).reduce((sum, role) => sum + roleScores[role] * roleWeights[role], 0);
    const meanRole = (Object.values(roleScores) as number[]).reduce((sum, value) => sum + value, 0) / 4;
    const variance = (Object.values(roleScores) as number[]).reduce((sum, value) => sum + Math.pow(value - meanRole, 2), 0) / 4;
    const balance = clamp(1 - Math.sqrt(variance) * 1.55);
    const completion = Math.min(1, roster.length / 25);
    const ratios = purchaseRatioSamples(team.id, players, purchases);
    const avgRatio = ratios.length ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : leagueAverageRatio;
    const relativeCost = leagueAverageRatio > 0 ? avgRatio / leagueAverageRatio : 1;
    const efficiency = clamp(1.03 - (relativeCost - 1) * 0.45, 0.45, 1.12);
    const spent = getTeamSpent(team.id, purchases);
    const remaining = team.initialBudget - spent;
    const budgetUse = completion < 1 ? completion : clamp(1 - Math.max(0, remaining - 15) / 350, 0.65, 1);
    const score = clamp((quality * 0.66 + efficiency * 0.13 + balance * 0.09 + completion * 0.08 + budgetUse * 0.04) * 100, 0, 100);
    const personality = inferAuctionPersonality(team, players, purchases, bids);
    return {
      team,
      score,
      quality: quality * 100,
      efficiency: efficiency * 100,
      balance: balance * 100,
      completion: completion * 100,
      spent,
      remaining,
      personality: personality.label,
      personalityDescription: personality.description,
      behavior: personality.behavior,
      roleScores: Object.fromEntries((Object.keys(roleScores) as Role[]).map((role) => [role, roleScores[role] * 100])) as Record<Role, number>,
    };
  }).sort((a, b) => b.score - a.score);

  return reports;
}
