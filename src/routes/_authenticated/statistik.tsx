import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import { isAdmin } from "@/lib/admin.functions";
import { AdminStatistik } from "@/components/app/admin-statistik";

export const Route = createFileRoute("/_authenticated/statistik")({
  head: () => ({ meta: [{ title: "Statistik — Aston's Bar" }] }),
  component: StatistikPage,
});

function StatistikPage() {
  const check = useServerFn(isAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["isAdmin"], queryFn: () => check() });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-1 font-serif text-3xl">Statistik</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Overblik over cocktails, bedømmelser og bestillingshistorik.
        </p>
        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : !data?.isAdmin ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm">
            Din konto har ikke administratorrettigheder.
          </div>
        ) : (
          <AdminStatistik />
        )}
      </main>
    </div>
  );
}
