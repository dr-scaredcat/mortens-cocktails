import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import { CocktailCard } from "@/components/app/cocktail-card";
import { TagFilter } from "@/components/app/tag-filter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listCocktails, listRecipes, type CocktailWithDetails, type RecipeWithDetails } from "@/lib/cocktails.functions";
import { getShoppingList, addManyToShoppingList, addToShoppingList } from "@/lib/shopping-list.functions";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const searchSchema = z.object({
  tab: z.enum(["klar", "naesten", "alle"]).catch("klar"),
});

export const Route = createFileRoute("/cocktails")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Cocktails — Aston's Bar" },
      { name: "description", content: "Se hvilke cocktails du kan lave." },
    ],
  }),
  component: CocktailsPage,
});

type Tab = "klar" | "naesten" | "alle";

const TABS: { id: Tab; label: string }[] = [
  { id: "klar", label: "Klar" },
  { id: "naesten", label: "Næsten klar" },
  { id: "alle", label: "Alle" },
];

function CocktailsPage() {
  const { tab } = useSearch({ from: "/cocktails" });
  const navigate = useNavigate({ from: "/cocktails" });
  const fetchCocktails = useServerFn(listCocktails);
  const fetchShoppingList = useServerFn(getShoppingList);
  const fetchRecipes = useServerFn(listRecipes);
  const addMany = useServerFn(addManyToShoppingList);
  const addOne = useServerFn(addToShoppingList);
  const qc = useQueryClient();
  const { session } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });

  const { data: shoppingList } = useQuery({
    queryKey: ["shopping-list"],
    queryFn: () => fetchShoppingList(),
  });

  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => fetchRecipes(),
  });

  const shoppingListIds = useMemo(
    () => new Set((shoppingList ?? []).map((r) => r.ingredient_id)),
    [shoppingList],
  );

  const recipeByIngredientName = useMemo(() => {
    const map = new Map<string, RecipeWithDetails>();
    for (const r of (recipes ?? []) as RecipeWithDetails[]) {
      map.set(r.name.toLowerCase(), r);
    }
    return map;
  }, [recipes]);

  // Dialog-state for opskrift-substitution
  const [recipeDialog, setRecipeDialog] = useState<{
    directIds: string[];       // IDs til direkte tilfoejelse (ingen opskrift)
    pending: Array<{ ingredientId: string; ingredientName: string; recipe: RecipeWithDetails }>;
    currentIdx: number;
  } | null>(null);

  const addManyM = useMutation({
    mutationFn: (ids: string[]) => addMany({ data: { ingredientIds: ids } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-list"] });
      toast.success("Tilfojet til indkoebsliste");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addOneM = useMutation({
    mutationFn: (id: string) => addOne({ data: { ingredientId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Naar brugeren klikker "tilfoej manglende" pa en cocktail:
  // split ingredienserne i dem med opskrift (sporg) og dem uden (direkte)
  function handleAddMissing(cocktail: CocktailWithDetails) {
    const missing = cocktail.ingredients.filter((i) => !i.available);
    const withRecipe: Array<{ ingredientId: string; ingredientName: string; recipe: RecipeWithDetails }> = [];
    const directIds: string[] = [];
    for (const ing of missing) {
      const recipe = recipeByIngredientName.get(ing.name.toLowerCase());
      if (recipe) {
        withRecipe.push({ ingredientId: ing.ingredient_id, ingredientName: ing.name, recipe });
      } else {
        directIds.push(ing.ingredient_id);
      }
    }
    if (withRecipe.length === 0) {
      // Ingen opskrifter — tilfoej direkte
      if (directIds.length > 0) addManyM.mutate(directIds);
    } else {
      setRecipeDialog({ directIds, pending: withRecipe, currentIdx: 0 });
    }
  }

  function handleRecipeChoice(useRecipe: boolean) {
    if (!recipeDialog) return;
    const current = recipeDialog.pending[recipeDialog.currentIdx];
    const newDirectIds = [...recipeDialog.directIds];
    if (useRecipe) {
      const missingInRecipe = current.recipe.ingredients
        .filter((i) => !i.available)
        .map((i) => i.ingredient_id);
      newDirectIds.push(...missingInRecipe);
    } else {
      newDirectIds.push(current.ingredientId);
    }
    const nextIdx = recipeDialog.currentIdx + 1;
    if (nextIdx < recipeDialog.pending.length) {
      setRecipeDialog({ ...recipeDialog, directIds: newDirectIds, currentIdx: nextIdx });
    } else {
      // Faerdigt — tilfoej alle
      if (newDirectIds.length > 0) addManyM.mutate(newDirectIds);
      setRecipeDialog(null);
    }
  }

  const [tags, setTags] = useState<string[]>([]);
  const [q, setQ] = useState("");

  function setTab(t: Tab) {
    navigate({ search: { tab: t }, replace: true });
  }

  const subtitles: Record<Tab, string> = {
    klar: "Cocktails hvor du har alle ingredienser i barskabet.",
    naesten: "Cocktails der mangler præcis én ingrediens.",
    alle: "Hele biblioteket sorteret efter hvor tæt du er på at kunne lave dem.",
  };

  const filtered = useMemo(() => {
    const list = (data ?? []) as CocktailWithDetails[];
    let f = list;
    if (tab === "klar") f = f.filter((c) => c.missing.length === 0);
    else if (tab === "naesten") f = f.filter((c) => c.missing.length === 1);
    if (tags.length > 0) f = f.filter((c) => tags.every((t) => c.tags.includes(t)));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      f = f.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c.ingredients.some((i) => i.name.toLowerCase().includes(s)) ||
          c.tags.some((t) => t.toLowerCase().includes(s)),
      );
    }
    return [...f].sort(
      (a, b) => a.missing.length - b.missing.length || (a.position ?? 0) - (b.position ?? 0),
    );
  }, [data, tab, tags, q]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Cocktails</h1>
          <p className="text-sm text-muted-foreground">{subtitles[tab]}</p>
        </div>

        {/* Tab vælger */}
        <div className="mb-5 flex gap-1 rounded-xl border border-border bg-card p-1">
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

        <div className="mb-5 space-y-3">
          <Input
            placeholder="Søg efter navn eller ingrediens..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <TagFilter
            selected={tags}
            onToggle={(t) =>
              setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
            }
            onClear={() => setTags([])}
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            Ingen cocktails matcher.
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "cocktail" : "cocktails"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <CocktailCard
                  key={c.id}
                  cocktail={c}
                  thumb
                  showInstructions
                  shoppingListIds={session ? shoppingListIds : undefined}
                  onAddToShoppingList={session ? () => handleAddMissing(c) : undefined}
                />
              ))}
            </div>
          </>
        )}

        {/* Dialog: sporg om ingrediens eller opskrift */}
        {recipeDialog && recipeDialog.currentIdx < recipeDialog.pending.length && (() => {
          const current = recipeDialog.pending[recipeDialog.currentIdx];
          const missingInRecipe = current.recipe.ingredients.filter((i) => !i.available);
          return (
            <Dialog open onOpenChange={(o) => !o && setRecipeDialog(null)}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{current.ingredientName}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Der findes en opskrift på {current.ingredientName}. Vil du tilføje selve
                  ingrediensen eller ingredienserne til at lave opskriften?
                  {recipeDialog.pending.length > 1 && (
                    <span className="ml-1 text-xs">
                      ({recipeDialog.currentIdx + 1}/{recipeDialog.pending.length})
                    </span>
                  )}
                </p>
                {missingInRecipe.length > 0 && (
                  <ul className="mt-1 space-y-0.5 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    {missingInRecipe.map((i) => (
                      <li key={i.ingredient_id} className="text-sm text-muted-foreground">
                        {i.name}
                      </li>
                    ))}
                  </ul>
                )}
                {missingInRecipe.length === 0 && (
                  <p className="text-sm italic text-muted-foreground">
                    Alle ingredienser til opskriften er allerede på lager.
                  </p>
                )}
                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button variant="outline" className="flex-1" onClick={() => handleRecipeChoice(false)}>
                    Tilføj {current.ingredientName}
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={missingInRecipe.length === 0}
                    onClick={() => handleRecipeChoice(true)}
                  >
                    Tilføj opskriftens ingredienser
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        })()}
      </main>
    </div>
  );
}
