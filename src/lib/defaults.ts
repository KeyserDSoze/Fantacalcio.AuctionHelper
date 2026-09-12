import type { AuctionState, FantasyTeam } from "@/types";

export const DEFAULT_TEAMS: FantasyTeam[] = [
  { id: "soze-heaven", name: "Soze Heaven", initialBudget: 500, profile: "RATIONAL", supportedClubs: [], isMe: true },
  { id: "tommaso-daniele", name: "Tommaso & Daniele", initialBudget: 500, profile: "UNKNOWN", supportedClubs: ["Roma", "Inter"] },
  { id: "emanuele", name: "Emanuele", initialBudget: 500, profile: "RATIONAL", supportedClubs: ["Inter"] },
  { id: "luongo", name: "Luongo", initialBudget: 500, profile: "MODERATE", supportedClubs: ["Inter"] },
  { id: "capsi", name: "Capsi", initialBudget: 500, profile: "SELECTIVE_AGGRESSIVE", supportedClubs: ["Lazio"] },
  { id: "damiano-giamma", name: "Damiano & Giamma", initialBudget: 500, profile: "CONSERVATIVE", supportedClubs: ["Juventus", "Inter"] },
  { id: "mini", name: "Mini", initialBudget: 500, profile: "CHAOTIC", supportedClubs: ["Milan"] },
  { id: "suenac-brezio", name: "Suenac & Brezio", initialBudget: 500, profile: "TOP_HEAVY", supportedClubs: ["Inter"] },
  { id: "scaglia-cognato", name: "Scaglia & Cognato", initialBudget: 500, profile: "ULTRA_CONSERVATIVE", supportedClubs: ["Juventus", "Milan"] },
];

export const DEFAULT_AUCTION: AuctionState = {
  key: "auction",
  currentRole: "P",
  choiceNumber: 1,
  subRound: 1,
  resolvedTeamIds: [],
};
