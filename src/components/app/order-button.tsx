import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
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

export function OrderButton({
  cocktailId,
  cocktailName,
}: {
  cocktailId: string;
  cocktailName: string;
}) {
  const submit = useServerFn(createOrder);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(NAME_KEY) ?? "",
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Skriv venligst dit navn");
      return;
    }
    setBusy(true);
    try {
      await submit({
        data: {
          cocktailId,
          cocktailName,
          customerName: name.trim(),
          note: note.trim() || null,
        },
      });
      if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, name.trim());
      toast.success(`Bestilling sendt: ${cocktailName}`);
      setNote("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke sende bestilling");
    } finally {
      setBusy(false);
    }
  }

  return (
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
            <Label htmlFor="order-note">Note (valgfri)</Label>
            <Textarea
              id="order-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="Fx mindre is, ekstra lime..."
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
  );
}