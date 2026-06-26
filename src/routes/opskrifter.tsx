import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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

function fmt(amount: number | null, unit: string | null): string {
  if (!amount) return "";
  const u = unit ?? "";
  return `${amount % 1 === 0 ? amount.toFixed(0) : amount} ${u}`.trim();
}

function ImageCarousel({ images }: { images: { id: string; url: string }[] }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) return null;

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
      <img
        src={images[idx].url}
        alt=""
        className="h-full w-full object-cover transition-opacity duration-300"
      />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/70 p-1 text-foreground hover:bg-background/90"
            aria-label="Forrige billede"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); }}
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
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${i === idx ? "bg-foreground" : "bg-foreground/30"}`}
                aria-label={`Billede ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: RecipeWithDetails }) {
  const [expanded, setExpanded] = useState(false);
  const missing = recipe.missing.length;

  return (
    <Card className="flex flex-col overflow-hidden">
      <ImageCarousel images={recipe.images} />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h2 className="font-serif text-xl leading-tight">{recipe.name}</h2>
          {missing > 0 && (
            <p className="mt-0.5 text-xs text-accent">
              Mangler: {recipe.missing.join(", ")}
            </p>
          )}
          {recipe.description && (
            <p className="mt-1 text-sm text-muted-foreground">{recipe.description}</p>
          )}
        </div>

        {recipe.ingredients.length > 0 && (
          <ul className="space-y-1 text-sm">
            {recipe.ingredients.map((i) => (
              <li
                key={i.ingredient_id}
                className={
                  i.available
                    ? "flex justify-between text-foreground/90"
                    : "flex justify-between text-muted-foreground line-through"
                }
              >
                <span>{i.name}</span>
                <span className="tabular-nums">{fmt(i.amount, i.unit)}</span>
              </li>
            ))}
          </ul>
        )}

        {recipe.instructions && (
          <>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-left text-sm font-medium text-primary hover:underline"
            >
              {expanded ? "Skjul fremgangsmåde" : "Vis fremgangsmåde"}
            </button>
            {expanded && (
              <p className="whitespace-pre-line border-t border-border pt-3 text-sm text-foreground/80">
                {recipe.instructions}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

function OpskrifterPage() {
  const fetchRecipes = useServerFn(listRecipes);
  const { data, isLoading } = useQuery({
    queryKey: ["recipes"],
    queryFn: () => fetchRecipes(),
  });

  const [q, setQ] = useState("");

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
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
