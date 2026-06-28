import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shuffle, ArrowDownAZ, Star, Share2, Check, Home } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { CocktailCard } from "@/components/app/cocktail-card";
import { RatingStars } from "@/components/app/rating-stars";
import { TagFilter } from "@/components/app/tag-filter";
import { Input } from "@/components/ui/input";
import { listCocktails, type CocktailWithDetails } from "@/lib/cocktails.functions";
import { OrderButton } from "@/components/app/order-button";
import { getPopularCocktails, type PopularBadge } from "@/lib/stats.functions";
import {
  getOrderingEnabled,
  getSiteSettings,
  DEFAULT_SITE_NAME,
  DEFAULT_LOGO_SIZE,
  DEFAULT_TEXT_SIZE,
  DEFAULT_LOGO_GAP,
  DEFAULT_LOGO_ALIGN,
  DEFAULT_LOGO_TYPE,
} from "@/lib/orders.functions";
import { SiteLogo } from "@/components/app/site-logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { Wine } from "lucide-react";

export const Route = createFileRoute("/menukort")({
  head: () => ({
    meta: [
      { title: "Menukort" },
      { name: "description", content: "Cocktails du kan lave lige nu." },
    ],
  }),
  component: MenukortPage,
});

type SortMode = "alpha" | "rating";

const alignClass = { top: "items-start", center: "items-center", bottom: "items-end" } as const;

// ── Minimal header kun til gæster — ingen navigation ────────────────────────
function MenukortHeader() {
  const { session } = useSession();
  const fetchSettings = useServerFn(getSiteSettings);

  // Ét samlet kald i stedet for seks separate round-trips.
  const { data } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetchSettings(),
    staleTime: 1000 * 60 * 5,
  });

  const siteName = data?.name ?? DEFAULT_SITE_NAME;
  const logoSize = data?.logoSize ?? DEFAULT_LOGO_SIZE;
  const textSize = data?.textSize ?? DEFAULT_TEXT_SIZE;
  const logoGap = data?.logoGap ?? DEFAULT_LOGO_GAP;
  const logoAlign = data?.logoAlign ?? DEFAULT_LOGO_ALIGN;
  const logoType = data?.logoType ?? DEFAULT_LOGO_TYPE;

  return (
    <header className="border-b border-border bg-background px-4 py-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div
          className={cn("flex", alignClass[logoAlign as keyof typeof alignClass] ?? "items-center")}
          style={{ gap: `${logoGap}px` }}
        >
          <SiteLogo size={logoSize} type={logoType} className="shrink-0 text-primary" />
          <span className="font-serif" style={{ fontSize: `${textSize}px` }}>{siteName}</span>
        </div>

        {/* Hjem-knap — kun synlig for loggede brugere */}
        {session && (
          <Button asChild size="sm" variant="ghost" aria-label="Gå til forsiden">
            <Link to="/cocktails">
              <Home className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}

// ── Bestseller/Populær-badge - teksen 6 linjer nede redigerer teksen i badget────────────────────────────────────────────────
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
    <Badge className="bg-background/90 text-foreground shadow hover:bg-background/90">
      <Star className="h-3 w-3 fill-current" />
      Bestseller
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
    <Card className="flex flex-col overflow-hidden border-border/70 bg-card cursor-pointer transition hover:border-primary/50">
      {/* Hele kortet åbner dialogen — undtagen bestil-knappen */}
      <div onClick={onOpen}>
        {/* Billede */}
        <div className="relative aspect-[4/3] w-full bg-muted">
          {badge && (
            <div className="absolute left-2 top-2 z-10">
              <PopularityBadge badge={badge} />
            </div>
          )}
          {cocktail.image_url ? (
            <img
              src={cocktail.image_url}
              alt={cocktail.name}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Wine className="h-10 w-10" />
            </div>
          )}
        </div>

        {/* Indhold */}
        <div className="flex flex-col gap-2 p-4">
          <h3 className="font-serif text-xl leading-tight">{cocktail.name}</h3>
          <RatingStars
            cocktailId={cocktail.id}
            avg={cocktail.avg_rating}
            count={cocktail.rating_count}
          />
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

      {/* Bestil-knap — stopper klik fra at boble op til dialogen */}
      {orderingEnabled && (
        <div className="px-4 pb-4" onClick={(e) => e.stopPropagation()}>
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
      <MenukortHeader />
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        {/* Detalje-dialog — viser det fulde CocktailCard med alt info */}
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
