import * as XLSX from "xlsx";
import type { Player, SerieAClub } from "@/types";
import { slugify } from "@/lib/utils";

interface RawPlayer {
  Nome?: string;
  Squadra?: string;
  Ruolo?: string;
  Quotazione?: string | number;
  Trequartista?: string;
}

export async function parseFantamasterFile(
  file: File,
  previousPlayers: Player[],
  previousClubs: SerieAClub[],
) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets.Tutti;
  if (!sheet) throw new Error("Il file deve contenere il foglio 'Tutti'.");

  const rows = XLSX.utils.sheet_to_json<RawPlayer>(sheet, { range: 1, defval: "" });
  const previousMap = new Map(previousPlayers.map((p) => [p.id, p]));
  const players: Player[] = rows
    .filter((row) => row.Nome && row.Squadra && ["P", "D", "C", "A"].includes(String(row.Ruolo).toUpperCase()))
    .map((row) => {
      const name = String(row.Nome).trim();
      const club = String(row.Squadra).trim();
      const role = String(row.Ruolo).toUpperCase() as Player["role"];
      const id = `${slugify(name)}__${slugify(club)}__${role.toLowerCase()}`;
      const previous = previousMap.get(id);
      return {
        id,
        name,
        club,
        role,
        basePrice: Number(String(row.Quotazione).replace(",", ".")) || 0,
        isTrequartista: String(row.Trequartista).trim().toUpperCase() === "SI",
        personalRating: previous?.personalRating ?? "NEUTRAL",
        priorityTier: previous?.priorityTier ?? null,
        targetChoice: previous?.targetChoice ?? null,
        status: previous?.status ?? "AVAILABLE",
        ownerId: previous?.ownerId,
        purchasePrice: previous?.purchasePrice,
      };
    });

  const previousClubMap = new Map(previousClubs.map((c) => [c.name.toLowerCase(), c]));
  const clubs: SerieAClub[] = [...new Set(players.map((p) => p.club))]
    .sort((a, b) => a.localeCompare(b, "it"))
    .map((name) => ({
      id: slugify(name),
      name,
      tier: previousClubMap.get(name.toLowerCase())?.tier ?? null,
    }));

  return { players, clubs };
}
