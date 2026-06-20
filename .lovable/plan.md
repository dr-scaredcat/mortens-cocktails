
# Cocktail Manager (Danish)

A Danish-language web app to manage your home bar. Admins log in to maintain ingredients and cocktails; guests browse what's possible from currently available ingredients.

## Pages (all UI in Danish)

- `/` — **Cocktails du kan lave**: only cocktails where every ingredient is checked as available.
- `/naesten` — **Næsten klar**: cocktails missing exactly 1 ingredient (shows which one).
- `/alle` — **Alle cocktails**: every cocktail, with a badge showing missing count + list of missing ingredients.
- `/ingredienser` — Guest-visible checklist of all ingredients, grouped by category, with a master toggle "Tilgængelig" per item. (Read-only for guests, editable for admins.)
- `/auth` — Login (email + password).
- `/admin` — Admin dashboard with two tabs:
  - **Ingredienser**: add / edit / delete / toggle availability, grouped by category.
  - **Cocktails**: add / edit / delete cocktails.

All three guest cocktail pages share a top filter bar:
- Tag filter (multi-select chips: boozy, fruity, sweet, sur, frisk, …)
- Search by name
- Quick links between the three views

## Cocktail data model

Each cocktail stores:
- Navn (name)
- Beskrivelse (short description, optional)
- Billede (image, uploaded to Lovable Cloud Storage)
- Glas (glass type, free text e.g. "Coupe", "Highball")
- Pynt (garnish, free text)
- Fremgangsmåde (preparation instructions, multi-line)
- Ingredienser: list of `{ ingredient, mængde (number), enhed (cl, ml, stk, dash, tsk) }`
- Tags

When adding a cocktail, the ingredient picker is a combobox: pick an existing ingredient or type a new one. New names are created as ingredients on save (default category "Andet", available = false) so admins can categorise them later.

## Fixed preset lists

**Kategorier (ingredients):** Spiritus, Likør, Juice, Sirup, Sodavand, Frugt & bær, Krydderier & urter, Mejeri, Andet.

**Tags (cocktails):** boozy, frugtig, sød, sur, frisk, krydret, cremet, bitter, klassisk, mocktail.

## Auth

- Lovable Cloud email/password.
- A `user_roles` table with enum `app_role` (`admin`, `user`) + `has_role()` security-definer function.
- `/admin` and `/ingredienser` edit actions gated by `has_role(auth.uid(), 'admin')`.
- First user must be promoted manually via a SQL snippet shown after signup (documented in the admin page if no admin exists yet).

## Technical section

### Database (Lovable Cloud / Supabase)
- `categories` enum-style: handled as a TS constant (fixed list) — no table needed.
- `tags` enum-style: TS constant.
- `ingredients(id, name unique, category text, available boolean default false, created_at)`
- `cocktails(id, name, description, image_url, glass, garnish, instructions, created_at, created_by)`
- `cocktail_ingredients(cocktail_id, ingredient_id, amount numeric, unit text, position int, PK(cocktail_id, ingredient_id))`
- `cocktail_tags(cocktail_id, tag text, PK(cocktail_id, tag))`
- `user_roles(user_id, role app_role, unique(user_id, role))` + `app_role` enum + `has_role()`.
- RLS:
  - `ingredients`, `cocktails`, `cocktail_ingredients`, `cocktail_tags`: `SELECT` to `anon` + `authenticated`; `INSERT/UPDATE/DELETE` only when `has_role(auth.uid(), 'admin')`.
  - `user_roles`: `SELECT` to `authenticated` (own rows), all changes via admin role or service role.
- GRANTs on every public table per the public-schema rule.
- Storage bucket `cocktail-images` (public) for uploaded photos.

### Routing (TanStack Start)
- Public routes: `/`, `/naesten`, `/alle`, `/ingredienser`, `/auth`.
- Protected subtree: `src/routes/_authenticated/admin.tsx` (+ tabs).
- Data: TanStack Query everywhere; loaders prime via `ensureQueryData` for public lists, components use `useSuspenseQuery`.
- Server functions in `src/lib/*.functions.ts`:
  - Public reads via server publishable client (ingredients + cocktails with joins).
  - Admin mutations via `requireSupabaseAuth` + `has_role` check.
  - Image upload from client directly to Storage with the browser client (admin only).

### UI
- shadcn components: Card, Checkbox, Tabs, Dialog, Combobox (Command + Popover), Badge, Input, Textarea, Select, Sonner toasts.
- Cocktail card shows image, name, tags, ingredients (greyed-out ones = missing), and "Mangler: X, Y" line on `/alle` and `/naesten`.
- Mobile-first layout (user is on a phone-sized viewport).

### Matching logic
Computed in the server fn that lists cocktails: each cocktail returns `missingIngredients: string[]`. The three pages filter the same dataset client-side:
- `/`: `missing.length === 0`
- `/naesten`: `missing.length === 1`
- `/alle`: all, sorted by `missing.length` asc.

### Design direction
Danish home-bar feel: warm dark theme (deep amber/whiskey accents on near-black), serif display headings (e.g. Fraunces) + clean sans body (Inter), generous spacing, photo-forward cocktail cards. Will be applied via semantic tokens in `src/styles.css`.

## Build order
1. Enable Lovable Cloud + create schema (migration with enum, tables, GRANTs, RLS, `has_role`, storage bucket).
2. Auth page + `_authenticated` admin shell.
3. Admin Ingredienser tab.
4. Admin Cocktails tab (with combobox + image upload).
5. Guest ingredient checklist page.
6. Guest cocktail pages (`/`, `/naesten`, `/alle`) sharing one server fn + tag filter.
7. Design polish (tokens, fonts, cocktail card styling).
