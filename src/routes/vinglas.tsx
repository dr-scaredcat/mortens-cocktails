import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, GlassWater, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { GuestHeader } from "@/components/app/guest-header";
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

// ── Stort resultatkort — billedet er det vigtigste, så gæsten kan
// sammenligne direkte med glassene i skabet (ingen mærkater på glassene) ──
function ResultCard({ item }: { item: GrapeGlassMapping }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex aspect-square w-full items-center justify-center bg-muted p-4 sm:aspect-[4/3]">
        {item.glass?.image_url ? (
          // Bevidst almindeligt <img> med object-contain (ikke CardImage,
          // som beskærer til udfyldning) — hele glassets facon skal være synlig.
          <img
            src={item.glass.image_url}
            alt={item.glass.name}
            className="h-full w-full object-contain"
          />
        ) : (
          <GlassWater className="h-20 w-20 text-muted-foreground opacity-25" />
        )}
      </div>
      <div className="p-4 text-center">
        <p className="text-sm text-muted-foreground">{item.wine_name}</p>
        <p className="font-serif text-2xl leading-tight">{item.glass?.name ?? "Ukendt glas"}</p>
        {typeof item.glass?.quantity_owned === "number" && (
          <p className="mt-1 text-xs text-muted-foreground">{item.glass.quantity_owned} i samlingen</p>
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
  const [selectedId, setSelectedId] = useState<string>("");

  const sortedOptions = useMemo(
    () => [...mapping].sort((a, b) => a.wine_name.localeCompare(b.wine_name, "da")),
    [mapping],
  );

  const selectedItem = useMemo(
    () => mapping.find((m) => m.id === selectedId) ?? null,
    [mapping, selectedId],
  );

  const searchResults = useMemo(() => {
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
    return [...starts.sort(byName), ...contains.sort(byName)].slice(0, 20);
  }, [mapping, q]);

  function onSearchChange(value: string) {
    setQ(value);
    if (value.trim()) setSelectedId("");
  }

  function onDropdownChange(id: string) {
    setSelectedId(id);
    setQ("");
  }

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
            Søg efter en drue eller et vinnavn, eller vælg fra listen — og sammenlign billedet med glassene i skabet.
          </p>
        </div>

        <div className="mb-4 space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Søg efter drue eller vin..."
              className="pl-9"
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
              ...eller vælg fra listen
            </Label>
            <Select value={selectedId} onValueChange={onDropdownChange}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg en drue eller vin..." />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {sortedOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.wine_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedItem ? (
          <ResultCard item={selectedItem} />
        ) : q.trim() === "" ? (
          <p className="text-sm text-muted-foreground">Begynd at skrive eller vælg fra listen for at se forslag.</p>
        ) : searchResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ingen match. Prøv en anden stavning eller druesort.</p>
        ) : (
          <div className="space-y-4">
            {searchResults.map((item) => (
              <ResultCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
