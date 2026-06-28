import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createOrder } from "@/lib/orders.functions";

const NAME_KEY = "barskab.customerName";
const MAX_QUANTITY = 10;

export function OrderButton({
  cocktailId,
  cocktailName,
}: {
  cocktailId: string;
  cocktailName: string;
}) {
  const submit = useServerFn(createOrder);
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [name, setName] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(NAME_KEY) ?? "",
  );
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);

  async function doSubmit() {
    setBusy(true);
    try {
      await submit({
        data: {
          cocktailId,
          cocktailName,
          customerName: name.trim(),
          note: note.trim() || null,
          quantity,
        },
      });
      if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, name.trim());
      toast.success(
        quantity > 1
          ? `Bestilling sendt: ${quantity}× ${cocktailName}`
          : `Bestilling sendt: ${cocktailName}`,
      );
      setNote("");
      setQuantity(1);
      setOpen(false);
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke sende bestilling");
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Skriv venligst dit navn");
      return;
    }
    if (quantity > 1) {
      // Åbn bekræftelsesdialog
      setConfirmOpen(true);
    } else {
      doSubmit();
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full" size="sm">
            Bestil
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bestil {cocktailName}</DialogTitle>
            <DialogDescription>
              Skriv dit navn, så bartenderen ved hvem den er til.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="order-name">Navn</Label>
              <Input
                id="order-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Antal</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Færre"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center text-lg font-medium tabular-nums">{quantity}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
                  disabled={quantity >= MAX_QUANTITY}
                  aria-label="Flere"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="order-note">Note (valgfri)</Label>
              <Textarea
                id="order-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                placeholder="Fx mindre lime, ekstra is..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annullér
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Sender..." : "Send bestilling"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bekræftelsesdialog — vises kun ved antal > 1 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Bekræft bestilling</DialogTitle>
            <DialogDescription>
              Du er ved at bestille <strong>{quantity}× {cocktailName}</strong> til {name.trim() || "dig"}. Er du sikker?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              Tilbage
            </Button>
            <Button onClick={doSubmit} disabled={busy}>
              {busy ? "Sender..." : `Bestil ${quantity} stk.`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
