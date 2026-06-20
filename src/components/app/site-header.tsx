import { Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Wine, LogOut, Shield, ClipboardList } from "lucide-react";

const navItems = [
  { to: "/", label: "Klar" },
  { to: "/naesten", label: "Næsten" },
  { to: "/alle", label: "Alle" },
  { to: "/ingredienser", label: "Ingredienser" },
] as const;

export function SiteHeader() {
  const { session } = useSession();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-serif text-lg tracking-tight">
          <Wine className="h-5 w-5 text-primary" />
          <span>Barskab</span>
        </Link>
        <div className="flex items-center gap-1">
          {session ? (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link to="/bestillinger">
                  <ClipboardList className="mr-1 h-4 w-4" /> Bestillinger
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/admin">
                  <Shield className="mr-1 h-4 w-4" /> Admin
                </Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => supabase.auth.signOut()}
                aria-label="Log ud"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild size="sm" variant="ghost">
              <Link to="/auth">Log ind</Link>
            </Button>
          )}
        </div>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
        {navItems.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: true }}
            className="rounded-full border border-transparent px-3 py-1 text-muted-foreground hover:text-foreground data-[status=active]:border-primary/40 data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}