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

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="tag" tick={{ fontSize: 12 }} width={72} />
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

// ── 4. Bestillinger over tid ────────────────────────────────────────────────
function OrdersOverTimeChart() {
  const [period, setPeriod] = useState<Period>("all");
  const range = useMemo(() => periodToRange(period), [period]);
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

  const formatX = (key: string) => {
    // key er enten YYYY-MM-DD eller YYYY-MM-DDTHH:00
    if (key.includes("T")) {
      // Time-format
      return key.slice(11, 16); // HH:MM
    }
    const [, m, d] = key.split("-");
    return `${d}/${m}`;
  };

  const total = (data ?? []).reduce((s, d) => s + d.count, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} bestilling{total === 1 ? "" : "er"} i perioden
        </p>
        <PeriodButtons value={period} onChange={setPeriod} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Indlæser...</p>
      ) : !data || data.length === 0 ? (
        <Empty />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
            <XAxis
              dataKey="bucket"
              tickFormatter={formatX}
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
              formatter={(v: number) => [`${v} bestilling${v === 1 ? "" : "er"}`, "Antal"]}
              contentStyle={{ fontSize: 13 }}
            />
            <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <ResetButton onReset={handleReset} />
    </div>
  );
}

// ── 5. Gæster — kumuleret linjediagram ─────────────────────────────────────
function GuestSeriesChart() {
  const [period, setPeriod] = useState<Period>("all");
  const range = useMemo(() => periodToRange(period), [period]);
  const fn = useServerFn(getGuestSeries);
  const clearFn = useServerFn(clearOrderLog);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["stat-guests", period],
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

  const total = data?.reduce((s, g) => s + g.total, 0) ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} bestilling{total === 1 ? "" : "er"} · viser top {guests.length} gæst{guests.length === 1 ? "" : "er"}
        </p>
        <PeriodButtons value={period} onChange={setPeriod} />
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
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
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
