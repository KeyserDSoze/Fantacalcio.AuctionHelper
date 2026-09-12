import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Layout, type PageKey } from "@/components/Layout";
import { useAuctionData } from "@/hooks/useAuctionData";
import { DashboardPage } from "@/pages/DashboardPage";
import { AuctionPage } from "@/pages/AuctionPage";
import { MarketPage } from "@/pages/MarketPage";
import { PlayersPage } from "@/pages/PlayersPage";
import { ClubsPage } from "@/pages/ClubsPage";
import { OpponentsPage } from "@/pages/OpponentsPage";
import { DataPage } from "@/pages/DataPage";

export function App() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const api = useAuctionData();
  if (api.loading || !api.data) return <div className="grid min-h-screen place-items-center"><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Caricamento database locale…</div></div>;
  const data = api.data;
  return <Layout page={page} onPage={setPage}>
    {page === "dashboard" && <DashboardPage data={data} onUndoPurchase={api.undoPurchase} />}
    {page === "auction" && <AuctionPage data={data} onAuction={api.updateAuction} onPurchase={api.addPurchase} onBid={api.addBid} />}
    {page === "market" && <MarketPage data={data} onUndoPurchase={api.undoPurchase} onDeleteBid={api.removeBid} />}
    {page === "players" && <PlayersPage data={data} onPlayer={api.updatePlayer} onCatalog={api.replaceCatalog} />}
    {page === "clubs" && <ClubsPage data={data} onClub={api.updateClub} />}
    {page === "opponents" && <OpponentsPage data={data} onTeam={api.updateTeam} />}
    {page === "data" && <DataPage onExport={api.exportBackup} onImport={api.importBackup} />}
  </Layout>;
}
