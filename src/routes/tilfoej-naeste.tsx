import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listCocktails, type CocktailWithDetails } from "@/lib/cocktails.functions";

export const Route = createFileRoute("/tilfoej-naeste")({
  head: () => ({
    meta: [
      { title: "Tilføj næste — Barskab" },
      {
        name: "description",
        content: "Se hvilke ingredienser der åbner op for flest cocktails.",
      },
    ],
  }),
  component: TilfoejNaestePage,
});

type Mode = "ready" | "uses";

function TilfoejNaestePage() {
  const fetchCocktails = useServerFn(listCocktails);
  const { data, isLoading } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });

  const [mode, setMode] = useState<Mode>("ready");
  const [openName, setOpenName] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = (data ?? []) as CocktailWithDetails[];
    // Map from missing ingredient name -> cocktail names
    const map = new Map<string, string[]>();
    for (const c of list) {
      if (mode === "ready") {
        if (c.missing.length === 1) {
          const ing = c.missing[0];
          const arr = map.get(ing) ?? [];
          arr.push(c.name);
          map.set(ing, arr);
        }
      } else {
        // Cocktails der bruger ingrediensen og hvor den endnu ikke er tilgængelig
        for (const i of c.ingredients) {
          if (!i.available) {
            const arr = map.get(i.name) ?? [];
            arr.push(c.name);
            map.set(i.name, arr);
          }
        }
      }
    }
    return Array.from(map.entries())
      .map(([name, cocktails]) => ({
        name,
        cocktails: [...cocktails].sort((a, b) => a.localeCompare(b)),
      }))
      .sort(
        (a, b) =>
          b.cocktails.length - a.cocktails.length || a.name.localeCompare(b.name),
      );
  }, [data, mode]);

  const openRow = rows.find((r) => r.name === openName) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5 space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Tilføj næste</h1>
          <p className="text-sm text-muted-foreground">
            Ingredienser rangeret efter hvor mange cocktails de åbner op for.
          </p>
        </div>

        <div className="mb-5 inline-flex rounded-full border border-border bg-card p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("ready")}
            className={`rounded-full px-3 py-1 transition ${
              mode === "ready"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bliver klar
          </button>
          <button
            type="button"
            onClick={() => setMode("uses")}
            className={`rounded-full px-3 py-1 transition ${
              mode === "uses"
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Bruger ingrediensen
          </button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
            {mode === "ready"
              ? "Ingen ingredienser ville gøre en cocktail klar."
              : "Ingen manglende ingredienser at vise."}
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {rows.map((r) => (
              <li key={r.name}>
                <button
                  type="button"
                  onClick={() => setOpenName(r.name)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/40"
                >
                  <span className="font-medium">{r.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {r.cocktails.length}{" "}
                    {r.cocktails.length === 1 ? "cocktail" : "cocktails"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <Dialog open={!!openName} onOpenChange={(o) => !o && setOpenName(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{openRow?.name}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {mode === "ready"
                ? "Disse cocktails bliver klar hvis du tilføjer ingrediensen:"
                : "Disse cocktails bruger ingrediensen:"}
            </p>
            <ul className="mt-2 space-y-1">
              {openRow?.cocktails.map((name) => (
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