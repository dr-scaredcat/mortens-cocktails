import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { CocktailWithDetails } from "@/lib/cocktails.functions";
import { RatingStars } from "@/components/app/rating-stars";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ShoppingListButton } from "@/components/app/shopping-list-button";
import { thumbUrl } from "@/lib/image-utils";

const PRESETS = [1, 2, 3, 4];
const MAX_MULTIPLIER = 99;

function fmt(amount: number | null, unit: string | null, multiplier = 1) {
  if (amount == null) return unit ?? "";
  // Afrund til 3 decimaler for at undgå flydende-komma-støj, fjern så nuller.
  const scaled = Number((Number(amount) * multiplier).toFixed(3));
  // Brug komma som decimaltegn i visningen
  const n = Number.isInteger(scaled) ? scaled.toString() : scaled.toString().replace(".", ",");
  return unit ? `${n} ${unit}` : n;
}

export function CocktailCard({
  cocktail,
  showAvailabilityBadge = true,
  compact = false,
  footerSlot,
  onClick,
  showMultiplier = false,
  initialMultiplier = 1,
  shoppingListIds,
  onAddToShoppingList,
  showInstructions = false,
  thumb = false,
}: {
  cocktail: CocktailWithDetails;
  showAvailabilityBadge?: boolean;
  compact?: boolean;
  footerSlot?: ReactNode;
  onClick?: () => void;
  showMultiplier?: boolean;
  initialMultiplier?: number;
  /** ID'er der allerede er på indkøbslisten — vises kun hvis prop er givet */
  shoppingListIds?: Set<string>;
  /** Callback til at tilføje manglende ingredienser */
  onAddToShoppingList?: (ingredientIds: string[]) => void;
  /** Vis fremgangsmåde (instructions) under ingredienslisten */
  showInstructions?: boolean;
  /** Brug et mindre thumbnail-billede (til kort-gitre). Detalje-visning bruger fuldt billede. */
  thumb?: boolean;
}) {
  const safeInitial = Number.isFinite(initialMultiplier) && initialMultiplier >= 1 ? initialMultiplier : 1;
  const [multiplier, setMultiplier] = useState(safeInitial);
  const [customText, setCustomText] = useState(PRESETS.includes(safeInitial) ? "" : String(safeInitial));

  const missing = cocktail.missing.length;
  const clickable = !!onClick;

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden border-border/70 bg-card",
        clickable && "cursor-pointer transition hover:border-primary/50",
      )}
    >
      <div
        className={cn("aspect-[4/3] w-full bg-muted", clickable && "cursor-pointer")}
        onClick={onClick}
        role={clickable ? "button" : undefined}
      >
        {cocktail.image_url ? (
          <img
            src={thumb ? (thumbUrl(cocktail.image_url, 480) ?? cocktail.image_url) : cocktail.image_url}
            alt={cocktail.name}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
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
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div
          className={cn("flex items-start justify-between gap-2", clickable && "cursor-pointer")}
          onClick={onClick}
        >
          <h3 className="font-serif text-xl leading-tight">{cocktail.name}</h3>
          {showAvailabilityBadge && (
            missing === 0 ? (
              <Badge className="shrink-0 bg-primary/15 text-primary hover:bg-primary/20">Klar</Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 text-muted-foreground">
                Mangler {missing}
              </Badge>
            )
          )}
        </div>

        {cocktail.description && (
          <p
            className={cn(
              "text-sm text-muted-foreground",
              clickable && "cursor-pointer",
            )}
            onClick={onClick}
          >
            {cocktail.description}
          </p>
        )}

        {cocktail.tags.length > 0 && (
          <div
            className={cn("flex flex-wrap gap-1", clickable && "cursor-pointer")}
            onClick={onClick}
          >
            {cocktail.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs">
                {t}
              </Badge>
            ))}
          </div>
        )}

        {showMultiplier && (
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setMultiplier(p);
                  setCustomText("");
                }}
                className={cn(
                  "rounded border px-2 py-0.5 text-xs transition",
                  multiplier === p && customText === ""
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/50",
                )}
              >
                {p}×
              </button>
            ))}
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Andet"
              value={customText}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, "");
                setCustomText(raw);
                const n = Number(raw);
                if (raw && n >= 1 && n <= MAX_MULTIPLIER) setMultiplier(n);
              }}
              className="h-6 w-16 px-2 text-xs"
            />
          </div>
        )}

        <div className="mt-auto space-y-2">
          {cocktail.ingredients.length > 0 && (
            <ul
              className={cn("space-y-0.5 text-sm", clickable && "cursor-pointer")}
              onClick={onClick}
            >
              {cocktail.ingredients.map((i) => (
                <li
                  key={i.ingredient_id}
                  className={cn(
                    "flex justify-between gap-2",
                    !i.available && "text-muted-foreground line-through",
                  )}
                >
                  <span>{i.name}</span>
                  {(i.amount != null || i.unit) && (
                    <span className="shrink-0 text-muted-foreground">
                      {fmt(i.amount, i.unit, multiplier)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Fremgangsmåde — vises kun når showInstructions er sat og der findes tekst */}
          {showInstructions && cocktail.instructions && (
            <div
              className={cn("space-y-1 pt-1 text-sm", clickable && "cursor-pointer")}
              onClick={onClick}
            >
              <p className="font-medium text-foreground">Fremgangsmåde</p>
              <p className="whitespace-pre-line text-muted-foreground">
                {cocktail.instructions}
              </p>
            </div>
          )}

          {!compact && (
            <RatingStars
              cocktailId={cocktail.id}
              avg={cocktail.avg_rating}
              count={cocktail.rating_count}
            />
          )}

          {/* Indkøbsliste-knap — vises kun hvis prop er givet */}
          {shoppingListIds !== undefined && onAddToShoppingList && (
            <div className="flex justify-end">
              <ShoppingListButton
                ingredientIds={cocktail.ingredients
                  .filter((i) => !i.available)
                  .map((i) => i.ingredient_id)}
                shoppingListIds={shoppingListIds}
                onAdd={() =>
                  onAddToShoppingList(
                    cocktail.ingredients
                      .filter((i) => !i.available)
                      .map((i) => i.ingredient_id),
                  )
                }
                size="sm"
              />
            </div>
          )}

          {footerSlot}
        </div>
      </div>
    </Card>
  );
}
