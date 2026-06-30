import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicClient, assertAdmin } from "@/lib/supabase-shared";
import { z } from "zod";

export type OrderRow = {
  id: string;
  kind: string;                 // NY: 'cocktail' | 'spirit'
  cocktail_id: string | null;
  spirit_id: string | null;     // NY
  cocktail_name: string;        // bruges som vare-navn for begge typer
  customer_name: string;
  note: string | null;
  status: string;
  created_at: string;
  quantity: number;
};

const orderInput = z.object({
  kind: z.enum(["cocktail", "spirit"]).optional().default("cocktail"),
  cocktailId: z.string().uuid().nullable().optional(),
  spiritId: z.string().uuid().nullable().optional(),
  cocktailName: z.string().min(1).max(120),
  customerName: z.string().trim().min(1, "Skriv dit navn").max(60),
  note: z.string().trim().max(300).optional().nullable(),
  quantity: z.number().int().min(1).max(99).optional().default(1),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => orderInput.parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { error } = await (sb.from("cocktail_orders") as any).insert({
      kind: data.kind,
      cocktail_id: data.kind === "cocktail" ? data.cocktailId ?? null : null,
      spirit_id: data.kind === "spirit" ? data.spiritId ?? null : null,
      cocktail_name: data.cocktailName,
      customer_name: data.customerName,
      note: data.note && data.note.length > 0 ? data.note : null,
      quantity: data.quantity,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    // Cast indtil Supabase-typerne regenereres med quantity-kolonnen.
    const { data, error } = await (context.supabase.from("cocktail_orders") as any)
      .select("id, kind, cocktail_id, spirit_id, cocktail_name, customer_name, note, status, created_at, quantity")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as OrderRow[];
  });

export const setOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "pending" | "done" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "done"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("cocktail_orders")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("cocktail_orders")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAllOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("cocktail_orders")
      .delete()
      .not("id", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOrderingEnabled = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "ordering_enabled")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const v = data?.value;
    return { enabled: v === true || v === "true" };
  });

export const setOrderingEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) =>
    z.object({ enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "ordering_enabled", value: data.enabled as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSignupEnabled = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "signup_enabled")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { enabled: true };
    const v = data.value;
    return { enabled: v !== false && v !== "false" };
  });

export const setSignupEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean }) =>
    z.object({ enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "signup_enabled", value: data.enabled as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Site name ===================

export const DEFAULT_SITE_NAME = "Barskab";

export const getSiteName = createServerFn({ method: "GET" })
  .handler(async () => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "site_name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { name: DEFAULT_SITE_NAME };
    const v = data.value;
    return { name: typeof v === "string" && v.length > 0 ? v : DEFAULT_SITE_NAME };
  });

export const setSiteName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({ name: z.string().trim().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "site_name", value: data.name as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Logo settings ===================

export type LogoType = "barskab" | "martini" | "wine" | "custom";
export type LogoAlign = "top" | "center" | "bottom";

export const DEFAULT_LOGO_SIZE = 20;
export const DEFAULT_TEXT_SIZE = 20;
export const DEFAULT_LOGO_GAP = 10;
export const DEFAULT_LOGO_ALIGN: LogoAlign = "center";
export const DEFAULT_LOGO_TYPE: LogoType = "barskab";
export const DEFAULT_TEXT_OFFSET_Y = 0;
export const DEFAULT_LOGO_OFFSET_Y = 0;

export const setLogoSize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { size: number }) =>
    z.object({ size: z.number().int().min(8).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "logo_size", value: data.size as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTextSize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { size: number }) =>
    z.object({ size: z.number().int().min(8).max(80) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "text_size", value: data.size as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLogoGap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { gap: number }) =>
    z.object({ gap: z.number().int().min(0).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "logo_gap", value: data.gap as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLogoAlign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { align: LogoAlign }) =>
    z.object({ align: z.enum(["top", "center", "bottom"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "logo_align", value: data.align as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLogoType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { type: LogoType }) =>
    z.object({ type: z.enum(["barskab", "martini", "wine", "custom"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "logo_type", value: data.type as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTextOffsetY = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offset: number }) =>
    z.object({ offset: z.number().int().min(-60).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "text_offset_y", value: data.offset as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setLogoOffsetY = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offset: number }) =>
    z.object({ offset: z.number().int().min(-60).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: "logo_offset_y", value: data.offset as unknown as never });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// =================== Samlet header-konfiguration ===================
// Ét DB-kald der henter alle header-/logo-indstillinger på én gang, så
// headeren ikke laver seks separate round-trips pr. sideindlæsning.

export type SiteSettings = {
  name: string;
  logoSize: number;
  textSize: number;
  logoGap: number;
  logoAlign: LogoAlign;
  logoType: LogoType;
  textOffsetY: number;
  logoOffsetY: number;
};

export const getSiteSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteSettings> => {
    const sb = publicClient();
    const { data, error } = await sb
      .from("app_settings")
      .select("key, value")
      .in("key", ["site_name", "logo_size", "text_size", "logo_gap", "logo_align", "logo_type", "text_offset_y", "logo_offset_y"]);
    if (error) throw new Error(error.message);

    const map = new Map((data ?? []).map((r) => [r.key, r.value]));
    const num = (v: unknown, fallback: number) => {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const nameVal = map.get("site_name");
    const alignVal = map.get("logo_align");
    const typeVal = map.get("logo_type");
    const validAlign: LogoAlign[] = ["top", "center", "bottom"];
    const validType: LogoType[] = ["barskab", "martini", "wine", "custom"];

    return {
      name: typeof nameVal === "string" && nameVal.length > 0 ? nameVal : DEFAULT_SITE_NAME,
      logoSize: num(map.get("logo_size"), DEFAULT_LOGO_SIZE),
      textSize: num(map.get("text_size"), DEFAULT_TEXT_SIZE),
      logoGap: num(map.get("logo_gap"), DEFAULT_LOGO_GAP),
      logoAlign: validAlign.includes(alignVal as LogoAlign) ? (alignVal as LogoAlign) : DEFAULT_LOGO_ALIGN,
      logoType: validType.includes(typeVal as LogoType) ? (typeVal as LogoType) : DEFAULT_LOGO_TYPE,
      textOffsetY: num(map.get("text_offset_y"), DEFAULT_TEXT_OFFSET_Y),
      logoOffsetY: num(map.get("logo_offset_y"), DEFAULT_LOGO_OFFSET_Y),
    };
  },
);
  
