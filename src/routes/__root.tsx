import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { getThemesData } from "@/lib/themes.functions";
import { applyThemeColors } from "@/hooks/use-theme";
import { oklchToHex, isOklchString } from "@/lib/color-utils";

// Nøgle til de cachede tema-farver i localStorage. Deles mellem boot-scriptet
// (som læser) og ThemeLoader (som skriver).
const THEME_CACHE_KEY = "astonsbar.theme";

// Inline boot-script: sætter cachede tema-farver som CSS-variabler FØR første
// paint, så gæster ikke ser standardtemaet blinke, før ThemeLoader har hentet det
// aktive tema fra Supabase. Fejler stille hvis intet er cachet (så gælder
// :root-standarderne fra styles.css). Mappingen er identisk med applyThemeColors
// i src/hooks/use-theme.ts — hold dem synkroniseret hvis variabel-listen ændres.
const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem("${THEME_CACHE_KEY}");
    if (!raw) return;
    var c = JSON.parse(raw);
    if (!c || !c.background) return;
    var s = document.documentElement.style;
    function set(k, v) { if (v) s.setProperty(k, v); }
    set("--background", c.background);
    set("--foreground", c.foreground);
    set("--card", c.card);
    set("--card-foreground", c.foreground);
    set("--popover", c.card);
    set("--popover-foreground", c.foreground);
    set("--primary", c.primary);
    set("--primary-foreground", c.primaryForeground);
    set("--secondary", c.accent);
    set("--secondary-foreground", c.accentForeground);
    set("--muted", c.muted);
    set("--muted-foreground", c.mutedForeground);
    set("--accent", c.accent);
    set("--accent-foreground", c.accentForeground);
    set("--destructive", c.destructive);
    set("--destructive-foreground", c.destructiveForeground);
    set("--border", c.border);
    set("--input", c.muted);
    set("--ring", c.primary);
  } catch (e) {}
})();
`;

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Aston's Bar — Hvilke cocktails kan du lave?" },
      { name: "description", content: "Hold styr på dine ingredienser og se hvilke cocktails du kan lave lige nu." },
      { property: "og:title", content: "Aston's Bar" },
      { property: "og:description", content: "Dit personlige cocktail-bibliotek." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // Statisk fallback — ThemeLoader overskriver denne dynamisk ved load
      { name: "theme-color", content: "#09090b" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Aston's Bar" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap",
      },
      // De valgbare skrifttyper (admin → Indstillinger → Skrifttyper) indlæses nu
      // dynamisk af FontApplier — kun den/de faktisk valgte font(s). Derfor er det
      // statiske GOOGLE_FONTS_HREF-link fjernet herfra.
      // Favicon
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "96x96", href: "/favicon-96x96.png" },
      // iOS hjemmeskærm
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      // PWA manifest
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Tema-FOUC: anvend cachede farver synkront før første paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function colorToHex(value: string): string {
  if (isOklchString(value)) return oklchToHex(value);
  if (value.startsWith("#")) return value;
  return value; // fx "rgb(...)" — send direkte til browseren
}

function setThemeColorMeta(background: string) {
  const hex = colorToHex(background);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", hex);
  }
}

function ThemeLoader() {
  useEffect(() => {
    getThemesData()
      .then(({ themes, activeThemeId }) => {
        const active = themes.find((t) => t.id === activeThemeId);
        if (active) {
          applyThemeColors(active.colors);
          setThemeColorMeta(active.colors.background);
          // Cache farverne, så boot-scriptet kan anvende dem synkront næste gang
          // og undgå tema-blink. Serverens data er autoritativ og opdaterer cachen.
          try {
            localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(active.colors));
          } catch {
            // localStorage utilgængelig (fx privat browsing) — ignorér.
          }
        }
      })
      .catch(() => {
        // Ignore — default CSS variables og statisk theme-color forbliver
      });
  }, []);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeLoader />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
