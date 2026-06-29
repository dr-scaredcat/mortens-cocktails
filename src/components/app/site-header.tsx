import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSiteSettings,
  DEFAULT_SITE_NAME,
  DEFAULT_LOGO_SIZE,
  DEFAULT_TEXT_SIZE,
  DEFAULT_LOGO_GAP,
  DEFAULT_LOGO_ALIGN,
  DEFAULT_LOGO_TYPE,
  DEFAULT_TEXT_OFFSET_Y,
} from "@/lib/orders.functions";
import { SiteLogo } from "@/components/app/site-logo";
import { cn } from "@/lib/utils";

const alignClass = { top: "items-start", center: "items-center", bottom: "items-end" } as const;

const publicNavItems = [
  { to: "/cocktails" as const, label: "Cocktails", exact: false },
  { to: "/opskrifter" as const, label: "Opskrifter", exact: false },
  { to: "/ingredienser" as const, label: "Ingredienser", exact: false },
  { to: "/menukort" as const, label: "Menukort", exact: false },
] as const;

const authNavItems = [
  { to: "/bestillinger" as const, label: "Bestillinger", exact: false },
  { to: "/statistik" as const, label: "Statistik", exact: false },
  { to: "/admin" as const, label: "Admin", exact: false },
] as const;

function useScrolled(threshold = 60) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

export function SiteHeader() {
  const { session } = useSession();
  const fetchSettings = useServerFn(getSiteSettings);
  const scrolled = useScrolled(60);

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

  // Kompakt: logo/tekst skaleres til ~70% af original
  const compactLogoSize = Math.round(logoSize * 0.3);
  const compactTextSize = Math.round(textSize * 0.3);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur transition-all duration-300">
      {/* ── Top-række: logo + log ud ── */}
      <div
        className={cn(
          "mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 transition-all duration-300",
          scrolled ? "py-1.5" : "py-3",
        )}
      >
        <Link
          to="/cocktails"
          className={cn("flex font-serif tracking-tight", alignClass[logoAlign as keyof typeof alignClass] ?? "items-center")}
          style={{ gap: scrolled ? Math.round(logoGap * 0.7) : logoGap }}
        >
          <SiteLogo
            type={logoType}
            size={scrolled ? compactLogoSize : logoSize}
            className="shrink-0 text-primary transition-all duration-300"
          />
          <span
            className="leading-none transition-all duration-300"
            style={{
              fontSize: scrolled ? compactTextSize : textSize,
              position: "relative",
              top: textOffsetY,
            }}
          >
            {siteName}
          </span>
        </Link>

        {session && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => supabase.auth.signOut()}
            aria-label="Log ud"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}

        {!session && (
          <Button asChild size="sm" variant="ghost">
            <Link to="/auth">Log ind</Link>
          </Button>
        )}
      </div>

      {/* ── Nav-links ── */}
      <nav
        className={cn(
          "mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden transition-all duration-300",
          scrolled ? "pb-1" : "pb-2",
        )}
      >
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
      </nav>
    </header>
  );
}
