import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { getOrderingEnabled, setOrderingEnabled } from "@/lib/orders.functions";
import { AdminCategories } from "@/components/app/admin-categories";
import { AdminUsers } from "@/components/app/admin-users";
import { AdminThemes } from "@/components/app/admin-themes";

export function AdminSettings() {
  const fetchSetting = useServerFn(getOrderingEnabled);
  const updateSetting = useServerFn(setOrderingEnabled);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["ordering-enabled"],
    queryFn: () => fetchSetting(),
  });

  async function toggle(enabled: boolean) {
    try {
      await updateSetting({ data: { enabled } });
      qc.invalidateQueries({ queryKey: ["ordering-enabled"] });
      toast.success(enabled ? "Bestillinger er slået til" : "Bestillinger er slået fra");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
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
