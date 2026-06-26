import type { ThemeColors } from "@/lib/themes.functions";

type Props = {
  colors: ThemeColors;
};

function css(colors: ThemeColors) {
  return {
    "--background": colors.background,
    "--foreground": colors.foreground,
    "--card": colors.card,
    "--card-foreground": colors.foreground,
    "--popover": colors.card,
    "--popover-foreground": colors.foreground,
    "--primary": colors.primary,
    "--primary-foreground": colors.primaryForeground,
    "--secondary": colors.accent,
    "--secondary-foreground": colors.accentForeground,
    "--muted": colors.muted,
    "--muted-foreground": colors.mutedForeground,
    "--accent": colors.accent,
    "--accent-foreground": colors.accentForeground,
    "--destructive": colors.destructive,
    "--destructive-foreground": colors.destructiveForeground,
    "--border": colors.border,
    "--input": colors.muted,
    "--ring": colors.primary,
  } as React.CSSProperties;
}

export function ThemePreview({ colors }: Props) {
  const vars = css(colors);

  return (
    <div
      className="overflow-hidden rounded-lg border text-[13px] leading-snug"
      style={{
        ...vars,
        backgroundColor: colors.background,
        color: colors.foreground,
        borderColor: colors.border,
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-2"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
        }}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: colors.primary }}
          />
          <span className="font-semibold" style={{ color: colors.foreground }}>
            Cocktail menu
          </span>
        </div>
        <div
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            backgroundColor: colors.primary,
            color: colors.primaryForeground,
          }}
        >
          Overrask mig
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 pt-3 pb-2">
        <div
          className="flex h-7 w-full items-center rounded-md border px-2.5 text-[11px]"
          style={{
            backgroundColor: colors.muted,
            borderColor: colors.border,
            color: colors.mutedForeground,
          }}
        >
          Søg efter cocktail...
        </div>
        {/* Tags */}
        <div className="mt-2 flex gap-1.5">
          {["frugtig", "sød", "boozy"].map((tag, i) => (
            <span
              key={tag}
              className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold"
              style={
                i === 0
                  ? {
                      backgroundColor: colors.primary,
                      color: colors.primaryForeground,
                      borderColor: colors.primary,
                    }
                  : {
                      backgroundColor: "transparent",
                      color: colors.foreground,
                      borderColor: colors.border,
                    }
              }
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">
        {/* Card 1 – ready */}
        <div
          className="overflow-hidden rounded-xl border"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          {/* Image placeholder */}
          <div
            className="h-16 w-full"
            style={{ backgroundColor: colors.muted }}
          />
          <div className="space-y-1.5 p-2">
            <div className="flex items-start justify-between gap-1">
              <span
                className="font-semibold leading-tight"
                style={{ color: colors.foreground, fontFamily: "Georgia, serif" }}
              >
                Mojito
              </span>
              <span
                className="shrink-0 rounded-md border px-1 py-0.5 text-[9px] font-semibold"
                style={{
                  backgroundColor: `color-mix(in oklch, ${colors.primary} 20%, transparent)`,
                  color: colors.primary,
                  borderColor: "transparent",
                }}
              >
                Klar
              </span>
            </div>
            {/* Stars */}
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <svg
                  key={n}
                  className="h-2.5 w-2.5"
                  viewBox="0 0 20 20"
                  fill={n <= 4 ? colors.primary : "none"}
                  stroke={colors.primary}
                  strokeWidth={1.5}
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span
                className="ml-0.5 text-[9px]"
                style={{ color: colors.mutedForeground }}
              >
                4.2 (12)
              </span>
            </div>
            {/* Tags */}
            <div className="flex gap-1">
              {["frisk", "klassisk"].map((t) => (
                <span
                  key={t}
                  className="rounded-md border px-1 py-0.5 text-[9px] font-semibold"
                  style={{
                    borderColor: colors.border,
                    color: colors.foreground,
                    backgroundColor: "transparent",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            {/* Ingredients */}
            <div
              className="text-[10px]"
              style={{ color: colors.mutedForeground }}
            >
              Rom, lime, mynte, sukker, sodavand
            </div>
            {/* Order button */}
            <div
              className="mt-1 w-full rounded-md py-1 text-center text-[10px] font-medium"
              style={{
                backgroundColor: colors.primary,
                color: colors.primaryForeground,
              }}
            >
              Bestil
            </div>
          </div>
        </div>

        {/* Card 2 – missing ingredient */}
        <div
          className="overflow-hidden rounded-xl border"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
          }}
        >
          <div
            className="h-16 w-full"
            style={{ backgroundColor: colors.muted }}
          />
          <div className="space-y-1.5 p-2">
            <div className="flex items-start justify-between gap-1">
              <span
                className="font-semibold leading-tight"
                style={{ color: colors.foreground, fontFamily: "Georgia, serif" }}
              >
                Negroni
              </span>
              <span
                className="shrink-0 rounded-md border px-1 py-0.5 text-[9px] font-semibold"
                style={{
                  backgroundColor: colors.muted,
                  color: colors.mutedForeground,
                  borderColor: "transparent",
                }}
              >
                Mangler 1
              </span>
            </div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <svg
                  key={n}
                  className="h-2.5 w-2.5"
                  viewBox="0 0 20 20"
                  fill={n <= 3 ? colors.primary : "none"}
                  stroke={n <= 3 ? colors.primary : colors.mutedForeground}
                  strokeWidth={1.5}
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span
                className="ml-0.5 text-[9px]"
                style={{ color: colors.mutedForeground }}
              >
                3.1 (5)
              </span>
            </div>
            <div className="flex gap-1">
              <span
                className="rounded-md border px-1 py-0.5 text-[9px] font-semibold"
                style={{
                  borderColor: colors.border,
                  color: colors.foreground,
                }}
              >
                bitter
              </span>
            </div>
            <div
              className="text-[10px]"
              style={{ color: colors.mutedForeground }}
            >
              Gin, Campari, vermouth
            </div>
            {/* Missing */}
            <div
              className="text-[10px]"
              style={{ color: colors.accent }}
            >
              Mangler: Campari
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: destructive example */}
      <div
        className="border-t px-4 py-2"
        style={{ borderColor: colors.border, backgroundColor: colors.muted }}
      >
        <div
          className="flex items-center gap-1.5 rounded-md border px-2 py-1"
          style={{
            backgroundColor: `color-mix(in oklch, ${colors.destructive} 12%, transparent)`,
            borderColor: `color-mix(in oklch, ${colors.destructive} 40%, transparent)`,
          }}
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: colors.destructive }}
          />
          <span
            className="text-[10px]"
            style={{ color: colors.destructive }}
          >
            Eksempel: fejlbesked eller slet-handling
          </span>
        </div>
      </div>
    </div>
  );
}
