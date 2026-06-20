export const CATEGORIES = [
  "Spiritus",
  "Likør",
  "Juice",
  "Sirup",
  "Sodavand",
  "Frugt & bær",
  "Krydderier & urter",
  "Mejeri",
  "Andet",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const TAGS = [
  "boozy",
  "frugtig",
  "sød",
  "sur",
  "frisk",
  "krydret",
  "cremet",
  "bitter",
  "klassisk",
  "mocktail",
] as const;

export type Tag = (typeof TAGS)[number];

export const UNITS = ["cl", "ml", "stk", "dash", "tsk", "spsk", "skvæt"] as const;