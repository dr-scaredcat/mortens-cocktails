import { isPngImage } from "@/lib/image-utils";
import { cn } from "@/lib/utils";

/**
 * Billede til admin-previews (kvadratiske liste-thumbnails og form-preview).
 *
 * Feltets dimensioner styres af kalderen via `className` (fx "h-full w-full" i en
 * kvadratisk boks, eller "h-32 w-full rounded" til form-previewet). Komponenten
 * bestemmer kun object-fit:
 *
 *  • PNG (typisk egne uploads med gennemsigtig baggrund): "contain" med en anelse
 *    luft, så hele billedet er inden for feltet i stedet for at blive beskåret.
 *  • Alt andet: "cover" — som hidtil (den korteste side udfylder feltet).
 */
export function AdminImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={cn(className, isPngImage(src) ? "object-contain p-1" : "object-cover")}
      loading="lazy"
      decoding="async"
    />
  );
}
