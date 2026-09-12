export type Role = "P" | "D" | "C" | "A";
export type PersonalRating = "LIKE" | "NEUTRAL" | "AVOID";
export type PriorityTier = 1 | 2 | 3 | null;
export type PsychologyProfile =
  | "UNKNOWN"
  | "RATIONAL"
  | "MODERATE"
  | "SELECTIVE_AGGRESSIVE"
  | "CONSERVATIVE"
  | "CHAOTIC"
  | "TOP_HEAVY"
  | "ULTRA_CONSERVATIVE";

export interface Player {
  id: string;
  name: string;
  club: string;
  role: Role;
  basePrice: number;
  isTrequartista: boolean;
  personalRating: PersonalRating;
  priorityTier: PriorityTier;
  targetChoice: number | null;
  status: "AVAILABLE" | "WON";
  ownerId?: string;
  purchasePrice?: number;
}

export interface SerieAClub {
  id: string;
  name: string;
  tier: number | null;
}

export interface FantasyTeam {
  id: string;
  name: string;
  initialBudget: number;
  profile: PsychologyProfile;
  supportedClubs: string[];
  isMe?: boolean;
}

export interface Purchase {
  id: string;
  playerId: string;
  fantasyTeamId: string;
  price: number;
  role: Role;
  choiceNumber: number;
  subRound: number;
  timestamp: number;
}

export interface ObservedBid {
  id: string;
  playerId: string;
  fantasyTeamId: string;
  amount: number;
  result: "LOST" | "TIED";
  role: Role;
  choiceNumber: number;
  subRound: number;
  timestamp: number;
}

export interface AuctionState {
  key: "auction";
  currentRole: Role;
  choiceNumber: number;
  subRound: number;
  resolvedTeamIds: string[];
}

export interface AppSnapshot {
  players: Player[];
  clubs: SerieAClub[];
  teams: FantasyTeam[];
  purchases: Purchase[];
  bids: ObservedBid[];
  auction: AuctionState;
}

export const ROLE_LIMITS: Record<Role, number> = { P: 3, D: 8, C: 8, A: 6 };
export const ROLE_LABELS: Record<Role, string> = {
  P: "Portieri",
  D: "Difensori",
  C: "Centrocampisti",
  A: "Attaccanti",
};

export const PROFILE_LABELS: Record<PsychologyProfile, string> = {
  UNKNOWN: "Da osservare",
  RATIONAL: "Razionale",
  MODERATE: "Moderato",
  SELECTIVE_AGGRESSIVE: "Aggressivo selettivo",
  CONSERVATIVE: "Conservativo creativo",
  CHAOTIC: "Caotico",
  TOP_HEAVY: "Top-heavy",
  ULTRA_CONSERVATIVE: "Ultra-conservativo",
};
