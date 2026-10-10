import { useState } from "react";
import { AdminIngredients } from "@/components/app/admin-ingredients";
import { AdminCategories } from "@/components/app/admin-categories";

type SubTab = "ingredienser" | "kategorier";

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: "ingredienser", label: "Ingredienser" },
  { id: "kategorier", label: "Kategorier" },
];

export function AdminIngredientsSection() {
  const [tab, setTab] = useState<SubTab>("ingredienser");

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

      {tab === "ingredienser" ? <AdminIngredients /> : <AdminCategories />}
    </div>
  );
}

