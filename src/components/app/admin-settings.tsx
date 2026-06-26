import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Wine, Martini } from "lucide-react";
import {
  getOrderingEnabled,
  setOrderingEnabled,
  getSiteName,
  setSiteName,
  getLogoSize,
  setLogoSize,
  getLogoType,
  setLogoType,
  DEFAULT_LOGO_SIZE,
  DEFAULT_LOGO_TYPE,
  type LogoType,
} from "@/lib/orders.functions";
import { AdminCategories } from "@/components/app/admin-categories";
import { AdminUsers } from "@/components/app/admin-users";
import { AdminThemes } from "@/components/app/admin-themes";
import { BarskabLogo } from "@/components/app/barskab-logo";
import { cn } from "@/lib/utils";

const LOGO_OPTIONS: { type: LogoType; label: string }[] = [
  { type: "barskab", label: "Barskab" },
  { type: "martini", label: "Martini" },
  { type: "wine", label: "Vinglas" },
];

export function AdminSettings() {
  const fetchSetting = useServerFn(getOrderingEnabled);
  const updateSetting = useServerFn(setOrderingEnabled);
  const fetchSiteName = useServerFn(getSiteName);
  const updateSiteName = useServerFn(setSiteName);
  const fetchLogoSize = useServerFn(getLogoSize);
  const updateLogoSize = useServerFn(setLogoSize);
  const fetchLogoType = useServerFn(getLogoType);
  const updateLogoType = useServerFn(setLogoType);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ordering-enabled"],
    queryFn: () => fetchSetting(),
  });

  const { data: siteNameData, isLoading: siteNameLoading } = useQuery({
    queryKey: ["site-name"],
    queryFn: () => fetchSiteName(),
  });

  const { data: logoSizeData } = useQuery({
    queryKey: ["logo-size"],
    queryFn: () => fetchLogoSize(),
  });

  const { data: logoTypeData } = useQuery({
    queryKey: ["logo-type"],
    queryFn: () => fetchLogoType(),
  });

  const [siteName, setSiteNameLocal] = useState("");
  const [siteNameBusy, setSiteNameBusy] = useState(false);
  const [logoSize, setLogoSizeLocal] = useState(DEFAULT_LOGO_SIZE);
  const [logoSizeBusy, setLogoSizeBusy] = useState(false);
  const [logoType, setLogoTypeLocal] = useState<LogoType>(DEFAULT_LOGO_TYPE);
  const [logoTypeBusy, setLogoTypeBusy] = useState(false);

  useEffect(() => {
    if (siteNameData?.name) setSiteNameLocal(siteNameData.name);
  }, [siteNameData]);

  useEffect(() => {
    if (logoSizeData?.size) setLogoSizeLocal(logoSizeData.size);
  }, [logoSizeData]);

  useEffect(() => {
    if (logoTypeData?.type) setLogoTypeLocal(logoTypeData.type);
  }, [logoTypeData]);

  async function toggle(enabled: boolean) {
    try {
      await updateSetting({ data: { enabled } });
      qc.invalidateQueries({ queryKey: ["ordering-enabled"] });
      toast.success(enabled ? "Bestillinger er slået til" : "Bestillinger er slået fra");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    }
  }

  async function saveSiteName() {
    const trimmed = siteName.trim();
    if (!trimmed) return toast.error("Sidenavn må ikke være tomt");
    setSiteNameBusy(true);
    try {
      await updateSiteName({ data: { name: trimmed } });
      qc.invalidateQueries({ queryKey: ["site-name"] });
      toast.success("Sidenavn gemt — genindlæs siden for at se ændringen i browser-titlen");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setSiteNameBusy(false);
    }
  }

  async function saveLogoSize() {
    setLogoSizeBusy(true);
    try {
      await updateLogoSize({ data: { size: logoSize } });
      qc.invalidateQueries({ queryKey: ["logo-size"] });
      toast.success("Størrelse gemt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setLogoSizeBusy(false);
    }
  }

  async function selectLogoType(type: LogoType) {
    setLogoTypeLocal(type);
    setLogoTypeBusy(true);
    try {
      await updateLogoType({ data: { type } });
      qc.invalidateQueries({ queryKey: ["logo-type"] });
      toast.success("Logo gemt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setLogoTypeBusy(false);
    }
  }

  const textSize = Math.round(logoSize / 2);

  return (
    <div className="space-y-10">
      {/* Sidenavn, logo og størrelse — samlet */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Sidenavn
        </h2>
        <Card className="divide-y divide-border p-0 overflow-hidden">

          {/* Navn */}
          <div className="p-4 space-y-3">
            <div>
              <Label htmlFor="site-name-input" className="text-base">Navn</Label>
              <p className="text-sm text-muted-foreground">
                Vises i headeren og browser-titlen på alle sider.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                id="site-name-input"
                value={siteName}
                onChange={(e) => setSiteNameLocal(e.target.value)}
                placeholder="fx Barskab"
                maxLength={60}
                disabled={siteNameLoading}
                className="max-w-sm"
                onKeyDown={(e) => { if (e.key === "Enter") saveSiteName(); }}
              />
              <Button onClick={saveSiteName} disabled={siteNameBusy || siteNameLoading}>
                {siteNameBusy ? "Gemmer…" : "Gem"}
              </Button>
            </div>
          </div>

          {/* Logo-vælger */}
          <div className="p-4 space-y-3">
            <div>
              <Label className="text-base">Logo</Label>
              <p className="text-sm text-muted-foreground">
                Vælg hvilket logo der vises i headeren.
              </p>
            </div>
            <div className="flex gap-2">
              {LOGO_OPTIONS.map(({ type, label }) => {
                const isActive = logoType === type;
                return (
                  <button
                    key={type}
                    onClick={() => selectLogoType(type)}
                    disabled={logoTypeBusy}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border-2 px-4 py-3 transition-colors",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {type === "barskab" && <BarskabLogo style={{ width: 24, height: 24 }} />}
                    {type === "martini" && <Martini className="h-6 w-6" />}
                    {type === "wine" && <Wine className="h-6 w-6" />}
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Størrelse */}
          <div className="p-4 space-y-3">
            <div>
              <Label className="text-base">Størrelse</Label>
              <p className="text-sm text-muted-foreground">
                Logo: {logoSize}px — Titel: {textSize}px
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-8 text-right text-xs text-muted-foreground">16</span>
              <Slider
                min={16}
                max={48}
                step={1}
                value={[logoSize]}
                onValueChange={([val]) => setLogoSizeLocal(val)}
                className="flex-1"
              />
              <span className="w-8 text-xs text-muted-foreground">48</span>
            </div>
            {/* Forhåndsvisning + gem */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                {logoType === "barskab" && (
                  <BarskabLogo className="shrink-0 text-primary" style={{ width: logoSize, height: logoSize }} />
                )}
                {logoType === "martini" && (
                  <Martini className="shrink-0 text-primary" style={{ width: logoSize, height: logoSize }} />
                )}
                {logoType === "wine" && (
                  <Wine className="shrink-0 text-primary" style={{ width: logoSize, height: logoSize }} />
                )}
                <span className="font-serif leading-none" style={{ fontSize: textSize }}>
                  {siteName || "Barskab"}
                </span>
              </div>
              <Button onClick={saveLogoSize} disabled={logoSizeBusy}>
                {logoSizeBusy ? "Gemmer…" : "Gem størrelse"}
              </Button>
            </div>
          </div>

        </Card>
      </section>

      {/* Bestillinger */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Bestillinger
        </h2>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="ordering-toggle" className="text-base">Bestillinger</Label>
              <p className="text-sm text-muted-foreground">
                Når slået fra, kan gæsterne ikke bestille fra menukortet.
              </p>
            </div>
            <Switch
              id="ordering-toggle"
              checked={!!data?.enabled}
              disabled={isLoading}
              onCheckedChange={toggle}
            />
          </div>
        </Card>
      </section>

      {/* Kategorier */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Kategorier
        </h2>
        <AdminCategories />
      </section>

      {/* Brugere */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Brugere
        </h2>
        <AdminUsers />
      </section>

      {/* Temaer */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Temaer
        </h2>
        <AdminThemes />
      </section>
    </div>
  );
}
