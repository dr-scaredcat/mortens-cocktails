import { Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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
import { SiteLogo } from "@/components/app/site-logo";
import { FontApplier } from "@/components/app/font-applier";
import { cn } from "@/lib/utils";

const alignClass = { top: "items-start", center: "items-center", bottom: "items-end" } as const;

const publicNavItems = [
  { to: "/cocktails" as const, label: "Cocktails", exact: false },
  { to: "/opskrifter" as const, label: "Opskrifter", exact: false },
  { to: "/ingredienser" as const, label: "Ingredienser", exact: false },
  { to: "/indkoebsliste" as const, label: "Indkøbsliste", exact: false },
  { to: "/menukort" as const, label: "Menukort", exact: false },
] as const;

const authNavItems = [
  { to: "/bestillinger" as const, label: "Bestillinger", exact: false },
  { to: "/statistik" as const, label: "Statistik", exact: false },
  { to: "/admin" as const, label: "Admin", exact: false },
] as const;

export function SiteHeader() {
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
      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/cocktails"
            className={cn(
              "flex font-serif tracking-tight",
              alignClass[logoAlign as keyof typeof alignClass] ?? "items-center",
            )}
            style={{ gap: logoGap }}
          >
            <span
              className="shrink-0"
              style={{ position: "relative", top: logoOffsetY }}
            >
              <SiteLogo
                type={logoType}
                size={logoSize}
                className="text-primary"
              />
            </span>
            <span
              className="leading-none"
              style={{
                fontSize: textSize,
                position: "relative",
                top: textOffsetY,
                fontFamily: logoFontStack,
              }}
            >
              {siteName}
            </span>
          </Link>
        </div>
      </div>

      {/* ── Nav-bar — sticky, bliver stående. Handlingsknap i højre side ── */}
      <nav className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-1.5 text-sm">
          <div className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {publicNavItems.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.exact }}
                className="shrink-0 rounded-full border border-transparent px-3 py-1 text-muted-foreground hover:text-foreground data-[status=active]:border-primary/40 data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
              >
                {n.label}
              </Link>
            ))}

            {session && (
              <>
                <span className="shrink-0 self-center text-border">|</span>
                {authNavItems.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    activeOptions={{ exact: n.exact }}
                    className="shrink-0 rounded-full border border-transparent px-3 py-1 text-muted-foreground hover:text-foreground data-[status=active]:border-primary/40 data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
                  >
                    {n.label}
                  </Link>
                ))}
              </>
            )}
          </div>

          {session ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => supabase.auth.signOut()}
              aria-label="Log ud"
              className="shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild size="sm" variant="ghost" className="shrink-0">
              <Link to="/auth">Log ind</Link>
            </Button>
          )}
        </div>
      </nav>
    </>
  );
}
