import type { FantasyTeam, Player, Purchase, Role } from "@/types";
import { ROLE_LIMITS } from "@/types";

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
