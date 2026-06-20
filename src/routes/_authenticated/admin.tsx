import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isAdmin } from "@/lib/admin.functions";
import { AdminIngredients } from "@/components/app/admin-ingredients";
import { AdminCocktails } from "@/components/app/admin-cocktails";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Barskab" }] }),
  component: AdminPage,
});

function AdminPage() {
  const check = useServerFn(isAdmin);
  const { data, isLoading } = useQuery({ queryKey: ["isAdmin"], queryFn: () => check() });

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-1 font-serif text-3xl">Admin</h1>
        <p className="mb-5 text-sm text-muted-foreground">
          Administrér ingredienser og cocktails.
        </p>
        {isLoading ? (
          <p className="text-muted-foreground">Indlæser...</p>
        ) : !data?.isAdmin ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm">
            Din konto har ikke administratorrettigheder.
          </div>
        ) : (
          <Tabs defaultValue="ingredients">
            <TabsList>
              <TabsTrigger value="ingredients">Ingredienser</TabsTrigger>
              <TabsTrigger value="cocktails">Cocktails</TabsTrigger>
            </TabsList>
            <TabsContent value="ingredients" className="mt-4">
              <AdminIngredients />
            </TabsContent>
            <TabsContent value="cocktails" className="mt-4">
              <AdminCocktails />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}