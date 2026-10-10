import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wine } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SpiritWithDetails } from "@/lib/spirits.functions";
import { SpiritRatingStars } from "@/components/app/spirit-rating-stars";
import { thumbUrl } from "@/lib/image-utils";
import { CardImage } from "@/components/app/card-image";

export function SpiritCard({
  spirit,
  footerSlot,
  onClick,
  showTypeBadge = true,
  thumb = false,
}: {
  spirit: SpiritWithDetails;
  footerSlot?: ReactNode;
  onClick?: () => void;
  showTypeBadge?: boolean;
  /** Brug et mindre thumbnail-billede (til kort-gitre). Detalje-visning bruger fuldt billede. */
  thumb?: boolean;
}) {
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
        {spirit.image_url ? (
          <CardImage
            src={thumb ? (thumbUrl(spirit.image_url, 480) ?? spirit.image_url) : spirit.image_url}
            alt={spirit.name}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Wine className="h-10 w-10" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div
          className={cn("flex items-start justify-between gap-2", clickable && "cursor-pointer")}
          onClick={onClick}
        >
          <h3 className="font-serif text-xl leading-tight">{spirit.name}</h3>
          {showTypeBadge && spirit.spirit_type && (
            <Badge variant="outline" className="shrink-0 text-xs">
              {spirit.spirit_type}
            </Badge>
          )}
        </div>
        {spirit.description && (
          <p className="text-sm text-muted-foreground">{spirit.description}</p>
        )}
        <SpiritRatingStars
          spiritId={spirit.id}
          avg={spirit.avg_rating}
          count={spirit.rating_count}
        />
        {footerSlot && <div className="mt-auto pt-1">{footerSlot}</div>}
      </div>
    </Card>
  );
}
