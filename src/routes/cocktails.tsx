import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import { CocktailCard } from "@/components/app/cocktail-card";
import { TagFilter } from "@/components/app/tag-filter";
import { Input } from "@/components/ui/input";
import { listCocktails, type CocktailWithDetails } from "@/lib/cocktails.functions";
import { z } from "zod";

const searchSchema = z.object({
  tab: z.enum(["klar", "naesten", "alle"]).catch("klar"),
});

export const Route = createFileRoute("/cocktails")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Cocktails — Barskab" },
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
  const { data, isLoading } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });

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
                <CocktailCard key={c.id} cocktail={c} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
