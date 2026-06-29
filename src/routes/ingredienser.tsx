import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import { listIngredients, listCocktails, listCategories } from "@/lib/cocktails.functions";
import { setIngredientAvailable } from "@/lib/admin.functions";
import { getShoppingList, addToShoppingList, removeFromShoppingList, removeFromShoppingListOnly } from "@/lib/shopping-list.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { isAdmin as isAdminFn } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Search, ShoppingCart, Check, X } from "lucide-react";
import type { CocktailWithDetails } from "@/lib/cocktails.functions";
import { ShoppingListButton } from "@/components/app/shopping-list-button";
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

type Tab = "alle" | "goer-klar" | "indgaar-flest" | "indkoebsliste";

const TABS: { id: Tab; label: string }[] = [
  { id: "alle", label: "Alle" },
  { id: "goer-klar", label: "Gør en cocktail klar" },
  { id: "indgaar-flest", label: "Indgår i flest cocktails" },
  { id: "indkoebsliste", label: "Indkøbsliste" },
];

function IngredientsPage() {
  const qc = useQueryClient();
  const { session } = useSession();
  const fetchList = useServerFn(listIngredients);
  const fetchCocktails = useServerFn(listCocktails);
  const checkAdmin = useServerFn(isAdminFn);
  const setAvail = useServerFn(setIngredientAvailable);
  const fetchCats = useServerFn(listCategories);
  const fetchShoppingList = useServerFn(getShoppingList);
  const addToList = useServerFn(addToShoppingList);
  const removeFromList = useServerFn(removeFromShoppingList);
  const removeFromListOnly = useServerFn(removeFromShoppingListOnly);

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

  const { data: shoppingListData } = useQuery({
    queryKey: ["shopping-list"],
    queryFn: () => fetchShoppingList(),
  });

  const shoppingListIds = useMemo(
    () => new Set((shoppingListData ?? []).map((r) => r.ingredient_id)),
    [shoppingListData],
  );

  const canEdit = !!admin?.isAdmin;

  const addM = useMutation({
    mutationFn: (ingredientId: string) => addToList({ data: { ingredientId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    mutationFn: (ingredientId: string) => removeFromList({ data: { ingredientId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-list"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["cocktails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeOnlyM = useMutation({
    mutationFn: (ingredientId: string) => removeFromListOnly({ data: { ingredientId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list"] }),
    onError: (e: Error) => toast.error(e.message),
  });

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

  // ── Søgning ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const filteredGrouped = q
    ? grouped
        .map(([cat, items]) => [cat, (items as any[]).filter((i: any) => i.name.toLowerCase().includes(q))] as [string, any[]])
        .filter(([, items]) => items.length > 0)
    : grouped;

  const filteredGoerKlar = q
    ? goerKlarRows.filter((r) => r.name.toLowerCase().includes(q))
    : goerKlarRows;

  const filteredIndgaar = q
    ? indgaarFlestRows.filter((r) => r.name.toLowerCase().includes(q))
    : indgaarFlestRows;

  // ── Indkøbsliste grupperet efter kategori ─────────────────────────────────
  const shoppingListGrouped = useMemo(() => {
    const items = shoppingListData ?? [];
    const map = new Map<string, typeof items>();
    for (const row of items) {
      const cat = row.ingredients?.category ?? "Andet";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(row);
    }
    // Sorter kategorier alfabetisk
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "da"));
  }, [shoppingListData]);

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

        {/* Søgefelt — ikke vist på indkøbsliste-fanen */}
        {tab !== "indkoebsliste" && (
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg efter ingrediens..."
              className="pl-9"
            />
          </div>
        )}

        {/* Fane-vælger — select på mobil, pills på større skærme */}
        <div className="mb-6">
          {/* Mobil: dropdown */}
          <select
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium sm:hidden"
            value={tab}
            onChange={(e) => { setTab(e.target.value as Tab); setSearch(""); }}
          >
            {TABS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}{t.id === "indkoebsliste" && (shoppingListData ?? []).length > 0 ? ` (${(shoppingListData ?? []).length})` : ""}
              </option>
            ))}
          </select>
          {/* Større skærme: pill-knapper */}
          <div className="hidden sm:flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setSearch(""); }}
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                {t.id === "indkoebsliste" && (shoppingListData ?? []).length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                    {(shoppingListData ?? []).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Fane: Alle ── */}
        {tab === "alle" && (
          <div className="space-y-6">
            {filteredGrouped.map(([cat, items]) => (
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
                      {session && (
                        <ShoppingListButton
                          ingredientIds={[ing.id]}
                          shoppingListIds={shoppingListIds}
                          onAdd={() => addM.mutate(ing.id)}
                          isPending={addM.isPending}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {filteredGrouped.length === 0 && (
              <p className="text-muted-foreground">
                {q ? "Ingen ingredienser matcher søgningen." : "Ingen ingredienser endnu."}
              </p>
            )}
          </div>
        )}

        {/* ── Fane: Gør en cocktail klar ── */}
        {tab === "goer-klar" && (
          <div>
            <p className="mb-4 text-sm text-muted-foreground">
              Ingredienser der mangler præcis én gang for at en cocktail bliver klar, sorteret efter flest cocktails.
            </p>
            {filteredGoerKlar.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                {q ? "Ingen ingredienser matcher søgningen." : "Ingen ingredienser ville gøre en cocktail klar med det samme."}
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {filteredGoerKlar.map((r) => (
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
                    {session && r.ingredient && (
                      <ShoppingListButton
                        ingredientIds={[r.ingredient.id]}
                        shoppingListIds={shoppingListIds}
                        onAdd={() => addM.mutate(r.ingredient!.id)}
                        isPending={addM.isPending}
                      />
                    )}
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
            {filteredIndgaar.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                {q ? "Ingen ingredienser matcher søgningen." : "Alle ingredienser er markeret som tilgængelige."}
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {filteredIndgaar.map((r) => (
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
                    {session && r.ingredient && (
                      <ShoppingListButton
                        ingredientIds={[r.ingredient.id]}
                        shoppingListIds={shoppingListIds}
                        onAdd={() => addM.mutate(r.ingredient!.id)}
                        isPending={addM.isPending}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Fane: Indkøbsliste ── */}
        {tab === "indkoebsliste" && (
          <div>
            {shoppingListGrouped.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
                Indkøbslisten er tom. Tilføj ingredienser fra de andre faner.
              </div>
            ) : (
              <div className="space-y-6">
                {shoppingListGrouped.map(([cat, rows]) => (
                  <section key={cat}>
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
                      {cat}
                    </h2>
                    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                      {rows.map((row) => (
                        <li key={row.ingredient_id} className="flex items-center gap-3 px-4 py-3">
                          <button
                            type="button"
                            disabled={removeM.isPending || !session}
                            onClick={() => session && removeM.mutate(row.ingredient_id)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                            title="Marker som købt og tilføj til lager"
                            aria-label="Marker som købt"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <span className="flex-1 text-sm">{row.ingredients?.name}</span>
                          <button
                            type="button"
                            disabled={removeOnlyM.isPending || !session}
                            onClick={() => session && removeOnlyM.mutate(row.ingredient_id)}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:text-destructive disabled:opacity-40"
                            title="Fjern fra liste (uden at tilføje til lager)"
                            aria-label="Fjern fra liste"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    {session && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        ✓ mark
