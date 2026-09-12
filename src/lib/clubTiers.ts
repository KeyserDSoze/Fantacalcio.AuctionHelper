import type { Player, SerieAClub } from "@/types";

export interface ClubTierMetric {
  club: string;
  top15Value: number;
  autoTier: number;
  rank: number;
}

/**
 * Valore strutturale del club: somma delle 15 quotazioni FantaMaster più alte.
 */
export function clubTop15Value(club: string, players: Player[]) {
  return players
    .filter((player) => player.club === club)
    .map((player) => player.basePrice)
    .sort((a, b) => b - a)
    .slice(0, 15)
    .reduce((sum, value) => sum + value, 0);
}

/**
 * Ordina i club per valore Top 15 e li divide in quattro fasce di numerosità
 * il più possibile uniforme. Con 20 squadre produce 4 tier da 5 squadre.
 */
export function buildClubTierMetrics(players: Player[], clubs: SerieAClub[]): ClubTierMetric[] {
  const ranked = clubs
    .map((club) => ({ club: club.name, top15Value: clubTop15Value(club.name, players) }))
    .sort((a, b) => b.top15Value - a.top15Value || a.club.localeCompare(b.club, "it"));

  const total = ranked.length;
  return ranked.map((item, index) => ({
    ...item,
    rank: index + 1,
    autoTier: total ? Math.min(4, Math.floor((index * 4) / total) + 1) : 4,
  }));
}

/**
 * Il tier automatico è solo un fallback: non sovrascrive mai un tier già
 * valorizzato manualmente.
 */
export function fillMissingClubTiers(players: Player[], clubs: SerieAClub[]) {
  const metrics = buildClubTierMetrics(players, clubs);
  const tierByClub = new Map(metrics.map((metric) => [metric.club, metric.autoTier]));
  return clubs.map((club) => ({
    ...club,
    tier: club.tier ?? tierByClub.get(club.name) ?? 4,
  }));
}
