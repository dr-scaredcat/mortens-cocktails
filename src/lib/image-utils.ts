/**
 * Komprimér et billede klientside med Canvas API inden upload til Supabase.
 *
 * Anbefalede indstillinger for barskab-appen:
 *   maxSide: 1200  — giver fine kortbilleder uden unødig filstørrelse
 *   quality: 0.82  — god balance mellem skarphed og JPEG-komprimering
 *
 * Returnerer en Blob (image/jpeg) der kan uploades direkte til Supabase Storage.
 */
export async function compressImage(
  file: File,
  maxSide = 1200,
  quality = 0.82,
): Promise<File> {
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
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Komprimering fejlede"));
            return;
          }
          // Behold det originale filnavn men skift extension til .jpg
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          resolve(new File([blob], `${baseName}.jpg`, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Kunne ikke læse billedfilen"));
    };

    img.src = url;
  });
}
