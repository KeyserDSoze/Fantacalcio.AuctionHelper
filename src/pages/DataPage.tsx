import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppSnapshot } from "@/types";

export function DataPage({ onExport, onImport }: { onExport: () => Promise<AppSnapshot>; onImport: (s: AppSnapshot) => Promise<void> }) {
  const ref = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const download = async () => { const data = await onExport(); const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"}); const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`fantacalcio-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url); };
  const importJson = async (file?: File) => { if(!file) return; try { const snapshot=JSON.parse(await file.text()) as AppSnapshot; await onImport(snapshot); setMessage("Backup importato correttamente."); } catch { setMessage("Backup non valido."); } };
  return <div className="space-y-4 sm:space-y-6"><div><h1 className="text-2xl font-bold sm:text-3xl">Dati & backup</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">IndexedDB è locale al browser: esporta un backup prima dell'asta e nei momenti importanti.</p></div>{message && <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{message}</div>}<div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Esporta snapshot</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Giocatori, tier, preferenze, squadre, acquisti e fase corrente.</p><Button className="min-h-11 w-full sm:w-auto" onClick={() => void download()}><Download className="h-4 w-4" />Esporta JSON</Button></CardContent></Card><Card><CardHeader><CardTitle>Ripristina snapshot</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Sostituisce i dati locali con quelli contenuti nel file.</p><input ref={ref} className="hidden" type="file" accept="application/json,.json" onChange={(e) => void importJson(e.target.files?.[0])} /><Button className="min-h-11 w-full sm:w-auto" variant="outline" onClick={() => ref.current?.click()}><Upload className="h-4 w-4" />Importa JSON</Button></CardContent></Card></div></div>;
}
