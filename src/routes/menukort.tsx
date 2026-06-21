import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wine } from "lucide-react";
import { CocktailCard } from "@/components/app/cocktail-card";
import { TagFilter } from "@/components/app/tag-filter";
import { Input } from "@/components/ui/input";
import { listCocktails, type CocktailWithDetails } from "@/lib/cocktails.functions";
import { OrderButton } from "@/components/app/order-button";
import { getOrderingEnabled } from "@/lib/orders.functions";

export const Route = createFileRoute("/menukort")({
  head: () => ({
    meta: [
      { title: "Cocktail menu — Barskab" },
      { name: "description", content: "Cocktails du kan lave lige nu." },
    ],
  }),
  component: MenukortPage,
});

function MenukortPage() {
  const fetchCocktails = useServerFn(listCocktails);
  const { data, isLoading } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });
  const fetchOrdering = useServerFn(getOrderingEnabled);
  const { data: orderingData } = useQuery({
    queryKey: ["ordering-enabled"],
    queryFn: () => fetchOrdering(),
    refetchInterval: 30_000,
  });
  const orderingEnabled = !!orderingData?.enabled;

  const [tags, setTags] = useState<string[]>([]);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const list = (data ?? []) as CocktailWithDetails[];
    let f = list.filter((c) => c.missing.length === 0);
    if (tags.length > 0) f = f.filter((c) => tags.every((t) => c.tags.includes(t)));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      f = f.filter(
        (c) =>
          c.name.toLowerCase().includes(s) ||
          c.ingredients.some((i) => i.name.toLowerCase().includes(s)),
      );
    }
    return [...f].sort((a, b) => a.name.localeCompare(b.name));
  }, [data, tags, q]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 font-serif text-lg tracking-tight">
          <Wine className="h-5 w-5 text-primary" />
          <span>Cocktail menu</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Cocktail menu</h1>
          <p className="text-sm text-muted-foreground">
            Vælg en cocktail og tryk Bestil — bartenderen får besked.
          </p>
        </div>
        <div className="mb-5 space-y-3">
          <Input
            placeholder="Søg efter cocktail..."
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
            Ingen cocktails kan laves lige nu.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <div key={c.id} className="flex flex-col gap-2">
                <CocktailCard cocktail={c} />
                {orderingEnabled && (
                  <OrderButton cocktailId={c.id} cocktailName={c.name} />
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}