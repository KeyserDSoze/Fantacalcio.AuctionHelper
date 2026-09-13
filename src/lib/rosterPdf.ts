import { jsPDF } from "jspdf";
import { purchaseBudgetImpact, teamSnapshot } from "@/lib/analytics";
import type { AppSnapshot, FantasyTeam, Purchase, Role } from "@/types";
import { ROLE_LABELS, ROLE_LIMITS } from "@/types";

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "squadra";
}

function groupForPurchase(purchase: Purchase, data: AppSnapshot) {
  return (purchase.bundleId ? data.purchases.filter((item) => item.bundleId === purchase.bundleId) : [purchase]).sort((a, b) => a.timestamp - b.timestamp);
}

function primaryForPurchase(purchase: Purchase, data: AppSnapshot) {
  return groupForPurchase(purchase, data)[0] ?? purchase;
}

function groupCost(group: Purchase[]) {
  return group.reduce((sum, item) => sum + purchaseBudgetImpact(item), 0);
}

export function exportRosterPdf(data: AppSnapshot, team: FantasyTeam) {
  const snapshot = teamSnapshot(team, data.players, data.purchases);
  const purchases = data.purchases.filter((purchase) => purchase.fantasyTeamId === team.id).sort((a, b) => a.timestamp - b.timestamp);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - 14) return;
    doc.addPage();
    y = 16;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(team.name, margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Fantacalcio Auction Helper - Rosa squadra", margin, y);
  y += 8;
  doc.setFontSize(10);
  [`Spesi: ${snapshot.spent}`, `Rimasti: ${snapshot.remaining}`, `Rosa: ${snapshot.totalPlayers}/25`, `Budget libero: ${snapshot.freeBudget}`].forEach((value, index) => {
    doc.text(value, margin + (index % 2) * 88, y + Math.floor(index / 2) * 6);
  });
  y += 16;
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  (["P", "D", "C", "A"] as Role[]).forEach((role) => {
    const rolePurchases = purchases.filter((purchase) => purchase.role === role);
    ensureSpace(18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`${ROLE_LABELS[role]} (${rolePurchases.length}/${ROLE_LIMITS[role]})`, margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.text("Giocatore", margin, y);
    doc.text("Club", 92, y);
    doc.text("Quota", 142, y);
    doc.text("Prezzo", 166, y);
    y += 3;
    doc.setDrawColor(215);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;

    if (!rolePurchases.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Nessun giocatore", margin, y);
      y += 7;
      return;
    }

    const seenBundles = new Set<string>();
    rolePurchases.forEach((purchase) => {
      const player = data.players.find((item) => item.id === purchase.playerId);
      if (!player) return;
      const primary = primaryForPurchase(purchase, data);
      const group = groupForPurchase(primary, data);

      if (purchase.bundleId) {
        if (primary.id !== purchase.id || seenBundles.has(purchase.bundleId)) return;
        seenBundles.add(purchase.bundleId);
        const bundlePlayers = group.map((item) => data.players.find((candidate) => candidate.id === item.playerId)).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
        const bundleCost = groupCost(group);
        bundlePlayers.forEach((bundlePlayer, index) => {
          ensureSpace(8);
          doc.setFont("helvetica", index === 0 ? "bold" : "normal");
          doc.setFontSize(9);
          doc.text(doc.splitTextToSize(index === 0 ? `${bundlePlayer.name} (bundle ${bundlePlayer.club})` : bundlePlayer.name, 72)[0], margin, y);
          doc.text(bundlePlayer.club, 92, y);
          doc.text(String(bundlePlayer.basePrice), 142, y);
          doc.text(index === 0 ? (primary.pricePending ? "Da inserire" : String(bundleCost)) : "incl.", 166, y);
          y += 6;
        });
        return;
      }

      ensureSpace(8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(doc.splitTextToSize(player.name, 72)[0], margin, y);
      doc.text(player.club, 92, y);
      doc.text(String(player.basePrice), 142, y);
      doc.text(purchase.pricePending ? "Da inserire" : String(purchaseBudgetImpact(purchase)), 166, y);
      y += 6;
    });
    y += 4;
  });

  ensureSpace(12);
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generato il ${new Date().toLocaleString("it-IT")}`, margin, y);
  doc.save(`${slug(team.name)}-rosa.pdf`);
}
