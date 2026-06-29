import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/app/site-logo";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
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

const alignClass = { top: "items-start", center: "items-center", bottom: "items-end" } as const;

function useScrolled(threshold = 0) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

export function GuestHeader({ active }: { active: "cocktails" | "spiritus" }) {
  const { session } = useSession();
  const fetchSettings = useServerFn(getSiteSettings);
  const scrolled = useScrolled(4);

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

  const navItem = (to: string, label: string, isActive: boolean) => (
    <Link
      to={to}
      className={cn(
        "flex-1 rounded-lg px-4 py-1.5 text-center text-sm font-medium transition-colors",
        isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur px-4">
      <div className="mx-auto max-w-5xl">
        {/* ── Logo-række — glider OP ud af syne ved scroll ── */}
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: scrolled ? 0 : 200 }}
        >
          <div className="flex items-center justify-between py-4">
            <div
              className={cn(
                "flex",
                alignClass[logoAlign as keyof typeof alignClass] ?? "items-center",
              )}
              style={{ gap: logoGap }}
            >
              <SiteLogo
                size={logoSize}
                type={logoType}
                className="shrink-0 text-primary"
              />
              <span
                className="font-serif"
                style={{ fontSize: textSize, position: "relative", top: textOffsetY }}
              >
                {siteName}
              </span>
            </div>

            {/* Hjem-knap — kun synlig for loggede brugere */}
            {session && (
              <Button asChild size="sm" variant="ghost" aria-label="Gå til forsiden">
                <Link to="/cocktails">
                  <Home className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* ── Nav-bar: Cocktails | Spiritus — altid synlig ── */}
        <nav className="flex justify-center py-2">
          <div className="flex w-full max-w-xs gap-1 rounded-xl border border-border bg-card p-1">
            {navItem("/menukort", "Cocktails", active === "cocktails")}
            {navItem("/spiritus", "Spiritus", active === "spiritus")}
          </div>
        </nav>
      </div>
    </header>
  );
}
