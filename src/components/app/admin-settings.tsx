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
import { Wine, Martini, AlignStartVertical, AlignCenterVertical, AlignEndVertical, ImagePlus } from "lucide-react";
import {
  getOrderingEnabled,
  setOrderingEnabled,
  getSiteSettings,
  setSiteName,
  setLogoSize,
  setTextSize,
  setLogoGap,
  setLogoAlign,
  setLogoType,
  setTextOffsetY,
  DEFAULT_LOGO_SIZE,
  DEFAULT_TEXT_SIZE,
  DEFAULT_LOGO_GAP,
  DEFAULT_LOGO_ALIGN,
  DEFAULT_LOGO_TYPE,
  DEFAULT_TEXT_OFFSET_Y,
  type LogoType,
  type LogoAlign,
} from "@/lib/orders.functions";
import { AdminCategories } from "@/components/app/admin-categories";
import { AdminUsers } from "@/components/app/admin-users";
import { AdminThemes } from "@/components/app/admin-themes";
import { BarskabLogo } from "@/components/app/barskab-logo";
import { SiteLogo } from "@/components/app/site-logo";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-utils";

const LOGO_OPTIONS: { type: LogoType; label: string }[] = [
  { type: "barskab", label: "Aston" },
  { type: "martini", label: "Martini" },
  { type: "wine", label: "Vinglas" },
  { type: "custom", label: "PNG-fil" },
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
  const fetchSettings = useServerFn(getSiteSettings);
  const updateSiteName = useServerFn(setSiteName);
  const updateLogoSize = useServerFn(setLogoSize);
  const updateTextSize = useServerFn(setTextSize);
  const updateLogoGap = useServerFn(setLogoGap);
  const updateLogoAlign = useServerFn(setLogoAlign);
  const updateLogoType = useServerFn(setLogoType);
  const updateTextOffsetY = useServerFn(setTextOffsetY);
  const qc = useQueryClient();

  const { data: orderingData, isLoading: orderingLoading } = useQuery({
    queryKey: ["ordering-enabled"],
    queryFn: () => fetchSetting(),
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => fetchSettings(),
    staleTime: 1000 * 60 * 5,
  });

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
  const [textOffsetY, setTextOffsetYLocal] = useState(DEFAULT_TEXT_OFFSET_Y);
  const [textOffsetYBusy, setTextOffsetYBusy] = useState(false);

  // ── Billedkomprimering ──────────────────────────────────────────────────
  const [compressing, setCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState<string | null>(null);

  async function compressAllImages() {
    setCompressing(true);
    setCompressProgress("Henter billedeliste...");
    try {
      // List alle filer i bucketet
      const { data: files, error: listErr } = await supabase.storage
        .from("cocktail-images")
        .list("", { limit: 1000 });
      if (listErr) throw new Error(listErr.message);

      const imageFiles = (files ?? []).filter((f) =>
        /\.(jpe?g|png|webp|gif|heic|avif)$/i.test(f.name),
      );

      if (imageFiles.length === 0) {
        toast.success("Ingen billeder fundet i bucketet");
        return;
      }

      let done = 0;
      let skipped = 0;
      let failed = 0;

      for (const file of imageFiles) {
        setCompressProgress(`Komprimerer ${done + 1} / ${imageFiles.length}: ${file.name}`);
        try {
          // Hent billedet som blob
          const { data: dlData, error: dlErr } = await supabase.storage
            .from("cocktail-images")
            .download(file.name);
          if (dlErr || !dlData) { failed++; continue; }

          const originalSize = dlData.size;

          // Konvertér til File-objekt så compressImage kan bruge det
          const originalFile = new File([dlData], file.name, { type: dlData.type || "image/jpeg" });

          // Komprimer
          const compressed = await compressImage(originalFile);

          // Spring over hvis ikke mindst 10% mindre (undgå at re-uploade allerede komprimerede)
          if (compressed.size >= originalSize * 0.9) { skipped++; continue; }

          // Upload tilbage med samme filnavn (upsert)
          const { error: upErr } = await supabase.storage
            .from("cocktail-images")
            .upload(file.name, compressed, {
              upsert: true,
              contentType: "image/jpeg",
            });
          if (upErr) { failed++; continue; }

          done++;
        } catch {
          failed++;
        }
      }

      const parts = [`${done} billeder komprimeret`];
      if (skipped > 0) parts.push(`${skipped} allerede optimerede`);
      if (failed > 0) parts.push(`${failed} fejlede`);
      toast.success(parts.join(" · "));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Komprimering fejlede");
    } finally {
      setCompressing(false);
      setCompressProgress(null);
    }
  }

  useEffect(() => {
    if (!settings) return;
    setSiteNameLocal(settings.name);
    setLogoSizeLocal(settings.logoSize);
    setTextSizeLocal(settings.textSize);
    setLogoGapLocal(settings.logoGap);
    setLogoAlignLocal(settings.logoAlign);
    setLogoTypeLocal(settings.logoType);
    setTextOffsetYLocal(settings.textOffsetY ?? DEFAULT_TEXT_OFFSET_Y);
  }, [settings]);

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
      qc.invalidateQueries({ queryKey: ["site-settings"] });
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
      qc.invalidateQueries({ queryKey: ["site-settings"] });
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
      qc.invalidateQueries({ queryKey: ["site-settings"] });
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
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Afstand gemt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setLogoGapBusy(false);
    }
  }

  async function saveTextOffsetY() {
    setTextOffsetYBusy(true);
    try {
      await updateTextOffsetY({ data: { offset: textOffsetY } });
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Vertikal afstand gemt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setTextOffsetYBusy(false);
    }
  }

  async function selectLogoAlign(align: LogoAlign) {
    setLogoAlignLocal(align);
    setLogoAlignBusy(true);
    try {
      await updateLogoAlign({ data: { align } });
      qc.invalidateQueries({ queryKey: ["site-settings"] });
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
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Logo gemt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    } finally {
      setLogoTypeBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* Bestillinger */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Bestillinger
        </h2>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base">Tillad bestillinger</Label>
              <p className="text-sm text-muted-foreground">
                Når slået til kan gæster bestille cocktails fra menukortet.
              </p>
            </div>
            <Switch
              checked={orderingData?.enabled ?? true}
              onCheckedChange={toggle}
              disabled={orderingLoading}
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

      {/* Temaer */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Tema
        </h2>
        <AdminThemes />
      </section>

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
                disabled={settingsLoading}
                className="max-w-sm"
                onKeyDown={(e) => { if (e.key === "Enter") saveSiteName(); }}
              />
              <Button onClick={saveSiteName} disabled={siteNameBusy || settingsLoading}>
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
            <div className="flex flex-wrap gap-2">
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
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {type === "martini" && <Martini className="h-6 w-6" />}
                    {type === "wine" && <Wine className="h-6 w-6" />}
                    {type === "barskab" && <BarskabLogo className="h-6 w-6" />}
                    {type === "custom" && <ImagePlus className="h-6 w-6" />}
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* PNG-logo vejledning — vises kun når custom er valgt */}
            {logoType === "custom" && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Sådan bruger du et PNG-logo:</p>
                <p>Upload din PNG-fil til GitHub-repositoriet og placer den her:</p>
                <code className="block rounded bg-background px-2 py-1 text-xs font-mono text-foreground border border-border">
                  public/custom-logo.png
                </code>
                <p>Filen vil automatisk blive vist som logo i headeren. Brug gerne en fil med transparent baggrund for bedste resultat.</p>
              </div>
            )}
          </div>

          {/* Justering (vertikal alignment) */}
          <div className="space-y-3 p-4">
            <Label className="text-base">Lodrét justering</Label>
            <div className="flex gap-2">
              {ALIGN_OPTIONS.map(({ align, label, icon }) => {
                const isActive = logoAlign === align;
                return (
                  <button
                    key={align}
                    onClick={() => selectLogoAlign(align)}
                    disabled={logoAlignBusy}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border-2 px-3 py-2 text-xs transition-colors",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    {icon}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-5 p-4">
            <SliderRow
              label="Logostørrelse"
              value={logoSize}
              min={8}
              max={120}
              onChange={setLogoSizeLocal}
              onSave={saveLogoSize}
              busy={logoSizeBusy}
            />
            <SliderRow
              label="Tekststørrelse"
              value={textSize}
              min={8}
              max={80}
              onChange={setTextSizeLocal}
              onSave={saveTextSize}
              busy={textSizeBusy}
            />
            <SliderRow
              label="Afstand horisontalt"
              value={logoGap}
              min={0}
              max={60}
              onChange={setLogoGapLocal}
              onSave={saveLogoGap}
              busy={logoGapBusy}
            />
            <SliderRow
              label="Afstand vertikalt"
              value={textOffsetY}
              min={-60}
              max={60}
              onChange={setTextOffsetYLocal}
              onSave={saveTextOffsetY}
              busy={textOffsetYBusy}
            />
          </div>

          {/* Live preview */}
          <div className="p-4">
            <Label className="mb-3 block text-base">Forhåndsvisning</Label>
            <div className="flex h-16 items-center rounded-lg border border-border bg-background px-4">
              <div
                className={cn("flex", alignClass[logoAlign])}
                style={{ gap: `${logoGap}px` }}
              >
                <SiteLogo type={logoType} size={logoSize} className="shrink-0 text-primary" />
                <span
                  className="font-serif leading-none"
                  style={{
                    fontSize: `${textSize}px`,
                    position: "relative",
                    top: `${textOffsetY}px`,
                  }}
                >
                  {siteName || "Barskab"}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Billeder */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Billeder
        </h2>
        <Card className="p-4">
          <div className="space-y-3">
            <div>
              <Label className="text-base">Komprimer eksisterende billeder</Label>
              <p className="text-sm text-muted-foreground">
                Henter alle billeder fra Supabase, komprimerer dem til maks 1200×1200px og uploader dem tilbage.
                Billeder der allerede er optimerede springes over automatisk.
              </p>
            </div>
            {compressProgress && (
              <p className="text-sm text-muted-foreground">{compressProgress}</p>
            )}
            <Button
              variant="outline"
              onClick={compressAllImages}
              disabled={compressing}
            >
              {compressing ? "Komprimerer…" : "Komprimer alle billeder"}
            </Button>
          </div>
        </Card>
      </section>

      {/* Brugere */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Brugere
        </h2>
        <AdminUsers />
      </section>

      {/* Billedkomprimering */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Billeder
        </h2>
        <Card className="p-4">
          <div className="space-y-3">
            <div>
              <Label className="text-base">Komprimer eksisterende billeder</Label>
              <p className="text-sm text-muted-foreground">
                Henter alle billeder fra Supabase, komprimerer dem til maks 1200×1200px og uploader dem tilbage.
                Billeder der allerede er optimerede springes over automatisk.
              </p>
            </div>
            {compressProgress && (
              <p className="text-sm text-muted-foreground">{compressProgress}</p>
            )}
            <Button
              variant="outline"
              onClick={compressAllImages}
              disabled={compressing}
            >
              {compressing ? "Komprimerer…" : "Komprimer alle billeder"}
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
