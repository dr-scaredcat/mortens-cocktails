import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, GlassWater, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GuestHeader } from "@/components/app/guest-header";
import { CardImage } from "@/components/app/card-image";
import {
  listGlassTypes,
  listGrapeGlassMapping,
  type GrapeGlassMapping,
} from "@/lib/vinglas.functions";

export const Route = createFileRoute("/vinglas")({
  head: () => ({
    meta: [
      { title: "Vinglas — Aston's Bar" },
      { name: "description", content: "Find det rigtige glas til din vin." },
    ],
  }),
  loader: async ({ context }) => {
    const [glassTypes, mapping] = await Promise.all([
      context.queryClient.ensureQueryData({ queryKey: ["glass-types"], queryFn: () => listGlassTypes() }),
      context.queryClient.ensureQueryData({ queryKey: ["grape-glass-mapping"], queryFn: () => listGrapeGlassMapping() }),
    ]);
    return { glassTypes, mapping };
  },
  component: VinglasPage,
});

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// ── Resultatkort ─────────────────────────────────────────────────────────
function ResultRow({ item }: { item: GrapeGlassMapping }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-muted">
        {item.glass?.image_url ? (
          <CardImage src={item.glass.image_url} alt={item.glass.name} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <GlassWater className="h-7 w-7 opacity-30" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{item.wine_name}</p>
        <p className="font-serif text-lg leading-tight">{item.glass?.name ?? "Ukendt glas"}</p>
        {typeof item.glass?.quantity_owned === "number" && (
          <p className="text-xs text-muted-foreground">{item.glass.quantity_owned} i samlingen</p>
        )}
      </div>
    </Card>
  );
}

// ── Sidens hoved-komponent ──────────────────────────────────────────────────
function VinglasPage() {
  const { mapping: initialMapping } = Route.useLoaderData();

  const fetchMapping = useServerFn(listGrapeGlassMapping);
  const { data: mappingData } = useQuery({
    queryKey: ["grape-glass-mapping"],
    queryFn: () => fetchMapping(),
    initialData: initialMapping,
    staleTime: 1000 * 60 * 5,
  });

  const mapping = (mappingData ?? []) as GrapeGlassMapping[];
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const s = normalize(q);
    if (!s) return [];
    const starts: GrapeGlassMapping[] = [];
    const contains: GrapeGlassMapping[] = [];
    for (const m of mapping) {
      const name = normalize(m.wine_name);
      if (name.startsWith(s)) starts.push(m);
      else if (name.includes(s)) contains.push(m);
    }
    const byName = (a: GrapeGlassMapping, b: GrapeGlassMapping) =>
      a.wine_name.localeCompare(b.wine_name, "da");
    return [...starts.sort(byName), ...contains.sort(byName)].slice(0, 30);
  }, [mapping, q]);

  return (
    <div className="min-h-screen bg-background">
      <GuestHeader active="vine" />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Link
          to="/vine"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Tilbage til vine
        </Link>

        <div className="mb-5 space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Find dit vinglas</h1>
          <p className="text-sm text-muted-foreground">
            Skriv en drue eller et vinnavn — fx "Rioja" eller "Sauvignon Blanc".
          </p>
        </div>

        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søg efter drue eller vin..."
            className="pl-9"
            autoFocus
          />
        </div>

        {q.trim() === "" ? (
          <p className="text-sm text-muted-foreground">Begynd at skrive for at se forslag.</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen match. Prøv en anden stavning eller druesort.</p>
        ) : (
          <div className="space-y-3">
            {results.map((item) => (
              <ResultRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
