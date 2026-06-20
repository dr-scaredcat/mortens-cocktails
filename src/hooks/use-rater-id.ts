import { useEffect, useState } from "react";

const KEY = "cocktail-rater-id";

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function useRaterId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    try {
      let v = localStorage.getItem(KEY);
      if (!v) {
        v = makeId();
        localStorage.setItem(KEY, v);
      }
      setId(v);
    } catch {
      setId(makeId());
    }
  }, []);
  return id;
}