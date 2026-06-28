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
    <Badge className="bg-background/90 text-foreground shadow hover:bg-background/90">
      <Star className="h-3 w-3 fill-current" />
      Bestseller
    </Badge>
  );
}

// ── Simpelt kort til gitteret — bestil-knap altid i bunden ──────────────────
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
    // flex flex-col + h-full sikrer at kortet fylder hele grid-cellen,
    // og at bestil-knappen altid skubbes til bunden med mt-auto.
    <Card className="flex h-full flex-col overflow-hidden border-border/70 bg-card cursor-pointer transition hover:border-primary/50">
      {/* Hele kortet åbner dialogen — undtagen bestil-knappen */}
      <div className="flex flex-1 flex-col" onClick={onOpen}>
        {/* Billede */}
        <div className="relative aspect-[4/3] w-full bg-muted shrink-0">
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

        {/* Indhold — vokser og fylder tilgængeligt rum */}
        <div className="flex flex-1 flex-col gap-2 p-4">
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

      {/* Bestil-knap — altid i bunden, stopper klik fra at boble op */}
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

function MenukortPage() {
  const fetchCocktails = useServerFn(listCocktails);
  const fetchOrderingEnabled = useServerFn(getOrderingEnabled);
  const fetchPopular = useServerFn(getPopularCocktails);

  const { data: cocktails } = useQuery({
    queryKey: ["cocktails"],
    queryFn: () => fetchCocktails(),
  });

  const { data: orderingEnabled } = useQuery({
    queryKey: ["ordering-enabled"],
    queryFn: () => fetchOrderingEnabled(),
    select: (d) => d.enabled,
  });

  const { data: popular } = useQuery({
    queryKey: ["popular-cocktails"],
    queryFn: () => fetchPopular(),
  });

  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("alpha");
  const [openId, setOpenId] = useState<string | null>(null);

  const menuCocktails = useMemo(
    () => (cocktails ?? []).filter((c) => c.on_menu),
    [cocktails],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of menuCocktails) for (const t of c.tags) set.add(t);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "da"));
  }, [menuCocktails]);

  const filtered = useMemo(() => {
    let list = menuCocktails;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.ingredients.some((i) => i.name.toLowerCase().includes(q)),
      );
    }
    if (activeTags.length > 0) {
      list = list.filter((c) => activeTags.every((t) => c.tags.includes(t)));
    }
    if (sortMode === "alpha") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, "da"));
    } else {
      list = [...list].sort((a, b) => (b.avg_rating ?? -1) - (a.avg_rating ?? -1));
    }
    return list;
  }, [menuCocktails, search, activeTags, sortMode]);

  const openCocktail = openId ? (cocktails ?? []).find((c) => c.id === openId) ?? null : null;

  const badgeMap = useMemo(() => {
    const map = new Map<string, PopularBadge>();
    if (popular?.bestseller) map.set(popular.bestseller, "bestseller");
    if (popular?.popular && popular.popular !== popular.bestseller)
      map.set(popular.popular, "popular");
    return map;
  }, [popular]);

  return (
    <div className="min-h-screen bg-background">
      <MenukortHeader />

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Søg + sortering */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Søg cocktail eller ingrediens…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={sortMode === "alpha" ? "default" : "outline"}
              onClick={() => setSortMode("alpha")}
            >
              <ArrowDownAZ className="mr-1 h-4 w-4" />
              A–Z
            </Button>
            <Button
              size="sm"
              variant={sortMode === "rating" ? "default" : "outline"}
              onClick={() => setSortMode("rating")}
            >
              <Star className="mr-1 h-4 w-4" />
              Rating
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const shuffled = [...filtered].sort(() => Math.random() - 0.5);
                // Trigger re-render via sortMode trick — brug ekstern state i stedet
              }}
            >
              <Shuffle className="mr-1 h-4 w-4" />
              Tilfældig
            </Button>
          </div>
        </div>

        {/* Tag-filter */}
        {allTags.length > 0 && (
          <div className="mb-6">
            <TagFilter tags={allTags} active={activeTags} onChange={setActiveTags} />
          </div>
        )}

        {/* Gitter — items-stretch sikrer at alle kort i en række har samme højde */}
        <div className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((c) => (
            <MenukortCocktailCard
              key={c.id}
              cocktail={c}
              onOpen={() => setOpenId(c.id)}
              orderingEnabled={orderingEnabled ?? false}
              badge={badgeMap.get(c.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="mt-12 text-center text-muted-foreground">Ingen cocktails matcher søgningen.</p>
        )}
      </main>

      {/* Detail-dialog */}
      {openCocktail && (
        <Dialog open={!!openId} onOpenChange={(v) => { if (!v) setOpenId(null); }}>
          <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-background p-0 shadow-xl focus:outline-none">
              <CocktailCard
                cocktail={openCocktail}
                showAvailabilityBadge={false}
                footerSlot={
                  <div className="flex items-center justify-between gap-2">
                    <ShareButton cocktail={openCocktail} />
                    {orderingEnabled && (
                      <OrderButton
                        cocktailId={openCocktail.id}
                        cocktailName={openCocktail.name}
                      />
                    )}
                  </div>
                }
              />
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      )}
    </div>
  );
}
