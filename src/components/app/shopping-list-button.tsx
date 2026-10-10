import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Knap til at tilføje én eller flere ingredienser til indkøbslisten.
 * - Er alle ingredienser allerede på listen → tonet ned og inaktiv.
 * - Er listen tom → inaktiv (ingen mangler at tilføje).
 */
export function ShoppingListButton({
  ingredientIds,
  shoppingListIds,
  onAdd,
  isPending = false,
  size = "icon",
  className,
}: {
  /** ID'er der skal tilføjes (typisk manglende ingredienser for en cocktail, eller ét ID) */
  ingredientIds: string[];
  /** ID'er der allerede er på indkøbslisten */
  shoppingListIds: Set<string>;
  onAdd: () => void;
  isPending?: boolean;
  size?: "icon" | "sm" | "default";
  className?: string;
}) {
  const allOnList = ingredientIds.length > 0 && ingredientIds.every((id) => shoppingListIds.has(id));
  const noneToAdd = ingredientIds.length === 0;
  const disabled = allOnList || noneToAdd || isPending;

  return (
    <Button
      type="button"
      size={size}
      variant="outline"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      className={cn(disabled && "opacity-40", className)}
      title={allOnList ? "Allerede på indkøbslisten" : "Tilføj til indkøbsliste"}
      aria-label="Tilføj til indkøbsliste"
    >
      <ShoppingCart className="h-4 w-4" />
      {size !== "icon" && (
        <span className="ml-1">
          {allOnList ? "På listen" : "Tilføj til indkøbsliste"}
        </span>
      )}
    </Button>
  );
}

