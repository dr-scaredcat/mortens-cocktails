import { isPngImage } from "@/lib/image-utils";

/**
 * Billede til kort-felter (4:3-boksen øverst på et kort).
 *
 *  • PNG (typisk egne uploads med gennemsigtig baggrund): vises "contain" —
 *    centreret og skaleret til at passe i feltet med bevaret gennemsigtighed,
 *    ligesom placeholder-billederne, bare lidt større (h-4/5 mod placeholderens
 *    h-2/3).
 *  • Alt andet (fotos, JPEG, TheCocktailDB): vises "cover" og fylder hele feltet.
 *
 * Selve placeholder-visningen (når der slet ikke er noget billede) håndteres af
 * det enkelte kort, så maskotten og "Billede er på vej…"-teksten bevares.
 */
export function CardImage({ src, alt }: { src: string; alt: string }) {
  if (isPngImage(src)) {
    return (
      <div className="flex h-full w-full items-center justify-center p-2">
        <img
          src={src}
          alt={alt}
          className="h-4/5 w-auto max-w-full object-contain"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
    />
  );
}
