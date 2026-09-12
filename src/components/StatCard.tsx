import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({ label, value, note, icon: Icon }: { label: string; value: string | number; note?: string; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex min-h-32 flex-col justify-between gap-3 p-3 sm:min-h-0 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground sm:text-sm">{label}</div>
          <div className="mt-1 break-words text-xl font-bold tabular sm:text-2xl">{value}</div>
          {note && <div className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">{note}</div>}
        </div>
        <div className="w-fit rounded-xl bg-primary/10 p-2.5 text-primary sm:p-3"><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div>
      </CardContent>
    </Card>
  );
}
