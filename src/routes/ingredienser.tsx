import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import { listIngredients, listCocktails, listCategories } from "@/lib/cocktails.functions";
import { setIngredientAvailable } from "@/lib/admin.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "@/hooks/use-session";
import { isAdmin as isAdminFn } from "@/lib/admin.functions";
import { toast } from "sonner";
import type { CocktailWithDetails } from "@/lib/cocktails.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/ingredienser")({
  head: () => ({
    meta: [
      { title: "Ingredienser — Aston's Bar" },
      { name: "description", content: "Marker hvilke ingredienser du har i barskabet." },
    ],
  }),
  component: IngredientsPage,
});

type Tab = "alle" | "goer-klar" | "indgaar-flest";

const TABS: { id: Tab; label: string }[] = [
  { id: "alle", label: "Alle" },
  { id: "goer-klar", label: "Gør en cocktail klar" },
  { id: "indgaar-flest", label: "Indgår i flest cocktails" },
];

function IngredientsPage() {
  const qc = useQueryClient();
  const { session } = useSession();
  const fetchList = useServerFn(listIngredients);
  const fetchCocktails = useServerFn(listCocktails);
  const checkAdmin = useServerFn(isAdminFn);
  const setAvail = useServerFn(setIngredientAvailable);
  const fetchCats = useServerFn(listCategories);

  const [tab, setTab] = useState<Tab>("alle");
  const [openName, setOpenName] = useState<string | null>(null);

  const { data: ingredients } = useQuery({
    queryKey: ["ingredients"],
    queryFn: () => fetchList(),
  });
  const { data: cocktails } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCats(),
  });
  const { data: admin } = useQuery({
    queryKey: ["isAdmin", session?.user.id ?? null],
    queryFn: () => checkAdmin(),
    enabled: !!session,
  });

  const canEdit = !!admin?.isAdmin;

  const toggle = useMutation({
    mutationFn: (vars: { id: string; available: boolean }) =>
      setAvail({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["cocktails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Fane: Alle — grupperet efter kategori ──
  const grouped = useMemo(() => {
    const map = new Map<string, typeof ingredients>();
    for (const cat of categories ?? []) map.set(cat.name, [] as any);
    if (!map.has("Andet")) map.set("Andet", [] as any);
    for (const ing of ingredients ?? []) {
      const k = (map.has(ing.category) ? ing.category : "Andet") as string;
      (map.get(k) as any[]).push(ing);
    }
    return Array.from(map.entries()).filter(([, v]) => (v as any[]).length > 0);
  }, [ingredients, categories]);

  // ── Fane: Gør en cocktail klar — ingredienser hvor kun den ene mangler ──
  const goerKlarRows = useMemo(() => {
    const list = (cocktails ?? []) as CocktailWithDetails[];
    const map = new Map<string, string[]>(); // ingrediensnavn → cocktailnavne
    for (const c of list) {
      if (c.missing.length === 1) {
        const ingName = c.missing[0];
        const arr = map.get(ingName) ?? [];
        arr.push(c.name);
        map.set(ingName, arr);
      }
    }
    return Array.from(map.entries())
      .map(([name, cocktailNames]) => ({
        name,
        cocktailNames: [...cocktailNames].sort((a, b) => a.localeCompare(b, "da")),
        ingredient: (ingredients ?? []).find((i) => i.name === name),
      }))
      .sort((a, b) => b.cocktailNames.length - a.cocktailNames.length || a.name.localeCompare(b.name, "da"));
  }, [cocktails, ingredients]);

  // ── Fane: Indgår i flest cocktails — ikke tilgængelige ingredienser sorteret efter brug ──
  const indgaarFlestRows = useMemo(() => {
    const list = (cocktails ?? []) as CocktailWithDetails[];
    const map = new Map<string, string[]>(); // ingrediensnavn → cocktailnavne
    for (const c of list) {
      for (const i of c.ingredients) {
        if (!i.available) {
          const arr = map.get(i.name) ?? [];
          arr.push(c.name);
          map.set(i.name, arr);
        }
      }
    }
    return Array.from(map.entries())
      .map(([name, cocktailNames]) => ({
        name,
        // Deduplicate
        cocktailNames: [...new Set(cocktailNames)].sort((a, b) => a.localeCompare(b, "da")),
        ingredient: (ingredients ?? []).find((i) => i.name === name),
      }))
      .sort((a, b) => b.cocktailNames.length - a.cocktailNames.length || a.name.localeCompare(b.name, "da"));
  }, [cocktails, ingredients]);

  const openRow =
    tab === "goer-klar"
      ? goerKlarRows.find((r) => r.name === openName) ?? null
      : indgaarFlestRows.find((r) => r.name === openName) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-1 font-serif text-3xl">Ingredienser</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          {canEdit
            ? "Marker hvad du har på lager. Ændringer slår igennem med det samme."
            : "Oversigt over ingredienser. Log ind som admin for at redigere lager."}
        </p>

        {/* Fane-vælger */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {TABS.map((t) => (
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

        {/* ── Fane: Alle ── */}
        {tab === "alle" && (
          <div className="space-y-6">
            {grouped.map(([cat, items]) => (
              <section key={cat}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
                  {cat}
                </h2>
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {(items as any[]).map((ing) => (
                    <li key={ing.id} className="flex items-center px-4 py-3">
                      <label className="flex flex-1 cursor-pointer items-center gap-3">
                        <Checkbox
                          checked={ing.available}
                          disabled={!canEdit || toggle.isPending}
                          onCheckedChange={(v) =>
                            canEdit && toggle.mutate({ id: ing.id, available: !!v })
                          }
                        />
                        <span className={ing.available ? "" : "text-muted-foreground"}>
                          {ing.name}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {grouped.length === 0 && (
              <p className="text-muted-foreground">Ingen ingredienser endnu.</p>
            )}
          </div>
        )}

        {/* ── Fane: Gør en cocktail klar ── */}
        {tab === "goer-klar" && (
          <div>
            <p className="mb-4 text-sm text-muted-foreground">
              Ingredienser der mangler præcis én gang for at en cocktail bliver klar, sorteret efter flest cocktails.
            </p>
            {goerKlarRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                Ingen ingredienser ville gøre en cocktail klar med det samme.
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {goerKlarRows.map((r) => (
                  <li key={r.name} className="flex items-center gap-3 px-4 py-3">
                    {r.ingredient && (
                      <Checkbox
                        checked={r.ingredient.available}
                        disabled={!canEdit || toggle.isPending}
                        onCheckedChange={(v) =>
                          canEdit &&
                          r.ingredient &&
                          toggle.mutate({ id: r.ingredient.id, available: !!v })
                        }
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setOpenName(r.name)}
                      className="flex flex-1 items-center justify-between gap-3 text-left"
                    >
                      <span className="font-medium">{r.name}</span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {r.cocktailNames.length}{" "}
                        {r.cocktailNames.length === 1 ? "cocktail" : "cocktails"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Fane: Indgår i flest cocktails ── */}
        {tab === "indgaar-flest" && (
          <div>
            <p className="mb-4 text-sm text-muted-foreground">
              Ikke-tilgængelige ingredienser sorteret efter hvor mange cocktails de indgår i.
            </p>
            {indgaarFlestRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                Alle ingredienser er markeret som tilgængelige.
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {indgaarFlestRows.map((r) => (
                  <li key={r.name} className="flex items-center gap-3 px-4 py-3">
                    {r.ingredient && (
                      <Checkbox
                        checked={r.ingredient.available}
                        disabled={!canEdit || toggle.isPending}
                        onCheckedChange={(v) =>
                          canEdit &&
                          r.ingredient &&
                          toggle.mutate({ id: r.ingredient.id, available: !!v })
                        }
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => setOpenName(r.name)}
                      className="flex flex-1 items-center justify-between gap-3 text-left"
                    >
                      <span className={r.ingredient?.available ? "font-medium" : "font-medium"}>
                        {r.name}
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">
                        {r.cocktailNames.length}{" "}
                        {r.cocktailNames.length === 1 ? "cocktail" : "cocktails"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Dialog: vis cocktails for valgt ingrediens */}
        <Dialog open={!!openName} onOpenChange={(o) => !o && setOpenName(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{openName}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {tab === "goer-klar"
                ? "Disse cocktails bliver klar hvis du tilføjer ingrediensen:"
                : "Disse cocktails indeholder ingrediensen:"}
            </p>
            <ul className="mt-2 space-y-1">
              {openRow?.cocktailNames.map((name) => (
                <li key={name} className="text-sm">
                  {name}
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
