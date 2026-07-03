import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shuffle, ArrowDownAZ, Star, Share2, Check } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { GuestHeader } from "@/components/app/guest-header";
import { CocktailCard } from "@/components/app/cocktail-card";
import { RatingStars } from "@/components/app/rating-stars";
import { TagFilter } from "@/components/app/tag-filter";
import { Input } from "@/components/ui/input";
import { listCocktails, type CocktailWithDetails } from "@/lib/cocktails.functions";
import { OrderButton } from "@/components/app/order-button";
import { getPopularCocktails, type PopularBadge } from "@/lib/stats.functions";
import { getOrderingEnabled } from "@/lib/orders.functions";
import { thumbUrl } from "@/lib/image-utils";
import { CardImage } from "@/components/app/card-image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/menukort")({
  head: () => ({
    meta: [
      { title: "Menukort — Aston's Bar" },
      { name: "description", content: "Cocktails du kan lave lige nu." },
    ],
  }),
  // SSR-prefetch: hent cocktails på serveren og læg dem i query-cachen, så det
  // fulde svar allerede indeholder dataen. Returværdien serialiseres af routeren
  // og bruges som initialData i komponenten → ingen "Indlæser..."-blink og ingen
  // hydration-mismatch (uden behov for ekstra afhængigheder).
  loader: async ({ context }) => {
    const cocktails = await context.queryClient.ensureQueryData({
      queryKey: ["cocktails"],
      queryFn: () => listCocktails(),
    });
    return { cocktails };
  },
  component: MenukortPage,
});

type SortMode = "alpha" | "rating";

// ── Bestseller/Populær-badge ────────────────────────────────────────────────
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

// ── Simpelt kort til gitteret — ingen mængder, ingen glas/pynt/fremgangsmåde ─
function MenukortCocktailCard({
  cocktail,
  onOpen,
  orderingEnabled,
  badge,
}: {
  cocktail: CocktailWithDetails;
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
          {cocktail.image_url ? (
            <CardImage
              src={thumbUrl(cocktail.image_url, 480) ?? cocktail.image_url}
              alt={cocktail.name}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1">
              <img
                src="/placeholder-cocktail.png"
                alt="Billede mangler"
                className="h-2/3 w-auto object-contain opacity-100"
              />
              <span className="text-xs text-muted-foreground">Billede er på vej...</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-serif text-xl leading-tight">{cocktail.name}</h3>
          <div onClick={(e) => e.stopPropagation()}>
            <RatingStars
              cocktailId={cocktail.id}
              avg={cocktail.avg_rating}
              count={cocktail.rating_count}
            />
          </div>
          {cocktail.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {cocktail.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
          )}
          {cocktail.ingredients.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {cocktail.ingredients.map((i) => i.name).join(", ")}
            </p>
          )}
        </div>
      </div>

      {orderingEnabled && (
        <div className="mt-auto px-4 pb-4" onClick={(e) => e.stopPropagation()}>
          <OrderButton cocktailId={cocktail.id} cocktailName={cocktail.name} />
        </div>
      )}
    </Card>
  );
}

function ShareButton({ cocktail }: { cocktail: CocktailWithDetails }) {
  const [copied, setCopied] = useState(false);
  async function handleShare() {
    const text = `${cocktail.name}\n\n${cocktail.ingredients.map((i) => `${i.name}${i.amount ? ` – ${i.amount}${i.unit ? " " + i.unit : ""}` : ""}`).join("\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kunne ikke kopiere");
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={handleShare} data-share-button>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-primary" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      {copied ? "Kopieret!" : "Del"}
    </Button>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function MenukortPage() {
  const { cocktails: initialCocktails } = Route.useLoaderData();

  const fetchCocktails = useServerFn(listCocktails);
  const { data, isLoading } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
    // Fra SSR-loaderen — undgår "Indlæser..." ved første render.
    initialData: initialCocktails,
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

  const fetchPopular = useServerFn(getPopularCocktails);
  const { data: popular } = useQuery({
    queryKey: ["popular-cocktails"],
    queryFn: () => fetchPopular(),
    staleTime: 1000 * 60,
  });
  const badgeById = useMemo(() => {
    const m = new Map<string, PopularBadge>();
    for (const p of popular ?? []) m.set(p.cocktail_id, p.badge);
    return m;
  }, [popular]);

  const [tags, setTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("alpha");

  const filtered = useMemo(() => {
    const list = (data ?? []) as CocktailWithDetails[];
    let f = list.filter((c) => c.missing.length === 0 && c.on_menu !== false);
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
    if (sortMode === "rating") {
      return [...f].sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1));
    }
    return [...f].sort((a, b) => a.name.localeCompare(b.name, "da"));
  }, [data, tags, q, sortMode]);

  return (
    <div className="min-h-screen bg-background">
      <GuestHeader active="cocktails" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-5 space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Cocktail menu</h1>
          {orderingEnabled && (
            <p className="text-sm text-muted-foreground">
              Vælg en cocktail og tryk Bestil — bartenderen får besked.
            </p>
          )}
        </div>

        <Button
          variant="outline"
          className="mb-5 w-full"
          onClick={() => {
            if (filtered.length === 0) return;
            const random = filtered[Math.floor(Math.random() * filtered.length)];
            setOpenId(random.id);
          }}
        >
          <Shuffle className="h-4 w-4" />
          Overrask mig
        </Button>

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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortMode("alpha")}
              className={cn(sortMode === "alpha" && "border-primary/60 bg-primary/10 text-primary")}
            >
              <ArrowDownAZ className="mr-1 h-4 w-4" />
              A-Z
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortMode("rating")}
              className={cn(sortMode === "rating" && "border-primary/60 bg-primary/10 text-primary")}
            >
              <Star className="mr-1 h-4 w-4" />
              Bedst vurderet
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground">Ingen cocktails matcher din søgning.</p>
        ) : (
          <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <MenukortCocktailCard
                key={c.id}
                cocktail={c}
                onOpen={() => setOpenId(c.id)}
                orderingEnabled={orderingEnabled}
                badge={badgeById.get(c.id)}
              />
            ))}
          </div>
        )}

        {/* Detalje-dialog — viser det fulde CocktailCard med alt info + fremgangsmåde */}
        <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
          <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content
              className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] border-0 bg-transparent p-0 shadow-none outline-none sm:max-w-md"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              {(() => {
                const c = filtered.find((x) => x.id === openId);
                if (!c) return null;
                return (
                  <>
                    <DialogPrimitive.Title className="sr-only">{c.name}</DialogPrimitive.Title>
                    <div
                      className="max-h-[90vh] overflow-y-auto rounded-lg px-4"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("[data-order-button]")) return;
                        if ((e.target as HTMLElement).closest("[data-share-button]")) return;
                        setOpenId(null);
                      }}
                    >
                      <CocktailCard
                        cocktail={c}
                        showAvailabilityBadge={false}
                        showInstructions
                        footerSlot={
                          <div
                            className="flex flex-wrap gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div data-share-button>
                              <ShareButton cocktail={c} />
                            </div>
                            {orderingEnabled && (
                              <div data-order-button className="flex-1">
                                <OrderButton cocktailId={c.id} cocktailName={c.name} />
                              </div>
                            )}
                          </div>
                        }
                      />
                    </div>
                  </>
                );
              })()}
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      </main>
    </div>
  );
}
