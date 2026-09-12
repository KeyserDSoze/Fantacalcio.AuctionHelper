import { useEffect, useState } from "react";
import { BarChart3, Database, Gavel, Menu, Moon, Shield, Sun, Target, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PageKey = "dashboard" | "auction" | "players" | "clubs" | "opponents" | "data";

const items: { key: PageKey; label: string; icon: typeof BarChart3; group: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3, group: "Asta" },
  { key: "auction", label: "Gestione asta", icon: Gavel, group: "Asta" },
  { key: "players", label: "Giocatori", icon: Target, group: "Amministrazione" },
  { key: "clubs", label: "Tier Serie A", icon: Shield, group: "Amministrazione" },
  { key: "opponents", label: "Avversari", icon: Users, group: "Amministrazione" },
  { key: "data", label: "Dati & backup", icon: Database, group: "Sistema" },
];

export function Layout({ page, onPage, children }: { page: PageKey; onPage: (p: PageKey) => void; children: React.ReactNode }) {
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
      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {["Asta", "Amministrazione", "Sistema"].map((group) => (
          <div key={group}>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group}</div>
            <div className="space-y-1">
              {items.filter((i) => i.group === group).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => { onPage(key); setMobileOpen(false); }} className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition", page === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t p-3"><Button variant="ghost" className="w-full justify-start" onClick={() => setDark((v) => !v)}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}{dark ? "Tema chiaro" : "Tema scuro"}</Button></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r bg-background lg:block">{sidebar}</aside>
      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} /><aside className="absolute inset-y-0 left-0 w-72 bg-background shadow-2xl">{sidebar}<button className="absolute right-3 top-3" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button></aside></div>}
      <main className="lg:pl-64">
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 lg:px-8"><Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></Button><div className="ml-auto flex items-center gap-2"><div className="hidden text-right sm:block"><div className="text-sm font-semibold">Fantacalcio 2026/27</div><div className="text-xs text-muted-foreground">500 crediti · 9 squadre</div></div></div></header>
        <div className="mx-auto max-w-[1600px] p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
