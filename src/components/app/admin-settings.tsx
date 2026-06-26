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
import { Wine, Martini, AlignStartVertical, AlignCenterVertical, AlignEndVertical } from "lucide-react";
import {
  getOrderingEnabled,
  setOrderingEnabled,
  getSiteName,
  setSiteName,
  getLogoSize,
  setLogoSize,
  getTextSize,
  setTextSize,
  getLogoGap,
  setLogoGap,
  getLogoAlign,
  setLogoAlign,
  getLogoType,
  setLogoType,
  DEFAULT_LOGO_SIZE,
  DEFAULT_TEXT_SIZE,
  DEFAULT_LOGO_GAP,
  DEFAULT_LOGO_ALIGN,
  DEFAULT_LOGO_TYPE,
  type LogoType,
  type LogoAlign,
} from "@/lib/orders.functions";
import { AdminCategories } from "@/components/app/admin-categories";
import { AdminUsers } from "@/components/app/admin-users";
import { AdminThemes } from "@/components/app/admin-themes";
import { BarskabLogo } from "@/components/app/barskab-logo";
import { SiteLogo } from "@/components/app/site-logo";
import { cn } from "@/lib/utils";

const LOGO_OPTIONS: { type: LogoType; label: string }[] = [
  { type: "barskab", label: "Barskab" },
  { type: "martini", label: "Martini" },
  { type: "wine", label: "Vinglas" },
];

const ALIGN_OPTIONS: { align: LogoAlign; label: string; icon: React.ReactNode }[] = [
  { align: "top", label: "Top", icon: <AlignStartVertical className="h-4 w-4 rotate-90" /> },
  { align: "center", label: "Midt", icon: <AlignCenterVertical className="h-4 w-4 rotate-90" /> },
  { align: "bottom", label: "Bund", icon: <AlignEndVertical className="h-4 w-4 rotate-90" /> },
];

const alignClass: Record<LogoAlign, string> = {
  top: "items-start",
  center: "items-center",
  bottom: "items-end",
};

function SliderRow({
  label,
  value,
  min,
  max,
  unit = "px",
  onChange,
  onSave,
  busy,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-sm text-muted-foreground tabular-nums">{value}{unit}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-6 text-right text-xs text-muted-foreground">{min}</span>
        <Slider
          min={min}
          max={max}
          step={1}
          value={[value]}
          onValueChange={([val]) => onChange(val)}
          className="flex-1"
        />
        <span className="w-8 text-xs text-muted-foreground">{max}</span>
        <Button size="sm" onClick={onSave} disabled={busy} className="shrink-0">
          {busy ? "…" : "Gem"}
        </Button>
      </div>
    </div>
  );
}

export function AdminSettings() {
  const fetchSetting = useServerFn(getOrderingEnabled);
  const updateSetting = useServerFn(setOrderingEnabled);
  const fetchSiteName = useServerFn(getSiteName);
  const updateSiteName = useServerFn(setSiteName);
  const fetchLogoSize = useServerFn(getLogoSize);
  const updateLogoSize = useServerFn(setLogoSize);
  const fetchTextSize = useServerFn(getTextSize);
  const updateTextSize = useServerFn(setTextSize);
  const fetchLogoGap = useServerFn(getLogoGap);
  const updateLogoGap = useServerFn(setLogoGap);
  const fetchLogoAlign = useServerFn(getLogoAlign);
  const updateLogoAlign = useServerFn(setLogoAlign);
  const fetchLogoType = useServerFn(getLogoType);
  const updateLogoType = useServerFn(setLogoType);
  const qc = useQueryClient();

  const { data: orderingData, isLoading: orderingLoading } = useQuery({
    queryKey: ["ordering-enabled"],
    queryFn: () => fetchSetting(),
  });
  const { data: siteNameData, isLoading: siteNameLoading } = useQuery({
    queryKey: ["site-name"],
    queryFn: () => fetchSiteName(),
  });
  const { data: logoSizeData } = useQuery({ queryKey: ["logo-size"], queryFn: () => fetchLogoSize() });
  const { data: textSizeData } = useQuery({ queryKey: ["text-size"], queryFn: () => fetchTextSize() });
  const { data: logoGapData } = useQuery({ queryKey: ["logo-gap"], queryFn: () => fetchLogoGap() });
  const { data: logoAlignData } = useQuery({ queryKey: ["logo-align"], queryFn: () => fetchLogoAlign() });
  const { data: logoTypeData } = useQuery({ queryKey: ["logo-type"], queryFn: () => fetchLogoType() });

  const [siteName, setSiteNameLocal] = useState("");
  const [siteNameBusy, setSiteNameBusy] = useState(false);
  const [logoSize, setLogoSizeLocal] = useState(DEFAULT_LOGO_SIZE);
  const [logoSizeBusy, setLogoSizeBusy] = useState(false);
  const [textSize, setTextSizeLocal] = useState(DEFAULT_TEXT_SIZE);
  const [textSizeBusy, setTextSizeBusy] = useState(false);
  const [logoGap, setLogoGapLocal] = useState(DEFAULT_LOGO_GAP);
  const [logoGapBusy, setLogoGapBusy] = useState(false);
  const [logoAlign, setLogoAlignLocal] = useState<LogoAlign>(DEFAULT_LOGO_ALIGN);
  const [logoAlignBusy, setLogoAlignBusy] = useState(false);
  const [logoType, setLogoTypeLocal] = useState<LogoType>(DEFAULT_LOGO_TYPE);
  const [logoTypeBusy, setLogoTypeBusy] = useState(false);

  useEffect(() => { if (siteNameData?.name) setSiteNameLocal(siteNameData.name); }, [siteNameData]);
  useEffect(() => { if (logoSizeData?.size) setLogoSizeLocal(logoSizeData.size); }, [logoSizeData]);
  useEffect(() => { if (textSizeData?.size) setTextSizeLocal(textSizeData.size); }, [textSizeData]);
  useEffect(() => { if (logoGapData?.gap !== undefined) setLogoGapLocal(logoGapData.gap); }, [logoGapData]);
  useEffect(() => { if (logoAlignData?.align) setLogoAlignLocal(logoAlignData.align); }, [logoAlignData]);
  useEffect(() => { if (logoTypeData?.type) setLogoTypeLocal(logoTypeData.type); }, [logoTypeData]);

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
      toast.success("Sidenavn gemt");
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
      toast.success("Logostørrelse gemt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setLogoSizeBusy(false);
    }
  }

  async function saveTextSize() {
    setTextSizeBusy(true);
    try {
      await updateTextSize({ data: { size: textSize } });
      qc.invalidateQueries({ queryKey: ["text-size"] });
      toast.success("Tekststørrelse gemt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setTextSizeBusy(false);
    }
  }

  async function saveLogoGap() {
    setLogoGapBusy(true);
    try {
      await updateLogoGap({ data: { gap: logoGap } });
      qc.invalidateQueries({ queryKey: ["logo-gap"] });
      toast.success("Afstand gemt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setLogoGapBusy(false);
    }
  }

  async function selectLogoAlign(align: LogoAlign) {
    setLogoAlignLocal(align);
    setLogoAlignBusy(true);
    try {
      await updateLogoAlign({ data: { align } });
      qc.invalidateQueries({ queryKey: ["logo-align"] });
      toast.success("Justering gemt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setLogoAlignBusy(false);
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

  return (
    <div className="space-y-10">
      {/* Sidenavn + logo-indstillinger */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Sidenavn
        </h2>
        <Card className="divide-y divide-border overflow-hidden p-0">

          {/* Navn */}
          <div className="space-y-3 p-4">
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
          <div className="space-y-3 p-4">
            <div>
              <Label className="text-base">Logo</Label>
              <p className="text-sm text-muted-foreground">Vælg hvilket logo der vises i headeren.</p>
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

          {/* Størrelser + afstand */}
          <div className="space-y-5 p-4">
            <Label className="text-base">Størrelse og afstand</Label>
            <SliderRow
              label="Logostørrelse"
              value={logoSize}
              min={8}
              max={100}
              onChange={setLogoSizeLocal}
              onSave={saveLogoSize}
              busy={logoSizeBusy}
            />
            <SliderRow
              label="Tekststørrelse"
              value={textSize}
              min={8}
              max={100}
              onChange={setTextSizeLocal}
              onSave={saveTextSize}
              busy={textSizeBusy}
            />
            <SliderRow
              label="Afstand"
              value={logoGap}
              min={0}
              max={48}
              onChange={setLogoGapLocal}
              onSave={saveLogoGap}
              busy={logoGapBusy}
            />
          </div>

          {/* Tekstjustering */}
          <div className="space-y-3 p-4">
            <div>
              <Label className="text-base">Tekstjustering</Label>
              <p className="text-sm text-muted-foreground">
                Hvor teksten er placeret i forhold til logoet.
              </p>
            </div>
            <div className="flex gap-2">
              {ALIGN_OPTIONS.map(({ align, label, icon }) => (
                <button
                  key={align}
                  onClick={() => selectLogoAlign(align)}
                  disabled={logoAlignBusy}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 px-4 py-3 transition-colors",
                    logoAlign === align
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {icon}
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Forhåndsvisning */}
          <div className="p-4">
            <Label className="mb-2 block text-base">Forhåndsvisning</Label>
            <div
              className={cn("flex rounded-md border border-border bg-muted px-3 py-2", alignClass[logoAlign])}
              style={{ gap: logoGap }}
            >
              <SiteLogo type={logoType} size={logoSize} className="shrink-0 text-primary" />
              <span className="font-serif leading-none text-foreground" style={{ fontSize: textSize }}>
                {siteName || "Barskab"}
              </span>
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
              checked={!!orderingData?.enabled}
              disabled={orderingLoading}
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
