import { useState } from "react";
import { AdminWines } from "@/components/app/admin-wines";
import { AdminWinesFridge } from "@/components/app/admin-wines-fridge";

type SubTab = "vine" | "køleskab";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "vine",      label: "Vine" },
  { id: "køleskab",  label: "Køleskab" },
];

export function AdminWinesSection() {
  const [tab, setTab] = useState<SubTab>("vine");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {SUBTABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "vine" ? <AdminWines /> : <AdminWinesFridge />}
    </div>
  );
}
