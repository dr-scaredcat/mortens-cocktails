import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SiteHeader } from "@/components/app/site-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { isAdmin } from "@/lib/admin.functions";
import { AdminIngredients } from "@/components/app/admin-ingredients";
import { AdminCocktails } from "@/components/app/admin-cocktails";
import { AdminCategories } from "@/components/app/admin-categories";
import { AdminTags } from "@/components/app/admin-tags";
import { AdminUsers } from "@/components/app/admin-users";

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
            <TabsList className="flex w-full flex-wrap">
              <TabsTrigger value="ingredients">Ingredienser</TabsTrigger>
              <TabsTrigger value="cocktails">Cocktails</TabsTrigger>
              <TabsTrigger value="categories">Kategorier</TabsTrigger>
              <TabsTrigger value="tags">Tags</TabsTrigger>
              <TabsTrigger value="users">Brugere</TabsTrigger>
            </TabsList>
            <TabsContent value="ingredients" className="mt-4">
              <AdminIngredients />
            </TabsContent>
            <TabsContent value="cocktails" className="mt-4">
              <AdminCocktails />
            </TabsContent>
            <TabsContent value="categories" className="mt-4">
              <AdminCategories />
            </TabsContent>
            <TabsContent value="tags" className="mt-4">
              <AdminTags />
            </TabsContent>
            <TabsContent value="users" className="mt-4">
              <AdminUsers />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}