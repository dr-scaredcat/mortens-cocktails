import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  getTagStats,
  getSpiritTypeStats,
  getRatingDistribution,
  getTopCocktails,
  getTopSpirits,
  getOrdersOverTime,
  getGuestSeries,
  clearOrderLog,
} from "@/lib/stats.functions";

// ── Farvepalette til linjediagrammer ────────────────────────────────────────
const LINE_COLORS = [
  "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#14b8a6", "#f97316",
];

// Query-nøgler der skal opdateres når statistik nulstilles.
const STAT_KEYS = [
  ["stat-top-cocktails"],
  ["stat-top-spirits"],
  ["stat-orders-time"],
  ["stat-guests"],
] as const;

// ── Periodeknapper ───────────────────────────────────────────────────────────
type Period = "today" | "yesterday" | "week" | "month" | "all";

const PERIODS: { id: Period; label: string }[] = [
  { id: "today",     label: "I dag" },
  { id: "yesterday", label: "I går" },
  { id: "week",      label: "7 dage" },
  { id: "month",     label: "30 dage" },
  { id: "all",       label: "Al tid" },
];

function periodToRange(p: Period): { from: string | null; to: string | null } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const yesterday = (() => {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();

  switch (p) {
    case "today":
      return { from: `${today}T00:00:00`, to: `${today}T23:59:59` };
    case "yesterday":
      return { from: `${yesterday}T00:00:00`, to: `${yesterday}T23:59:59` };
    case "week": {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      const f = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { from: `${f}T00:00:00`, to: `${today}T23:59:59` };
    }
    case "month": {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      const f = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { from: `${f}T00:00:00`, to: `${today}T23:59:59` };
    }
    case "all":
    default:
      return { from: null, to: null };
  }
}

function PeriodButtons({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PERIODS.map((p) => (
        <Button
          key={p.id}
          variant="outline"
          size="sm"
          onClick={() => onChange(p.id)}
          className={
            value === p.id
              ? "border-primary/60 bg-primary/10 text-primary"
              : "text-muted-foreground"
          }
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}

// ── Sektion-wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 font-serif text-xl">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-muted-foreground">Ingen data endnu.</p>;
}

// ── 1. Cocktails pr. tag ────────────────────────────────────────────────────
function TagsChart() {
  const fn = useServerFn(getTagStats);
  const { data, isLoading } = useQuery({ queryKey: ["stat-tags"], queryFn: () => fn() });

  if (isLoading) return <p className="text-sm text-muted-foreground">Indlæser...</p>;
  if (!data || data.length === 0) return <Empty />;

  // Dynamisk højde, så alle tags får plads (mindst 200px).
  const height = Math.max(200, data.length * 30 + 20);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="tag" tick={{ fontSize: 12 }} width={72} interval={0} />
        <Tooltip
          formatter={(v: number) => [`${v} cocktail${v === 1 ? "" : "s"}`, "Antal"]}
          contentStyle={{ fontSize: 13 }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={LINE_COLORS[i % LINE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 1b. Spiritus efter type ──────────────────────────────────────────────────
function SpiritTypesChart() {
  const fn = useServerFn(getSpiritTypeStats);
  const { data, isLoading } = useQuery({ queryKey: ["stat-spirit-types"], queryFn: () => fn() });

  if (isLoading) return <p className="text-sm text-muted-foreground">Indlæser...</p>;
  if (!data || data.length === 0) return <Empty />;

  // Dynamisk højde, så alle typer får plads (mindst 200px).
  const height = Math.max(200, data.length * 30 + 20);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="type" tick={{ fontSize: 12 }} width={72} interval={0} />
        <Tooltip
          formatter={(v: number) => [`${v} spiritus`, "Antal"]}
          contentStyle={{ fontSize: 13 }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={LINE_COLORS[i % LINE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 2. Rating-fordeling ─────────────────────────────────────────────────────
const STAR_LABELS: Record<number, string> = {
  1: "★", 2: "★★", 3: "★★★", 4: "★★★★", 5: "★★★★★",
};

function RatingChart() {
  const fn = useServerFn(getRatingDistribution);
  const { data, isLoading } = useQuery({ queryKey: ["stat-ratings"], queryFn: () => fn() });

  if (isLoading) return <p className="text-sm text-muted-foreground">Indlæser...</p>;
  if (!data || data.every((d) => d.count === 0)) return <Empty />;

  const chartData = data.map((d) => ({ ...d, label: STAR_LABELS[d.rating] }));
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">{total} bedømmelse{total === 1 ? "" : "r"} i alt</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <XAxis dataKey="label" tick={{ fontSize: 14 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(v: number) => [`${v} bedømmelse${v === 1 ? "" : "r"}`, "Antal"]}
            contentStyle={{ fontSize: 13 }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, i) => {
              const colors = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981"];
              return <Cell key={i} fill={colors[entry.rating - 1]} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Genbrugt: vandret "top liste" med søjler ────────────────────────────────
function TopBars({ rows }: { rows: { name: string; count: number }[] }) {
  if (rows.length === 0) return <Empty />;
  const max = rows[0].count;
  return (
    <div className="space-y-3">
      {rows.map((row, i) => {
        const pct = max > 0 ? (row.count / max) * 100 : 0;
        return (
          <div key={row.name} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-right text-sm font-medium text-muted-foreground">
              {i + 1}.
            </span>
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{row.name}</span>
                <span className="text-muted-foreground">
                  {row.count} bestilling{row.count === 1 ? "" : "er"}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResetButton({ onReset }: { onReset: () => void }) {
  return (
    <div className="mt-4 flex justify-end">
      <Button variant="outline" size="sm" onClick={onReset} className="text-muted-foreground">
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        Nulstil data
      </Button>
    </div>
  );
}

// ── 3a. Top 5 mest bestilte cocktails ───────────────────────────────────────
function TopCocktailsChart() {
  const fn = useServerFn(getTopCocktails);
  const clearFn = useServerFn(clearOrderLog);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["stat-top-cocktails"], queryFn: () => fn() });

  async function handleReset() {
    if (!confirm("Nulstil al statistikdata? Dette sletter alle gemte bestillinger fra loggen og kan ikke fortrydes.")) return;
    try {
      await clearFn();
      for (const k of STAT_KEYS) qc.invalidateQueries({ queryKey: k });
      toast.success("Statistikdata nulstillet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke nulstille");
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Indlæser...</p>;

  return (
    <div>
      <TopBars rows={(data ?? []).map((r) => ({ name: r.cocktail_name, count: r.count }))} />
      <ResetButton onReset={handleReset} />
    </div>
  );
}

// ── 3b. Top 5 mest bestilte spiritus ────────────────────────────────────────
function TopSpiritsChart() {
  const fn = useServerFn(getTopSpirits);
  const clearFn = useServerFn(clearOrderLog);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["stat-top-spirits"], queryFn: () => fn() });

  async function handleReset() {
    if (!confirm("Nulstil al statistikdata? Dette sletter alle gemte bestillinger fra loggen og kan ikke fortrydes.")) return;
    try {
      await clearFn();
      for (const k of STAT_KEYS) qc.invalidateQueries({ queryKey: k });
      toast.success("Statistikdata nulstillet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke nulstille");
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Indlæser...</p>;

  return (
    <div>
      <TopBars rows={(data ?? []).map((r) => ({ name: r.spirit_name, count: r.count }))} />
      <ResetButton onReset={handleReset} />
    </div>
  );
}

// ── Hjælpere til "Bestillinger over tid" ────────────────────────────────────
// Et "bar-døgn" skifter rent kl. 05:00 lokal tid: alt før kl. 05:00 hører til
// aftenen før. Så kl. 02:00/04:00 ser man stadig aftenen i går, en aften der
// løber til kl. 04:00 holdes samlet, og visningen skifter først efter kl. 05:00.
const BAR_DAY_CUTOFF_HOUR = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

// Starten (kl. 00:00 lokal) på det kalenderdøgn, et bar-døgn "hører til".
function barDayStart(d: Date): Date {
  const x = new Date(d);
  if (x.getHours() < BAR_DAY_CUTOFF_HOUR) x.setDate(x.getDate() - 1);
  x.setHours(0, 0, 0, 0);
  return x;
}

function barDayKey(d: Date): string {
  const s = barDayStart(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
}

// Absolut [from, to) for et bar-døgn ud fra dets dato (kl. 00:00 lokal).
function barDayWindow(dayStart: Date): { from: Date; to: Date } {
  const from = new Date(dayStart.getTime() + BAR_DAY_CUTOFF_HOUR * HOUR_MS);
  const to = new Date(from.getTime() + DAY_MS);
  return { from, to };
}

// Range til serveren (absolutte instant'er). Bruges KUN af bestillinger-over-tid.
function ordersPeriodToRange(p: Period): { from: string | null; to: string | null } {
  const todayStart = barDayStart(new Date());
  const minus = (d: Date, n: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() - n);
    return x;
  };
  switch (p) {
    case "today": {
      const w = barDayWindow(todayStart);
      return { from: w.from.toISOString(), to: w.to.toISOString() };
    }
    case "yesterday": {
      const w = barDayWindow(minus(todayStart, 1));
      return { from: w.from.toISOString(), to: w.to.toISOString() };
    }
    case "week": {
      const w0 = barDayWindow(minus(todayStart, 6));
      const w1 = barDayWindow(todayStart);
      return { from: w0.from.toISOString(), to: w1.to.toISOString() };
    }
    case "month": {
      const w0 = barDayWindow(minus(todayStart, 29));
      const w1 = barDayWindow(todayStart);
      return { from: w0.from.toISOString(), to: w1.to.toISOString() };
    }
    case "all":
    default:
      return { from: null, to: null };
  }
}

// X-akse-streger i hele/halve timer (I dag / I går).
function hourTicks(minMs: number, maxMs: number): number[] {
  const spanH = (maxMs - minMs) / HOUR_MS;
  const stepMin = spanH <= 4 ? 30 : spanH <= 8 ? 60 : 120;
  const step = stepMin * MIN_MS;
  const base = new Date(minMs);
  base.setMinutes(stepMin === 30 ? (base.getMinutes() < 30 ? 0 : 30) : 0, 0, 0);
  const ticks: number[] = [];
  for (let t = base.getTime(); t <= maxMs; t += step) {
    if (t >= minMs) ticks.push(t);
  }
  return ticks;
}

// X-akse-streger i hele dage (7 dage / 30 dage / al tid), ca. 7 streger.
function dayTicks(minMs: number, maxMs: number): number[] {
  const spanDays = Math.max(1, Math.round((maxMs - minMs) / DAY_MS));
  const stepDays = Math.max(1, Math.ceil(spanDays / 7));
  const start = new Date(minMs);
  start.setHours(12, 0, 0, 0);
  let t = start.getTime();
  if (t < minMs) t += DAY_MS;
  const ticks: number[] = [];
  for (; t <= maxMs; t += stepDays * DAY_MS) ticks.push(t);
  return ticks;
}

// ── 4. Bestillinger over tid ────────────────────────────────────────────────
type HourMode = "rate" | "cumulative";

function OrdersOverTimeChart() {
  const [period, setPeriod] = useState<Period>("all");
  // Kun relevant på I dag / I går: vis antal pr. bestilling ("rate") eller
  // en løbende, kumuleret total hen over aftenen ("cumulative").
  const [hourMode, setHourMode] = useState<HourMode>("rate");
  const range = useMemo(() => ordersPeriodToRange(period), [period]);
  const fn = useServerFn(getOrdersOverTime);
  const clearFn = useServerFn(clearOrderLog);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["stat-orders-time", period],
    queryFn: () => fn({ data: { from: range.from, to: range.to } }),
  });

  async function handleReset() {
    if (!confirm("Nulstil al statistikdata? Dette sletter alle gemte bestillinger fra loggen og kan ikke fortrydes.")) return;
    try {
      await clearFn();
      for (const k of STAT_KEYS) qc.invalidateQueries({ queryKey: k });
      toast.success("Statistikdata nulstillet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke nulstille");
    }
  }

  const isHourly = period === "today" || period === "yesterday";

  const { points, domain, ticks } = useMemo(() => {
    const rows = (data ?? []) as { t: string; q: number }[];
    if (rows.length === 0) {
      return { points: [], domain: [0, 1] as [number, number], ticks: [] as number[] };
    }

    if (isHourly) {
      // Ét punkt pr. bestilling, på dens eksakte tid.
      const pts = rows
        .map((r) => ({ t: new Date(r.t).getTime(), y: r.q }))
        .sort((a, b) => a.t - b.t);
      // Kumuleret: erstat y med den løbende sum hen over aftenen.
      if (hourMode === "cumulative") {
        let cum = 0;
        for (const p of pts) {
          cum += p.y;
          p.y = cum;
        }
      }
      let min = pts[0].t;
      let max = pts[pts.length - 1].t;
      if (min === max) {
        min -= 30 * MIN_MS;
        max += 30 * MIN_MS;
      }
      return { points: pts, domain: [min, max] as [number, number], ticks: hourTicks(min, max) };
    }

    // 7 dage / 30 dage / al tid: ét punkt pr. bar-døgn med bestillinger.
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const k = barDayKey(new Date(r.t));
      byDay.set(k, (byDay.get(k) ?? 0) + r.q);
    }
    const pts = Array.from(byDay.entries())
      .map(([key, y]) => {
        const [yy, mm, dd] = key.split("-").map(Number);
        const noon = new Date(yy, mm - 1, dd, 12, 0, 0, 0).getTime();
        return { t: noon, y };
      })
      .sort((a, b) => a.t - b.t);

    let min: number;
    let max: number;
    if (period === "all") {
      min = pts[0].t;
      max = pts[pts.length - 1].t;
      if (min === max) {
        min -= 12 * HOUR_MS;
        max += 12 * HOUR_MS;
      }
    } else {
      // Fast vindue, så 1 dag = 1/7 (uge) hhv. 1/30 (måned) af aksen.
      min = new Date(range.from!).getTime();
      max = new Date(range.to!).getTime();
    }
    return { points: pts, domain: [min, max] as [number, number], ticks: dayTicks(min, max) };
  }, [data, isHourly, period, range.from, range.to, hourMode]);

  const fmtTick = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, "0");
    if (isHourly) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const total = ((data ?? []) as { q: number }[]).reduce((s, r) => s + r.q, 0);
  const cumulative = isHourly && hourMode === "cumulative";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} bestilling{total === 1 ? "" : "er"} i perioden
        </p>
        <PeriodButtons value={period} onChange={setPeriod} />
      </div>

      {isHourly && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {([
            { id: "rate", label: "Antal" },
            { id: "cumulative", label: "Kumuleret" },
          ] as { id: HourMode; label: string }[]).map((m) => (
            <Button
              key={m.id}
              variant="outline"
              size="sm"
              onClick={() => setHourMode(m.id)}
              className={
                hourMode === m.id
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "text-muted-foreground"
              }
            >
              {m.label}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Indlæser...</p>
      ) : points.length === 0 ? (
        <Empty />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={points} margin={{ left: 0, right: 16, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={domain}
              ticks={ticks}
              tickFormatter={fmtTick}
              tick={{ fontSize: 11 }}
              allowDataOverflow
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
            <Tooltip
              labelFormatter={(ms: number) => {
                const d = new Date(Number(ms));
                const pad = (n: number) => String(n).padStart(2, "0");
                const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                return isHourly ? `${date} kl. ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
              }}
              formatter={(v: number) =>
                cumulative
                  ? [`${v} bestilling${v === 1 ? "" : "er"} i alt`, "Kumuleret"]
                  : [`${v} bestilling${v === 1 ? "" : "er"}`, "Antal"]
              }
              contentStyle={{ fontSize: 13 }}
            />
            <Line
              type={cumulative ? "monotone" : "linear"}
              dataKey="y"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      <ResetButton onReset={handleReset} />
    </div>
  );
}

// Valgmuligheder for antal gæster i "hvem bestiller mest".
const GUEST_LIMITS = [5, 10, 15, 20] as const;
const GUEST_LIMIT_MAX = 50; // skal matche serverens clamp i getGuestSeries

// Distinkte farver til et vilkårligt antal gæst-linjer: jævnt fordelte nuancer
// rundt i farvehjulet, med vekslende lyshed så nabolinjer adskiller sig ekstra.
function guestColors(n: number): string[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => {
    const hue = Math.round((i * 360) / n);
    const light = i % 2 === 0 ? 55 : 42;
    return `hsl(${hue}, 68%, ${light}%)`;
  });
}

// ── 5. Gæster — kumuleret linjediagram ─────────────────────────────────────
function GuestSeriesChart() {
  const [period, setPeriod] = useState<Period>("all");
  const [limit, setLimit] = useState<number>(10);
  const [customActive, setCustomActive] = useState<boolean>(false);
  const [customValue, setCustomValue] = useState<string>("");
  const range = useMemo(() => periodToRange(period), [period]);
  const fn = useServerFn(getGuestSeries);
  const clearFn = useServerFn(clearOrderLog);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["stat-guests", period, limit],
    queryFn: () => fn({ data: { from: range.from, to: range.to, limit } }),
  });

  async function handleReset() {
    if (!confirm("Nulstil al statistikdata? Dette sletter alle gemte bestillinger fra loggen og kan ikke fortrydes.")) return;
    try {
      await clearFn();
      for (const k of STAT_KEYS) qc.invalidateQueries({ queryKey: k });
      toast.success("Statistikdata nulstillet");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke nulstille");
    }
  }

  // Byg fladt datasæt til Recharts: array af {time, [navn]: kumTotal}
  const { chartData, guests } = useMemo(() => {
    if (!data || data.length === 0) return { chartData: [], guests: [] };
    const guests = data.map((g) => g.customer_name);
    const allTimes = Array.from(
      new Set(data.flatMap((g) => g.series.map((p) => p.time)))
    ).sort();
    const chartData = allTimes.map((t) => {
      const row: Record<string, string | number> = { time: t };
      for (const g of data) {
        const point = g.series.find((p) => p.time === t);
        row[g.customer_name] = point?.cumulative ?? 0;
      }
      return row;
    });
    return { chartData, guests };
  }, [data]);

  const formatTime = (key: string) => {
    if (key.includes("T")) return key.slice(11, 16);
    const [, m, d] = key.split("-");
    return `${d}/${m}`;
  };

  const colors = useMemo(() => guestColors(guests.length), [guests.length]);

  const total = data?.reduce((s, g) => s + g.total, 0) ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} bestilling{total === 1 ? "" : "er"} · viser top {guests.length} gæst{guests.length === 1 ? "" : "er"}
        </p>
        <PeriodButtons value={period} onChange={setPeriod} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-sm text-muted-foreground">Antal gæster:</span>
        {GUEST_LIMITS.map((n) => (
          <Button
            key={n}
            variant="outline"
            size="sm"
            onClick={() => {
              setLimit(n);
              setCustomActive(false);
            }}
            className={
              !customActive && limit === n
                ? "border-primary/60 bg-primary/10 text-primary"
                : "text-muted-foreground"
            }
          >
            {n}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCustomActive(true)}
          className={
            customActive
              ? "border-primary/60 bg-primary/10 text-primary"
              : "text-muted-foreground"
          }
        >
          Indtast selv
        </Button>
        {customActive && (
          <input
            type="number"
            min={1}
            max={GUEST_LIMIT_MAX}
            value={customValue}
            placeholder="antal"
            autoFocus
            onChange={(e) => {
              setCustomValue(e.target.value);
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) {
                setLimit(Math.min(GUEST_LIMIT_MAX, Math.max(1, n)));
              }
            }}
            className="h-9 w-20 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
          />
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Indlæser...</p>
      ) : !data || data.length === 0 ? (
        <Empty />
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(l: string) => {
                if (l.includes("T")) {
                  const [date, time] = l.split("T");
                  const [y, m, d] = date.split("-");
                  return `${d}/${m}/${y} kl. ${time.slice(0, 5)}`;
                }
                const [y, m, d] = l.split("-");
                return `${d}/${m}/${y}`;
              }}
              formatter={(v: number, name: string) => [`${v} bestilling${v === 1 ? "" : "er"}`, name]}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend />
            {guests.map((name, i) => (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={colors[i] ?? "#8b5cf6"}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
      <ResetButton onReset={handleReset} />
    </div>
  );
}

// ── Hoved-komponent ─────────────────────────────────────────────────────────
export function AdminStatistik() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Overblik over cocktails, bedømmelser og bestillingshistorik.
      </p>

      <Section title="Cocktails pr. tag">
        <TagsChart />
      </Section>

      <Section title="Spiritus efter type">
        <SpiritTypesChart />
      </Section>

      <Section title="Rating-fordeling">
        <RatingChart />
      </Section>

      <Section title="Top 5 mest bestilte cocktails">
        <TopCocktailsChart />
      </Section>

      <Section title="Top 5 mest bestilte spiritus">
        <TopSpiritsChart />
      </Section>

      <Section title="Bestillinger over tid">
        <OrdersOverTimeChart />
      </Section>

      <Section title="Gæster — hvem bestiller mest">
        <GuestSeriesChart />
      </Section>
    </div>
  );
}
