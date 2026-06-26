import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getOrderingEnabled, setOrderingEnabled, getSiteName, setSiteName } from "@/lib/orders.functions";
import { AdminCategories } from "@/components/app/admin-categories";
import { AdminUsers } from "@/components/app/admin-users";
import { AdminThemes } from "@/components/app/admin-themes";

export function AdminSettings() {
  const fetchSetting = useServerFn(getOrderingEnabled);
  const updateSetting = useServerFn(setOrderingEnabled);
  const fetchSiteName = useServerFn(getSiteName);
  const updateSiteName = useServerFn(setSiteName);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ordering-enabled"],
    queryFn: () => fetchSetting(),
  });

  const { data: siteNameData, isLoading: siteNameLoading } = useQuery({
    queryKey: ["site-name"],
    queryFn: () => fetchSiteName(),
  });

  const [siteName, setSiteNameLocal] = useState("");
  const [siteNameBusy, setSiteNameBusy] = useState(false);

  useEffect(() => {
    if (siteNameData?.name) {
      setSiteNameLocal(siteNameData.name);
    }
  }, [siteNameData]);

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

  return (
    <div className="space-y-10">
      {/* Sidenavn */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          Sidenavn
        </h2>
        <Card className="p-4">
          <div className="space-y-3">
            <div>
              <Label htmlFor="site-name-input" className="text-base">
                Navn
              </Label>
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
              <Label htmlFor="ordering-toggle" className="text-base">
                Bestillinger
              </Label>
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
