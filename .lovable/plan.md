## Mål

Tilføj en ny fane "Tilføj næste" i topnavigationen, som viser ingredienser rangeret efter hvor meget de udvider menukortet, hvis man tilføjer dem til barskabet.

## Ny side: `/tilfoej-naeste`

- Ny route-fil: `src/routes/tilfoej-naeste.tsx`.
- Tilføjes som ny fane i `src/components/app/site-header.tsx` mellem "Ingredienser" og resten.
- Genbruger `listCocktails` server-funktionen (allerede leveret med `missing` pr. cocktail).

## Beregning

For hver ingrediens `i` som ikke allerede er tilgængelig:

- **Bliver klar**: antal cocktails hvor `missing == [i.name]` (dvs. den eneste manglende ingrediens).
- **Bruger ingrediensen**: antal cocktails hvor ingrediensen indgår OG er markeret som ikke-tilgængelig i den cocktail (dvs. den ville rykke cocktailen tættere på klar).

Tilgængelige ingredienser vises ikke på listen (de tilfører 0).

## UI

```text
[ Vælg tælle-tilstand ]
( • Bliver klar )  ( Bruger ingrediensen )

GIN              ── 7 cocktails
LIME             ── 4 cocktails
…
```

- Skift mellem de to tilstande med en toggle/segmented control øverst.
- Liste sorteret faldende efter tal; ingredienser med 0 skjules.
- Hver række er klikbar → åbner en dialog/expander der lister navnene på de cocktails ingrediensen "låser op" eller bidrager til (baseret på valgte tilstand).
- Cocktail-navnene i dialogen er ren tekst (ingen bestil-knap).
- Gruppering pr. kategori er ikke nødvendig — flad sorteret liste er mere brugbar her.

## Tekniske detaljer

- Ingen ændringer i databasen eller server-funktioner; al beregning sker client-side ud fra `listCocktails`.
- `queryKey: ["cocktails"]` genbruges, så data er allerede cachet hvis man har besøgt en anden side.
- Klik-dialog kan bruge eksisterende shadcn `Dialog`.

## Filer der ændres / oprettes

- **Ny**: `src/routes/tilfoej-naeste.tsx`
- **Ændret**: `src/components/app/site-header.tsx` (tilføj nav-item)
