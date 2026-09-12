import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { Layout, type PageKey } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuctionData } from "@/hooks/useAuctionData";
import { DashboardPage } from "@/pages/DashboardPage";
import { AuctionPage } from "@/pages/AuctionPage";
import { PendingPricesPage } from "@/pages/PendingPricesPage";
import { MarketPage } from "@/pages/MarketPage";
import { FinalReportPage } from "@/pages/FinalReportPage";
import { PlayersPage } from "@/pages/PlayersPage";
import { ClubsPage } from "@/pages/ClubsPage";
import { OpponentsPage } from "@/pages/OpponentsPage";
import { DataPage } from "@/pages/DataPage";

const AUTH_SESSION_KEY = "fantacalcio-auction-helper-auth-v1";
// Verifica client-side minimale: nel bundle è presente solo l'hash SHA-256, non la password in chiaro.
const PASSWORD_SHA256 = "2e64e47f7c1f97c7662806f05632c8a6221731ad6f5e3db505fa6dfcb8d1a694";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password || checking) return;
    setChecking(true);
    setError("");
    try {
      const digest = await sha256(password);
      if (digest !== PASSWORD_SHA256) {
        setError("Password non corretta.");
        setPassword("");
        return;
      }
      sessionStorage.setItem(AUTH_SESSION_KEY, "ok");
      onUnlock();
    } catch {
      setError("Impossibile verificare la password su questo browser.");
    } finally {
      setChecking(false);
    }
  }

  return <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
    <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl sm:p-7">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="h-7 w-7" /></div>
      <div className="mt-5 text-center">
        <h1 className="text-2xl font-black tracking-tight">Auction Helper</h1>
        <p className="mt-2 text-sm text-muted-foreground">Inserisci la password per accedere alla gestione dell'asta.</p>
      </div>

      <form className="mt-6 space-y-3" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm font-semibold" htmlFor="auction-password">Password</label>
        <div className="relative">
          <input
            id="auction-password"
            autoFocus
            autoComplete="current-password"
            className="h-12 w-full rounded-lg border bg-background px-3 pr-12 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••"
          />
          <button
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted-foreground hover:text-foreground"
            type="button"
            aria-label={showPassword ? "Nascondi password" : "Mostra password"}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <Button className="h-12 w-full text-base" type="submit" disabled={!password || checking}>
          {checking && <Loader2 className="h-4 w-4 animate-spin" />}
          Entra
        </Button>
      </form>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">Accesso valido per questa sessione del browser. È una protezione leggera pensata per evitare accessi casuali al link.</p>
    </div>
  </div>;
}

function AuctionApp() {
  const [page, setPage] = useState<PageKey>("dashboard");
  const api = useAuctionData();

  useEffect(() => {
    const team = api.data?.teams.find((item) => item.id === "suenac-brezio" && item.name !== "Swenac & Brezio");
    if (team) void api.updateTeam({ ...team, name: "Swenac & Brezio" });
  }, [api.data?.teams]);

  if (api.loading || !api.data) return <div className="grid min-h-screen place-items-center"><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Caricamento database locale…</div></div>;
  const data = api.data;
  return <Layout page={page} onPage={setPage}>
    {page === "dashboard" && <DashboardPage data={data} onUndoPurchase={api.undoPurchase} />}
    {page === "auction" && <AuctionPage data={data} onAuction={api.updateAuction} onPurchase={api.addPurchase} onPurchaseBundle={api.addPurchaseBundle} onBid={api.addBid} onOpenPrices={() => setPage("prices")} onEditPurchase={api.editPurchase} onUndoPurchase={api.undoPurchase} />}
    {page === "prices" && <PendingPricesPage data={data} onSave={api.finalizePendingPrices} />}
    {page === "market" && <MarketPage data={data} onUndoPurchase={api.undoPurchase} onDeleteBid={api.removeBid} />}
    {page === "report" && <FinalReportPage data={data} onAuction={api.updateAuction} />}
    {page === "players" && <PlayersPage data={data} onPlayer={api.updatePlayer} onPlayers={api.updatePlayers} onCatalog={api.replaceCatalog} />}
    {page === "clubs" && <ClubsPage data={data} onClub={api.updateClub} />}
    {page === "opponents" && <OpponentsPage data={data} onTeam={api.updateTeam} />}
    {page === "data" && <DataPage onExport={api.exportBackup} onImport={api.importBackup} />}
  </Layout>;
}

export function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(AUTH_SESSION_KEY) === "ok");
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  return <AuctionApp />;
}
