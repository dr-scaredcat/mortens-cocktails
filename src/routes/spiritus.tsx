import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shuffle, ArrowDownAZ, Star } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GuestHeader } from "@/components/app/guest-header";
import { SpiritCard } from "@/components/app/spirit-card";
import { SpiritRatingStars } from "@/components/app/spirit-rating-stars";
import { OrderButton } from "@/components/app/order-button";
import { listSpirits, listSpiritTypes, type SpiritWithDetails } from "@/lib/spirits.functions";
import { getPopularSpirits, type PopularBadge } from "@/lib/stats.functions";
import { getOrderingEnabled } from "@/lib/orders.functions";
import { thumbUrl } from "@/lib/image-utils";
import { CardImage } from "@/components/app/card-image";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/spiritus")({
  head: () => ({
    meta: [
      { title: "Spiritus — Aston's Bar" },
      { name: "description", content: "Vores udvalg af spiritus." },
    ],
  }),
  // SSR-prefetch: hent spiritus på serveren og læg dem i query-cachen. Returværdien
  // serialiseres af routeren og bruges som initialData → ingen "Indlæser..."-blink.
  loader: async ({ context }) => {
    const spirits = await context.queryClient.ensureQueryData({
      queryKey: ["spirits"],
      queryFn: () => listSpirits(),
    });
    return { spirits };
  },
  component: SpiritusPage,
});

type SortMode = "alpha" | "popularity";

const OTHER_LABEL = "Øvrige";

function PopularityBadge({ badge }: { badge: PopularBadge }) {
  if (badge === "bestseller") {
    return (
      <Badge className="gap-1 bg-primary text-primary-foreground shadow hover:bg-primary">
        <Star className="h-3 w-3 fill-current" />
        Bestseller
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-background/90 text-foreground shadow hover:bg-background/90">
      <Star className="h-3 w-3 fill-current" />
      Populær
    </Badge>
  );
}

// ── Kort til gitteret ───────────────────────────────────────────────────────
function MenukortSpiritCard({
  spirit,
  onOpen,
  orderingEnabled,
  badge,
}: {
  spirit: SpiritWithDetails;
  onOpen: () => void;
  orderingEnabled: boolean;
  badge?: PopularBadge;
}) {
  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/70 bg-card cursor-pointer transition hover:border-primary/50">
      <div className="flex flex-1 flex-col" onClick={onOpen}>
        <div className="relative aspect-[4/3] w-full shrink-0 bg-muted">
          {badge && (
            <div className="absolute left-2 top-2 z-10">
              <PopularityBadge badge={badge} />
            </div>
          )}
          {spirit.image_url ? (
            <CardImage
              src={thumbUrl(spirit.image_url, 480) ?? spirit.image_url}
              alt={spirit.name}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1">
              <img
                src="/placeholder-spiritus.png"
                alt="Billede mangler"
                className="h-2/3 w-auto object-contain opacity-100"
              />
              <span className="text-xs text-muted-foreground">Billede er på vej...</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-serif text-xl leading-tight">{spirit.name}</h3>
            {spirit.spirit_type && (
              <Badge variant="outline" className="shrink-0 text-xs">
                {spirit.spirit_type}
              </Badge>
            )}
          </div>
          {/* Stjerner — stop klik fra at åbne dialogen */}
          <div onClick={(e) => e.stopPropagation()}>
            <SpiritRatingStars
              spiritId={spirit.id}
              avg={spirit.avg_rating}
              count={spirit.rating_count}
            />
          </div>
          {spirit.description && (
            <p className="line-clamp-3 text-sm text-muted-foreground">{spirit.description}</p>
          )}
        </div>
      </div>

      {orderingEnabled && (
        <div className="mt-auto px-4 pb-4" onClick={(e) => e.stopPropagation()}>
          <OrderButton kind="spirit" spiritId={spirit.id} cocktailName={spirit.name} />
        </div>
      )}
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function SpiritusPage() {
  const { spirits: initialSpirits } = Route.useLoaderData();

  const fetchSpirits = useServerFn(listSpirits);
  const { data, isLoading } = useQuery({
    queryKey: ["spirits"],
    queryFn: () => fetchSpirits(),
    // Fra SSR-loaderen — undgår "Indlæser..." ved første render.
    initialData: initialSpirits,
  });

  const fetchTypes = useServerFn(listSpiritTypes);
  const { data: typeRows } = useQuery({
    queryKey: ["spirit-types"],
    queryFn: () => fetchTypes(),
  });

  const fetchOrdering = useServerFn(getOrderingEnabled);
  const { data: orderingData } = useQuery({
    queryKey: ["ordering-enabled"],
    queryFn: () => fetchOrdering(),
    refetchInterval: 30_000,
    // Skal altid være frisk — overstyrer det globale staleTime på 60 s.
    staleTime: 0,
  });
  const orderingEnabled = !!orderingData?.enabled;

  const fetchPopular = useServerFn(getPopularSpirits);
  const { data: popular } = useQuery({
    queryKey: ["popular-spirits"],
    queryFn: () => fetchPopular(),
    staleTime: 1000 * 60,
  });
  const badgeById = useMemo(() => {
    const m = new Map<string, PopularBadge>();
    for (const p of popular ?? []) m.set(p.spirit_id, p.badge);
    return m;
  }, [popular]);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("alpha");

  const orderedTypeNames = useMemo(() => (typeRows ?? []).map((t) => t.name), [typeRows]);

  // Kun tilgængelige spiritus vises.
  const available = useMemo(
    () => ((data ?? []) as SpiritWithDetails[]).filter((s) => s.available),
    [data],
  );

  // Spiritus der matcher søgningen (uden type-filter) — bruges til chip-tællinger.
  const searchPool = useMemo(() => {
    if (!q.trim()) return available;
    const s = q.trim().toLowerCase();
    return available.filter(
      (x) =>
        x.name.toLowerCase().includes(s) ||
        (x.spirit_type ?? "").toLowerCase().includes(s) ||
        (x.description ?? "").toLowerCase().includes(s),
    );
  }, [available, q]);

  const countByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of searchPool) {
      const key = s.spirit_type && orderedTypeNames.includes(s.spirit_type) ? s.spirit_type : OTHER_LABEL;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [searchPool, orderedTypeNames]);

  // Endeligt match: søgning + valgte typer.
  const matched = useMemo(() => {
    if (selectedTypes.length === 0) return searchPool;
    return searchPool.filter((s) => {
      const key = s.spirit_type && orderedTypeNames.includes(s.spirit_type) ? s.spirit_type : OTHER_LABEL;
      return selectedTypes.includes(key);
    });
  }, [searchPool, selectedTypes, orderedTypeNames]);

  function toggleType(t: string) {
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const byName = (a: SpiritWithDetails, b: SpiritWithDetails) =>
    a.name.localeCompare(b.name, "da");

  // Alfabetisk = grupperet efter type (i admin-rækkefølge), alfabetisk indenfor.
  const groups = useMemo(() => {
    const result: { type: string; items: SpiritWithDetails[] }[] = [];
    const showTypes =
      selectedTypes.length > 0
        ? orderedTypeNames.filter((n) => selectedTypes.includes(n))
        : orderedTypeNames;
    for (const tn of showTypes) {
      const items = matched.filter((s) => s.spirit_type === tn).sort(byName);
      if (items.length) result.push({ type: tn, items });
    }
    // Øvrige (ukendt/ingen type)
    const showOther = selectedTypes.length === 0 || selectedTypes.includes(OTHER_LABEL);
    if (showOther) {
      const others = matched
        .filter((s) => !s.spirit_type || !orderedTypeNames.includes(s.spirit_type))
        .sort(byName);
      if (others.length) result.push({ type: OTHER_LABEL, items: others });
    }
    return result;
  }, [matched, selectedTypes, orderedTypeNames]);

  // Popularitet = flad liste sorteret efter rating.
  const flatByRating = useMemo(
    () => [...matched].sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1)),
    [matched],
  );

  const openSpirit = ((data ?? []) as SpiritWithDetails[]).find((s) => s.id === openId) ?? null;

  // Chip-typer der faktisk har match (eller er valgt).
  const chipTypes = orderedTypeNames.filter(
    (n) => (countByType.get(n) ?? 0) > 0 || selectedTypes.includes(n),
  );
  const otherCount = countByType.get(OTHER_LABEL) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <GuestHeader active="spiritus" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Spiritus</h1>
          {orderingEnabled && (
            <p className="text-sm text-muted-foreground">
              Vælg en spiritus og tryk Bestil — bartenderen får besked.
            </p>
          )}
        </div>

        <Button
          variant="outline"
          className="mb-5 w-full"
          onClick={() => {
            if (matched.length === 0) return;
            const random = matched[Math.floor(Math.random() * matched.length)];
            setOpenId(random.id);
          }}
        >
          <Shuffle className="h-4 w-4" />
          Overrask mig
        </Button>

        <div className="mb-5 space-y-3">
          <Input
            placeholder="Søg efter navn, type eller beskrivelse..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {/* Type-filter (multi-select) — Alle øverst, derefter typer i admin-rækkefølge */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setSelectedTypes([])}>
              <Badge
                variant={selectedTypes.length === 0 ? "default" : "outline"}
                className={selectedTypes.length === 0 ? "bg-primary text-primary-foreground" : ""}
              >
                Alle
              </Badge>
            </button>
            {chipTypes.map((tn) => {
              const active = selectedTypes.includes(tn);
              return (
                <button key={tn} type="button" onClick={() => toggleType(tn)}>
                  <Badge
                    variant={active ? "default" : "outline"}
                    className={active ? "bg-primary text-primary-foreground" : ""}
                  >
                    {tn}{" "}
                    <span className={active ? "opacity-75" : "text-muted-foreground"}>
                      ({countByType.get(tn) ?? 0})
                    </span>
                  </Badge>
                </button>
              );
            })}
            {otherCount > 0 && (
              <button type="button" onClick={() => toggleType(OTHER_LABEL)}>
                <Badge
                  variant={selectedTypes.includes(OTHER_LABEL) ? "default" : "outline"}
                  className={
                    selectedTypes.includes(OTHER_LABEL) ? "bg-primary text-primary-foreground" : ""
                  }
                >
                  {OTHER_LABEL}{" "}
                  <span className={selectedTypes.includes(OTHER_LABEL) ? "opacity-75" : "text-muted-foreground"}>
                    ({otherCount})
                  </span>
                </Badge>
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortMode("alpha")}
              className={cn(sortMode === "alpha" && "border-primary/60 bg-primary/10 text-primary")}
            >
              <ArrowDownAZ className="mr-1 h-4 w-4" />
              Alfabetisk
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortMode("popularity")}
              className={cn(
                sortMode === "popularity" && "border-primary/60 bg-primary/10 text-primary",
              )}
            >
              <Star className="mr-1 h-4 w-4" />
              Populært
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : available.length === 0 ? (
          <p className="text-muted-foreground">Der er ingen tilgængelig spiritus lige nu.</p>
        ) : matched.length === 0 ? (
          <p className="text-muted-foreground">Ingen spiritus matcher din søgning.</p>
        ) : sortMode === "popularity" ? (
          <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {flatByRating.map((s) => (
              <MenukortSpiritCard
                key={s.id}
                spirit={s}
                onOpen={() => setOpenId(s.id)}
                orderingEnabled={orderingEnabled}
                badge={badgeById.get(s.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.type}>
                <h2 className="mb-3 font-serif text-xl text-primary">{g.type}</h2>
                <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.items.map((s) => (
                    <MenukortSpiritCard
                      key={s.id}
                      spirit={s}
                      onOpen={() => setOpenId(s.id)}
                      orderingEnabled={orderingEnabled}
                      badge={badgeById.get(s.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Detalje-dialog */}
        <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
          <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
              className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border-0 bg-transparent p-0 shadow-none outline-none sm:max-w-md"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {openSpirit && (
                <>
                  <DialogPrimitive.Title className="sr-only">
                    {openSpirit.name}
                  </DialogPrimitive.Title>
                  <div
                    className="max-h-[90vh] overflow-y-auto rounded-lg px-4"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("[data-order-button]")) return;
                      setOpenId(null);
                    }}
                  >
                    <SpiritCard
                      spirit={openSpirit}
                      footerSlot={
                        orderingEnabled ? (
                          <div data-order-button onClick={(e) => e.stopPropagation()}>
                            <OrderButton
                              kind="spirit"
                              spiritId={openSpirit.id}
                              cocktailName={openSpirit.name}
                            />
                          </div>
                        ) : undefined
                      }
                    />
                  </div>
                </>
              )}
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      </main>
    </div>
  );
}
