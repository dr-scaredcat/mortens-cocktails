# Admin: Menukort-fane

Tilføj en ny fane "Menukort" i admin-dropdownen, hvor man styrer hvilke af de aktuelt mulige cocktails der vises for gæsterne på `/menukort`.

## Funktionalitet

- Listen viser kun cocktails der lige nu er mulige at lave (alle ingredienser krydset af).
- Hver række: navn + checkbox. Ingen billeder, opskrifter eller andre felter.
- Øverst: knapperne **Vælg alle** og **Fravælg alle**.
- Standard: nye cocktails er valgt til menukortet. Admin kan fravælge.
- `/menukort` filtreres så kun mulige cocktails med flueben vises.

## Teknisk

**Database (migration)**
- Tilføj `on_menu boolean not null default true` på `cocktails`.
- Ingen ændringer i RLS/grants — eksisterende policies dækker kolonnen.

**Backend (`src/lib/cocktails.functions.ts`)**
- Inkludér `on_menu` i `CocktailWithDetails` og i `listCocktails`-select.
- Ny server function `setCocktailOnMenu({ id, onMenu })` beskyttet med `requireSupabaseAuth` + admin-tjek (følg mønster fra øvrige admin-functions).
- Ny `setCocktailsOnMenuBulk({ ids, onMenu })` til Vælg/Fravælg alle.

**Admin (`src/components/app/admin-cocktails.tsx`-sibling: ny `admin-menukort.tsx`)**
- `useQuery(["cocktails"])` via `listCocktails`, filtrér til `missing.length === 0`.
- Render som simpel liste med `Checkbox` pr. række.
- Knapper "Vælg alle"/"Fravælg alle" kalder bulk-mutation på de viste id'er.
- `useMutation` med invalidate på `["cocktails"]`.

**Admin route (`src/routes/_authenticated/admin.tsx`)**
- Tilføj tab-værdi `"menukort"` med label "Menukort" i både Tabs og Select.
- Render `<AdminMenukort />` når aktiv.

**Menukort (`src/routes/menukort.tsx`)**
- I `filtered`-memo: tilføj `c.on_menu !== false` til filteret (ud over eksisterende tilgængeligheds-check).

## Filer
- Migration: ny SQL der tilføjer `on_menu`-kolonnen.
- Edit: `src/lib/cocktails.functions.ts`, `src/routes/_authenticated/admin.tsx`, `src/routes/menukort.tsx`.
- Ny: `src/components/app/admin-menukort.tsx`.
