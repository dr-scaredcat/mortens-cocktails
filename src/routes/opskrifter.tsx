import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { SiteHeader } from "@/components/app/site-header";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { listRecipes, type RecipeWithDetails } from "@/lib/cocktails.functions";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/opskrifter")({
  head: () => ({
    meta: [
      { title: "Opskrifter — Barskab" },
      { name: "description", content: "Opskrifter på siruper, mixere og andet til barskabet." },
    ],
  }),
  component: OpskrifterPage,
});

function fmtAmount(amount: number | null, unit: string | null, multiplier: number): string {
  if (!amount) return "";
  const scaled = amount * multiplier;
  const display = scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1).replace(/\.0$/, "");
  return `${display}${unit ? " " + unit : ""}`.trim();
}

function ImageCarousel({
  images,
  className,
}: {
  images: { id: string; url: string }[];
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;
  const safe = Math.min(idx, images.length - 1);

  return (
    <div className={`relative overflow-hidden bg-muted ${className ?? ""}`}>
      <img
        src={images[safe].url}
        alt=""
        className="h-full w-full object-cover transition-opacity duration-200"
      />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i - 1 + images.length) % images.length);
            }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1 text-foreground hover:bg-background/90"
            aria-label="Forrige billede"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIdx((i) => (i + 1) % images.length);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1 text-foreground hover:bg-background/90"
            aria-label="Næste billede"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIdx(i);
                }}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === safe ? "bg-foreground" : "bg-foreground/30"
                }`}
                aria-label={`Billede ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Compact card shown in the grid ──────────────────────────────────────────
function RecipeCard({
  recipe,
  onClick,
}: {
  recipe: RecipeWithDetails;
  onClick: () => void;
}) {
  return (
    <Card
      className="flex cursor-pointer flex-col overflow-hidden transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      {recipe.images.length > 0 && (
        <ImageCarousel images={recipe.images} className="aspect-[4/3] w-full" />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="font-serif text-xl leading-tight">{recipe.name}</h2>
        {recipe.missing.length > 0 && (
          <p className="text-xs text-accent">Mangler: {recipe.missing.join(", ")}</p>
        )}
        {recipe.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{recipe.description}</p>
        )}
        {recipe.ingredients.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {recipe.ingredients.map((i) => i.name).join(", ")}
          </p>
        )}
      </div>
    </Card>
  );
}

// ── Detail modal ─────────────────────────────────────────────────────────────
function RecipeDetailModal({
  recipe,
}: {
  recipe: RecipeWithDetails;
}) {
  const [multiplier, setMultiplier] = useState(1);

  return (
    <Card className="overflow-hidden" onClick={(e) => e.stopPropagation()}>
      {recipe.images.length > 0 && (
        <ImageCarousel images={recipe.images} className="aspect-[4/3] w-full" />
      )}
      <div className="flex flex-col gap-4 p-5">
        {/* Navn + missing */}
        <div>
          <h2 className="font-serif text-2xl leading-tight">{recipe.name}</h2>
          {recipe.missing.length > 0 && (
            <p className="mt-1 text-sm text-accent">Mangler: {recipe.missing.join(", ")}</p>
          )}
          {recipe.description && (
            <p className="mt-1 text-sm text-muted-foreground">{recipe.description}</p>
          )}
        </div>

        {/* Ingredienser + portionsvælger */}
        {recipe.ingredients.length > 0 && (
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-sm font-medium">Størrelse</span>
              <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
                {[1, 2, 3, 4, 5].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMultiplier(m)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      multiplier === m
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    ×{m}
                  </button>
                ))}
              </div>
            </div>

            <ul className="space-y-1.5">
              {recipe.ingredients.map((i) => (
                <li
                  key={i.ingredient_id}
                  className={
                    i.available
                      ? "flex justify-between text-sm text-foreground/90"
                      : "flex justify-between text-sm text-muted-foreground line-through"
                  }
                >
                  <span>{i.name}</span>
                  <span className="tabular-nums">{fmtAmount(i.amount, i.unit, multiplier)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fremgangsmåde */}
        {recipe.instructions && (
          <div className="border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold">Fremgangsmåde</h3>
            <p className="whitespace-pre-line text-sm text-foreground/80">{recipe.instructions}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function OpskrifterPage() {
  const fetchRecipes = useServerFn(listRecipes);
  const { data, isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => fetchRecipes(),
  });

  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = (data ?? []) as RecipeWithDetails[];
    if (!q.trim()) return list;
    const s = q.trim().toLowerCase();
    return list.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(s)),
    );
  }, [data, q]);

  const openRecipe = (data ?? []).find((r) => r.id === openId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Opskrifter</h1>
          <p className="text-sm text-muted-foreground">
            Opskrifter på siruper, mixere og andet til barskabet.
          </p>
        </div>

        <div className="mb-5">
          <Input
            placeholder="Søg efter navn eller ingrediens..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            {q ? "Ingen opskrifter matcher søgningen." : "Ingen opskrifter endnu."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <RecipeCard key={r.id} recipe={r} onClick={() => setOpenId(r.id)} />
            ))}
          </div>
        )}
      </main>

      {/* Detail modal — samme stil som menukort */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border-0 bg-transparent p-0 shadow-none outline-none sm:max-w-md"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogPrimitive.Title className="sr-only">
              {openRecipe?.name ?? "Opskrift"}
            </DialogPrimitive.Title>
            <div
              className="max-h-[90vh] overflow-y-auto rounded-lg px-4"
              onClick={() => setOpenId(null)}
            >
              {openRecipe && <RecipeDetailModal recipe={openRecipe} />}
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
