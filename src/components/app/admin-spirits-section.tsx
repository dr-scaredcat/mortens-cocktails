import { useState } from "react";
import { AdminSpirits } from "@/components/app/admin-spirits";
import { AdminSpiritTypes } from "@/components/app/admin-spirit-types";

type SubTab = "spiritus" | "typer";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "spiritus", label: "Spiritus" },
  { id: "typer", label: "Typer" },
];

export function AdminSpiritsSection() {
  const [tab, setTab] = useState<SubTab>("spiritus");

  return (
    <div>
      {/* Underfaner i pille-stil — samme udseende som cocktails/ingredienser-siderne */}
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

      {tab === "spiritus" ? <AdminSpirits /> : <AdminSpiritTypes />}
    </div>
  );
}
