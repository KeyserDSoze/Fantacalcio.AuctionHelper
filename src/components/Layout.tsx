import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, Database, Gavel, History, Menu, Moon, ReceiptText, Shield, Sparkles, Sun, Target, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PageKey = "dashboard" | "auction" | "prices" | "market" | "report" | "players" | "clubs" | "opponents" | "data";

const items: { key: PageKey; label: string; icon: typeof BarChart3; group: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3, group: "Asta" },
  { key: "auction", label: "Gestione asta", icon: Gavel, group: "Asta" },
  { key: "prices", label: "Prezzi da completare", icon: ReceiptText, group: "Asta" },
  { key: "market", label: "Mercato & storico", icon: History, group: "Asta" },
  { key: "report", label: "Report finale", icon: Sparkles, group: "Asta" },
  { key: "players", label: "Giocatori", icon: Target, group: "Amministrazione" },
  { key: "clubs", label: "Tier Serie A", icon: Shield, group: "Amministrazione" },
  { key: "opponents", label: "Avversari", icon: Users, group: "Amministrazione" },
  { key: "data", label: "Dati & backup", icon: Database, group: "Sistema" },
];

const mobileQuick: PageKey[] = ["dashboard", "auction", "prices", "market", "players"];

export function Layout({ page, onPage, children }: { page: PageKey; onPage: (p: PageKey) => void; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") !== "light");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center gap-3 border-b px-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Gavel className="h-5 w-5" /></div>
        <div><div className="font-bold">Soze Heaven</div><div className="text-xs text-muted-foreground">Auction Helper</div></div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-3 pb-24 lg:pb-3">
        {["Asta", "Amministrazione", "Sistema"].map((group) => (
          <div key={group}>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group}</div>
            <div className="space-y-1">
              {items.filter((item) => item.group === group).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => { onPage(key); setMobileOpen(false); }} className={cn("flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition", page === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t p-3"><Button variant="ghost" className="min-h-11 w-full justify-start" onClick={() => setDark((value) => !value)}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{dark ? "Tema chiaro" : "Tema scuro"}</Button></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-background lg:block">{sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} /><aside className="absolute inset-y-0 left-0 w-[min(88vw,22rem)] bg-background shadow-2xl">{sidebar}<button aria-label="Chiudi menu" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-lg hover:bg-accent" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button></aside></div>}
      <main className="pb-20 lg:pb-0 lg:pl-64">
        <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between border-b px-3 sm:h-16 sm:px-4 lg:px-8">
          <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button>
          <div className="ml-2 text-sm font-bold lg:hidden">Soze Heaven</div>
          <div className="ml-auto flex items-center gap-2"><div className="hidden text-right sm:block"><div className="text-sm font-semibold">Fantacalcio 2026/27</div><div className="text-xs text-muted-foreground">500 crediti · 9 squadre</div></div></div>
        </header>
        <div className="mx-auto max-w-[1600px] p-3 sm:p-4 lg:p-8">{children}</div>
      </main>

      <nav className="glass fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-1 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden">
        {mobileQuick.map((key) => {
          const item = items.find((entry) => entry.key === key)!;
          const Icon = item.icon;
          const shortLabel = key === "dashboard" ? "Home" : key === "auction" ? "Asta" : key === "prices" ? "Prezzi" : key === "market" ? "Mercato" : "Giocatori";
          return <button key={key} onClick={() => onPage(key)} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium", page === key ? "text-primary" : "text-muted-foreground")}><Icon className={cn("h-5 w-5", page === key && "stroke-[2.5]")} /><span>{shortLabel}</span></button>;
        })}
      </nav>
    </div>
  );
}
