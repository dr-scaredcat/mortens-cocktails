import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/app/site-header";
import { useSession } from "@/hooks/use-session";
import { getSignupEnabled } from "@/lib/orders.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Log ind — Barskab" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const { session } = useSession();

  const fetchSignup = useServerFn(getSignupEnabled);
  const { data: signupData } = useQuery({
    queryKey: ["signup-enabled"],
    queryFn: () => fetchSignup(),
  });
  const signupEnabled = signupData?.enabled ?? true; // default til true mens den loader

  // Hvis signup pludselig slås fra og brugeren er i signup-mode, skift til signin
  useEffect(() => {
    if (!signupEnabled && mode === "signup") setMode("signin");
  }, [signupEnabled, mode]);

  useEffect(() => {
    if (session) navigate({ to: "/admin" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!signupEnabled) {
          toast.error("Oprettelse af nye brugere er ikke tilladt.");
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Konto oprettet – du er logget ind.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.invalidate();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-md px-4 py-10">
        <Card className="p-6">
          <h1 className="mb-1 font-serif text-2xl">
            {mode === "signin" ? "Log ind" : "Opret konto"}
          </h1>
          <p className="mb-5 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Log ind med din konto."
              : "Den første bruger bliver automatisk administrator."}
          </p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="password">Adgangskode</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {mode === "signin" ? "Log ind" : "Opret konto"}
            </Button>
          </form>

          {/* Skjul skift til signup hvis det er slået fra */}
          {signupEnabled && (
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="mt-4 w-full text-center text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              {mode === "signin"
                ? "Har du ikke en konto? Opret en"
                : "Har du allerede en konto? Log ind"}
            </button>
          )}
        </Card>
      </main>
    </div>
  );
}
