import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-shared";

// ── Typer ────────────────────────────────────────────────────────────────
export type GlassType = {
  id: string;
  name: string;
  image_url: string | null;
  quantity_owned: number | null;
};

export type GrapeGlassMapping = {
  id: string;
  wine_name: string;
  glass_id: string;
  glass: GlassType | null;
};

// ── Liste over glastyper (offentlig) ────────────────────────────────────────
export const listGlassTypes = createServerFn({ method: "GET" }).handler(
  async (): Promise<GlassType[]> => {
    const sb = publicClient();
    const { data, error } = await (sb.from("glass_types") as any)
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as GlassType[];
  },
);

// ── Liste over drue/vin → glas opslag (offentlig) ───────────────────────────
export const listGrapeGlassMapping = createServerFn({ method: "GET" }).handler(
  async (): Promise<GrapeGlassMapping[]> => {
    const sb = publicClient();
    const { data, error } = await (sb.from("grape_glass_mapping") as any)
      .select("id, wine_name, glass_id, glass:glass_types(*)")
      .order("wine_name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as GrapeGlassMapping[];
  },
);
