import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { getOrderingEnabled, setOrderingEnabled } from "@/lib/orders.functions";

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
  );
}
