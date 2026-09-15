import { useState } from "react";
import { AdminVinglasTypes } from "@/components/app/admin-vinglas-types";
import { AdminVinglasMapping } from "@/components/app/admin-vinglas-mapping";

type SubTab = "glastyper" | "opslag";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "glastyper", label: "Glastyper" },
  { id: "opslag",    label: "Drue → glas" },
];

export function AdminVinglasSection() {
  const [tab, setTab] = useState<SubTab>("glastyper");

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
      {tab === "glastyper" ? <AdminVinglasTypes /> : <AdminVinglasMapping />}
    </div>
  );
}
