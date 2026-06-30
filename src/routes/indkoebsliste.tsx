import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import { listRecipes, type RecipeWithDetails } from "@/lib/cocktails.functions";
import {
  getShoppingList,
  addToShoppingList,
  addManyToShoppingList,
  removeFromShoppingList,
  removeFromShoppingListOnly,
} from "@/lib/shopping-list.functions";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";
import { Check, X, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/indkoebsliste")({
  head: () => ({
    meta: [
      { title: "Indkoebsliste — Aston's Bar" },
      { name: "description", content: "Din indkoebsliste." },
    ],
  }),
  component: IndkoebslistePage,
});

// ── Dialog der spørger om man vil tilføje ingrediensen eller dens opskrift ──
function RecipeSubstDialog({
  open,
  ingredientName,
  recipe,
  onAddIngredient,
  onAddRecipeIngredients,
  onClose,
}: {
  open: boolean;
  ingredientName: string;
  recipe: RecipeWithDetails;
  onAddIngredient: () => void;
  onAddRecipeIngredients: () => void;
  onClose: () => void;
}) {
  const missingInRecipe = recipe.ingredients.filter((i) => !i.available);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{ingredientName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Der findes en opskrift på {ingredientName}. Vil du tilfoeje selve ingrediensen eller
          ingredienserne til at lave den?
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
          <p className="text-sm text-muted-foreground italic">
            Alle ingredienser til opskriften er allerede pa lager.
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={onAddIngredient}>
            Tilfoej {ingredientName}
          </Button>
          <Button
            className="flex-1"
            onClick={onAddRecipeIngredients}
            disabled={missingInRecipe.length === 0}
          >
            Tilfoej opskriftens ingredienser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IndkoebslistePage() {
  const qc = useQueryClient();
  const { session } = useSession();
  const fetchShoppingList = useServerFn(getShoppingList);
  const fetchRecipes = useServerFn(listRecipes);
  const addOne = useServerFn(addToShoppingList);
  const addMany = useServerFn(addManyToShoppingList);
  const removeAndMark = useServerFn(removeFromShoppingList);
  const removeOnly = useServerFn(removeFromShoppingListOnly);

  const { data: shoppingListData, isLoading } = useQuery({
    queryKey: ["shopping-list"],
    queryFn: () => fetchShoppingList(),
  });

  const { data: recipes } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => fetchRecipes(),
  });

  // Map: ingrediensnavn (lowercase) → opskrift
  const recipeByIngredientName = useMemo(() => {
    const map = new Map<string, RecipeWithDetails>();
    for (const r of (recipes ?? []) as RecipeWithDetails[]) {
      map.set(r.name.toLowerCase(), r);
    }
    return map;
  }, [recipes]);

  const removeMarkM = useMutation({
    mutationFn: (id: string) => removeAndMark({ data: { ingredientId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shopping-list"] });
      qc.invalidateQueries({ queryKey: ["ingredients"] });
      qc.invalidateQueries({ queryKey: ["cocktails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeOnlyM = useMutation({
    mutationFn: (id: string) => removeOnly({ data: { ingredientId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addOneM = useMutation({
    mutationFn: (id: string) => addOne({ data: { ingredientId: id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addManyM = useMutation({
    mutationFn: (ids: string[]) => addMany({ data: { ingredientIds: ids } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping-list"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Dialog-state: hvilken ingrediens/opskrift spørges om
  const [pendingDialog, setPendingDialog] = useState<{
    ingredientId: string;
    ingredientName: string;
    recipe: RecipeWithDetails;
  } | null>(null);

  // Gruppér efter kategori
  const grouped = useMemo(() => {
    const items = shoppingListData ?? [];
    const map = new Map<string, typeof items>();
    for (const row of items) {
      const cat = row.ingredients?.category ?? "Andet";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(row);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "da"));
  }, [shoppingListData]);

  const total = (shoppingListData ?? []).length;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl">Indkoebsliste</h1>
            {total > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">{total} {total === 1 ? "vare" : "varer"}</p>
            )}
          </div>
          <ShoppingCart className="h-6 w-6 text-muted-foreground" />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Indlaesser...</p>
        ) : grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            Indkoebslisten er tom. Tilfoj ingredienser fra Ingredienser- eller Cocktails-siden.
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([cat, rows]) => (
              <section key={cat}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
                  {cat}
                </h2>
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {rows.map((row) => (
                    <li key={row.ingredient_id} className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        disabled={removeMarkM.isPending || !session}
                        onClick={() => session && removeMarkM.mutate(row.ingredient_id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:bg-primary/10 hover:text-primary disabled:opacity-40"
                        title="Marker som kobt og tilfoej til lager"
                        aria-label="Marker som kobt"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <span className="flex-1 text-sm">{row.ingredients?.name}</span>
                      <button
                        type="button"
                        disabled={removeOnlyM.isPending || !session}
                        onClick={() => session && removeOnlyM.mutate(row.ingredient_id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:text-destructive disabled:opacity-40"
                        title="Fjern fra liste"
                        aria-label="Fjern fra liste"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {session && (
              <p className="text-xs text-muted-foreground">
                Flueben markerer som købt og tilføjer til lageret. Kryds fjerner fra listen.
              </p>
            )}
          </div>
        )}
      </main>

      {/* Dialog: sporg om ingrediens eller opskrift */}
      {pendingDialog && (
        <RecipeSubstDialog
          open={!!pendingDialog}
          ingredientName={pendingDialog.ingredientName}
          recipe={pendingDialog.recipe}
          onClose={() => setPendingDialog(null)}
          onAddIngredient={() => {
            addOneM.mutate(pendingDialog.ingredientId);
            setPendingDialog(null);
          }}
          onAddRecipeIngredients={() => {
            const missing = pendingDialog.recipe.ingredients
              .filter((i) => !i.available)
              .map((i) => i.ingredient_id);
            if (missing.length > 0) addManyM.mutate(missing);
            setPendingDialog(null);
          }}
        />
      )}
    </div>
  );
}

// Eksporter hjælpefunktion til brug i ShoppingListButton og ingredienser/cocktails
export function resolveShoppingListAdd({
  ingredientId,
  ingredientName,
  recipeByIngredientName,
  onDirect,
  onAskRecipe,
}: {
  ingredientId: string;
  ingredientName: string;
  recipeByIngredientName: Map<string, RecipeWithDetails>;
  onDirect: (id: string) => void;
  onAskRecipe: (ingredientId: string, ingredientName: string, recipe: RecipeWithDetails) => void;
}) {
  const recipe = recipeByIngredientName.get(ingredientName.toLowerCase());
  if (recipe) {
    onAskRecipe(ingredientId, ingredientName, recipe);
  } else {
    onDirect(ingredientId);
  }
}
