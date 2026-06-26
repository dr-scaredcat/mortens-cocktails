import { Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSiteName,
  DEFAULT_SITE_NAME,
  getLogoSize,
  DEFAULT_LOGO_SIZE,
  getLogoType,
  DEFAULT_LOGO_TYPE,
} from "@/lib/orders.functions";
import { SiteLogo } from "@/components/app/site-logo";

const navItems = [
  { to: "/", label: "Klar" },
  { to: "/naesten", label: "Næsten" },
  { to: "/alle", label: "Alle" },
  { to: "/ingredienser", label: "Ingredienser" },
] as const;

export function SiteHeader() {
  const { session } = useSession();
  const fetchSiteName = useServerFn(getSiteName);
  const fetchLogoSize = useServerFn(getLogoSize);
  const fetchLogoType = useServerFn(getLogoType);

  const { data: siteNameData } = useQuery({
    queryKey: ["site-name"],
    queryFn: () => fetchSiteName(),
    staleTime: 1000 * 60 * 5,
  });
  const { data: logoSizeData } = useQuery({
    queryKey: ["logo-size"],
    queryFn: () => fetchLogoSize(),
    staleTime: 1000 * 60 * 5,
  });
  const { data: logoTypeData } = useQuery({
    queryKey: ["logo-type"],
    queryFn: () => fetchLogoType(),
    staleTime: 1000 * 60 * 5,
  });

  const siteName = siteNameData?.name ?? DEFAULT_SITE_NAME;
  const logoSize = logoSizeData?.size ?? DEFAULT_LOGO_SIZE;
  const logoType = logoTypeData?.type ?? DEFAULT_LOGO_TYPE;
  const textSize = Math.round(logoSize / 2);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 tracking-tight font-serif">
          <SiteLogo type={logoType} size={logoSize} className="shrink-0 text-primary" />
          <span className="leading-none" style={{ fontSize: textSize }}>
            {siteName}
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {session ? (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link to="/bestillinger">
                  <ClipboardList className="mr-1 h-4 w-4" /> Bestillinger
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin">
                  <Shield className="mr-1 h-4 w-4" /> Admin
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => supabase.auth.signOut()}
                aria-label="Log ud"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild size="sm" variant="ghost">
              <Link to="/auth">Log ind</Link>
            </Button>
          )}
        </div>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
        {navItems.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/" }}
            className="rounded-full border border-transparent px-3 py-1 text-muted-foreground hover:text-foreground data-[status=active]:border-primary/40 data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
