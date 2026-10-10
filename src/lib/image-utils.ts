/**
 * Komprimér et billede klientside med Canvas API inden upload til Supabase.
 *
 * Anbefalede indstillinger for barskab-appen:
 *   maxSide: 1200  — giver fine kortbilleder uden unødig filstørrelse
 *   quality: 0.82  — god balance mellem skarphed og JPEG-komprimering
 *
 * PNG-filer eksporteres som PNG (tabsfrit), så en eventuel gennemsigtig baggrund
 * bevares. Alt andet eksporteres som JPEG. Bemærk: hvis vi eksporterede en
 * gennemsigtig PNG som JPEG, ville de gennemsigtige områder blive SORTE — det er
 * årsagen til at egne PNG-uploads tidligere fik sort baggrund.
 *
 * Returnerer en File hvor `type` er enten "image/png" eller "image/jpeg", og
 * filnavnets extension matcher. Kalderen bør bruge `result.type` som contentType
 * ved upload og aflede extension derfra.
 */
export async function compressImage(
  file: File,
  maxSide = 1200,
  quality = 0.82,
): Promise<File> {
  const isPng = file.type === "image/png" || /\.png$/i.test(file.name);

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Skalér ned hvis billedet er større end maxSide på nogen akse.
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        if (width >= height) {
          height = Math.round((height / width) * maxSide);
          width = maxSide;
        } else {
          width = Math.round((width / height) * maxSide);
          height = maxSide;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context ikke tilgængeligt"));
        return;
      }
      // Canvas er gennemsigtigt som udgangspunkt; drawImage bevarer alfa-kanalen.
      ctx.drawImage(img, 0, 0, width, height);

      const outType = isPng ? "image/png" : "image/jpeg";
      const outExt = isPng ? "png" : "jpg";

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Komprimering fejlede"));
            return;
          }
          // Behold det originale filnavn men sæt korrekt extension.
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          resolve(new File([blob], `${baseName}.${outExt}`, { type: outType }));
        },
        outType,
        // PNG er tabsfrit — quality ignoreres. JPEG bruger quality.
        isPng ? undefined : quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Kunne ikke læse billedfilen"));
    };

    img.src = url;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Thumbnail-URL til kort-gitre
// ─────────────────────────────────────────────────────────────────────────────
//
// Formålet er at gitre (menukort, spiritus, cocktails, admin-lister) henter et
// mindre billede end det fulde. Detalje-dialoger bruger stadig den fulde URL.
//
//  • TheCocktailDB: tilføj "/preview" — et lille, gratis thumbnail. Altid sikkert.
//  • Supabase Storage: kræver Storage Image Transformations (kun på betalte
//    planer). På fri plan MÅ vi ikke transformere, ellers brækker billederne —
//    derfor er transformationen slået fra via SUPABASE_IMAGE_TRANSFORMS.
//  • Alle andre URL'er returneres uændret.
//
// Hvis I senere opgraderer Supabase og aktiverer transforms, så sæt blot
// SUPABASE_IMAGE_TRANSFORMS = true — så begynder thumbUrl at bruge width/quality
// på Supabase-hostede billeder også.

/** Slå til hvis Supabase Storage Image Transformations er aktiveret (Pro+). */
const SUPABASE_IMAGE_TRANSFORMS = false;

/**
 * Returnér en thumbnail-variant af en billed-URL til brug i kort-gitre.
 *
 * @param url    Original billed-URL (må gerne være null/undefined)
 * @param width  Ønsket bredde i px (bruges kun ved Supabase-transforms)
 * @returns      Thumbnail-URL, eller den oprindelige URL hvis den ikke kan
 *               transformeres. null hvis input er tomt.
 */
export function thumbUrl(
  url: string | null | undefined,
  width = 480,
): string | null {
  if (!url) return null;

  // TheCocktailDB — /preview giver et lille thumbnail (gratis, altid sikkert).
  if (url.includes("thecocktaildb.com")) {
    return url.endsWith("/preview") ? url : `${url}/preview`;
  }

  // Supabase Storage — kun hvis transforms er aktiveret på projektet.
  if (SUPABASE_IMAGE_TRANSFORMS && url.includes("/storage/v1/object/public/")) {
    const transformed = url.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    );
    const sep = transformed.includes("?") ? "&" : "?";
    return `${transformed}${sep}width=${width}&quality=75`;
  }

  // Alt andet (inkl. Supabase-billeder på fri plan) returneres uændret.
  return url;
}

/**
 * Er billed-URL'en en PNG?
 *
 * Egne PNG-uploads (typisk med gennemsigtig baggrund) skal vises "contain" —
 * skaleret til at passe i feltet med bevaret gennemsigtighed, ligesom
 * placeholder-billederne. Fotos/JPEG vises "cover" (fylder hele feltet).
 *
 * Håndterer query-string og TheCocktailDB's "/preview"-suffiks.
 */
export function isPngImage(url: string | null | undefined): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].replace(/\/preview$/, "");
  return clean.toLowerCase().endsWith(".png");
}
