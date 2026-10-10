import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/app/site-logo";
import { FontApplier } from "@/components/app/font-applier";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import {
  getSiteSettings,
  fontStack,
  DEFAULT_SITE_NAME,
  DEFAULT_LOGO_SIZE,
  DEFAULT_TEXT_SIZE,
  DEFAULT_LOGO_GAP,
  DEFAULT_LOGO_ALIGN,
  DEFAULT_LOGO_TYPE,
  DEFAULT_TEXT_OFFSET_Y,
  DEFAULT_LOGO_OFFSET_Y,
  DEFAULT_LOGO_FONT,
} from "@/lib/orders.functions";

const alignClass = { top: "items-start", center: "items-center", bottom: "items-end" } as const;

export function GuestHeader({ active }: { active: "cocktails" | "spiritus" | "vine" }) {
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
  const textOffsetY = data?.textOffsetY ?? DEFAULT_TEXT_OFFSET_Y;
  const logoOffsetY = data?.logoOffsetY ?? DEFAULT_LOGO_OFFSET_Y;
  const logoFontStack = fontStack(data?.logoFont ?? DEFAULT_LOGO_FONT) || undefined;

  return (
    <>
      <FontApplier />

      {/* ── Logo-række — scroller væk naturligt ── */}
      <div className="border-b border-border bg-background px-4">
        <div className="mx-auto flex max-w-5xl items-center py-3">
          <div
            className={cn(
              "flex",
              alignClass[logoAlign as keyof typeof alignClass] ?? "items-center",
            )}
            style={{ gap: logoGap }}
          >
            <span
              className="shrink-0"
              style={{ position: "relative", top: logoOffsetY }}
            >
              <SiteLogo size={logoSize} type={logoType} className="text-primary" />
            </span>
            <span
              className="font-serif"
              style={{
                fontSize: textSize,
                position: "relative",
                top: textOffsetY,
                fontFamily: logoFontStack,
              }}
            >
              {siteName}
            </span>
          </div>
        </div>
      </div>

      {/* ── Nav-bar: Cocktails | Spiritus | Vine — sticky. Home-knap højre ── */}
      {/*
        Tre pills på smal mobil: vi bruger kortere padding (px-2 py-1.5) og
        text-[13px] for at alle tre labels passer inden for skærmbredden.
        På sm+ skærme gives normal padding (px-3) via sm:px-3.
      */}
      <nav className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 py-1.5 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 text-sm">
          <div className="flex flex-1 gap-1 rounded-xl border border-border bg-card p-1">
            <Link
              to="/menukort"
              className={cn(
                "flex-1 rounded-lg px-2 py-1.5 text-center text-[13px] font-medium leading-tight transition-colors sm:px-3 sm:text-sm",
                active === "cocktails"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Cocktails
            </Link>
            <Link
              to="/spiritus"
              className={cn(
                "flex-1 rounded-lg px-2 py-1.5 text-center text-[13px] font-medium leading-tight transition-colors sm:px-3 sm:text-sm",
                active === "spiritus"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Spiritus
            </Link>
            <Link
              to="/vine"
              className={cn(
                "flex-1 rounded-lg px-2 py-1.5 text-center text-[13px] font-medium leading-tight transition-colors sm:px-3 sm:text-sm",
                active === "vine"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Vine
            </Link>
          </div>

          {session && (
            <Button asChild size="sm" variant="ghost" aria-label="Gå til forsiden" className="shrink-0">
              <Link to="/cocktails">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </nav>
    </>
  );
}
