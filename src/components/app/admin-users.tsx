import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdmins, grantAdminByEmail, revokeAdmin } from "@/lib/admin.functions";
import { getSignupEnabled, setSignupEnabled } from "@/lib/orders.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Trash2, Shield } from "lucide-react";

export function AdminUsers() {
  const qc = useQueryClient();
  const fetchAdmins = useServerFn(listAdmins);
  const grant = useServerFn(grantAdminByEmail);
  const revoke = useServerFn(revokeAdmin);
  const fetchSignup = useServerFn(getSignupEnabled);
  const updateSignup = useServerFn(setSignupEnabled);

  const { data: admins } = useQuery({ queryKey: ["admins"], queryFn: () => fetchAdmins() });
  const { data: signupData, isLoading: signupLoading } = useQuery({
    queryKey: ["signup-enabled"],
    queryFn: () => fetchSignup(),
  });

  const [email, setEmail] = useState("");

  const signupM = useMutation({
    mutationFn: (enabled: boolean) => updateSignup({ data: { enabled } }),
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ["signup-enabled"] });
      toast.success(enabled ? "Oprettelse af brugere er slået til" : "Oprettelse af brugere er slået fra");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grantM = useMutation({
    mutationFn: (e: string) => grant({ data: { email: e } }),
    onSuccess: () => {
      setEmail("");
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Administrator tildelt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeM = useMutation({
    mutationFn: (id: string) => revoke({ data: { userId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admins"] });
      toast.success("Adgang fjernet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Signup-toggle — øverst */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="signup-toggle" className="text-base">
              Tillad oprettelse af nye brugere
            </Label>
            <p className="text-sm text-muted-foreground">
              Når slået fra, kan nye brugere ikke oprette en konto via login-siden.
              Eksisterende brugere kan stadig logge ind.
            </p>
          </div>
          <Switch
            id="signup-toggle"
            checked={!!signupData?.enabled}
            disabled={signupLoading || signupM.isPending}
            onCheckedChange={(v) => signupM.mutate(v)}
          />
        </div>
      </Card>

      {/* Tilføj administrator */}
      <Card className="p-4">
        <h3 className="mb-1 font-medium">Tilføj administrator</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Brugeren skal være oprettet i forvejen via login-siden.
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            onKeyDown={(e) => e.key === "Enter" && email.trim() && grantM.mutate(email.trim())}
          />
          <Button
            onClick={() => email.trim() && grantM.mutate(email.trim())}
            disabled={grantM.isPending}
          >
            Giv adgang
          </Button>
        </div>
      </Card>

      {/* Liste over administratorer */}
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {(admins ?? []).map((u) => (
          <li key={u.id} className="flex items-center gap-2 px-3 py-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="flex-1 truncate">{u.email ?? u.id}</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (confirm(`Fjern adgang for ${u.email ?? u.id}?`)) revokeM.mutate(u.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
        {(admins ?? []).length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            Ingen administratorer.
          </li>
        )}
      </ul>
    </div>
  );
}
