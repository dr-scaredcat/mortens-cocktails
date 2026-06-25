## Mål
I rediger-dialogen for en cocktail på admin-siden tilføjes en knap "Nulstil rating", der sletter alle vurderinger for den pågældende cocktail.

## Ændringer

### Backend — `src/lib/admin.functions.ts`
Tilføj ny admin-beskyttet server-funktion:

```ts
export const resetCocktailRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("cocktail_ratings")
      .delete()
      .eq("cocktail_id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
```

### Frontend — `src/components/app/admin-cocktails.tsx`
- Importér `resetCocktailRating` og brug `useServerFn` + `useMutation`.
- Onsuccess: invalidate `["cocktails"]` og `["my-ratings"]`, toast "Rating nulstillet".
- I `CocktailForm`-dialogen (kun når `form.id` er sat — altså redigering, ikke ny) tilføjes en knap "Nulstil rating" i `DialogFooter` til venstre for "Annullér".
- Klik viser `confirm("Nulstil alle vurderinger for ...?")` før kald.

RLS/policies er uændrede — der findes allerede en admin-policy på `cocktail_ratings` der tillader slet.

## Filer
- Edit: `src/lib/admin.functions.ts`
- Edit: `src/components/app/admin-cocktails.tsx`
