import { Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSiteName,
  DEFAULT_SITE_NAME,
  getLogoSize,
  DEFAULT_LOGO_SIZE,
  getTextSize,
  DEFAULT_TEXT_SIZE,
  getLogoGap,
  DEFAULT_LOGO_GAP,
  getLogoAlign,
  DEFAULT_LOGO_ALIGN,
  getLogoType,
  DEFAULT_LOGO_TYPE,
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

export function SiteHeader() {
  const { session } = useSession();
  const fetchSiteName = useServerFn(getSiteName);
  const fetchLogoSize = useServerFn(getLogoSize);
  const fetchTextSize = useServerFn(getTextSize);
  const fetchLogoGap = useServerFn(getLogoGap);
  const fetchLogoAlign = useServerFn(getLogoAlign);
  const fetchLogoType = useServerFn(getLogoType);

  const stale = { staleTime: 1000 * 60 * 5 };
  const { data: siteNameData } = useQuery({ queryKey: ["site-name"], queryFn: () => fetchSiteName(), ...stale });
  const { data: logoSizeData } = useQuery({ queryKey: ["logo-size"], queryFn: () => fetchLogoSize(), ...stale });
  const { data: textSizeData } = useQuery({ queryKey: ["text-size"], queryFn: () => fetchTextSize(), ...stale });
  const { data: logoGapData } = useQuery({ queryKey: ["logo-gap"], queryFn: () => fetchLogoGap(), ...stale });
  const { data: logoAlignData } = useQuery({ queryKey: ["logo-align"], queryFn: () => fetchLogoAlign(), ...stale });
  const { data: logoTypeData } = useQuery({ queryKey: ["logo-type"], queryFn: () => fetchLogoType(), ...stale });

  const siteName = siteNameData?.name ?? DEFAULT_SITE_NAME;
  const logoSize = logoSizeData?.size ?? DEFAULT_LOGO_SIZE;
  const textSize = textSizeData?.size ?? DEFAULT_TEXT_SIZE;
  const logoGap = logoGapData?.gap ?? DEFAULT_LOGO_GAP;
  const logoAlign = logoAlignData?.align ?? DEFAULT_LOGO_ALIGN;
  const logoType = logoTypeData?.type ?? DEFAULT_LOGO_TYPE;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link
          to="/cocktails"
          className={cn("flex font-serif tracking-tight", alignClass[logoAlign])}
          style={{ gap: logoGap }}
        >
          <SiteLogo type={logoType} size={logoSize} className="shrink-0 text-primary" />
          <span className="leading-none" style={{ fontSize: textSize }}>
            {siteName}
          </span>
        </Link>

        {/* Log ud knap øverst til højre — kun når logget ind */}
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

        {/* Log ind knap — kun når ikke logget ind */}
        {!session && (
          <Button asChild size="sm" variant="ghost">
            <Link to="/auth">Log ind</Link>
          </Button>
        )}
      </div>

      {/* Scrollbar nav-række */}
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
