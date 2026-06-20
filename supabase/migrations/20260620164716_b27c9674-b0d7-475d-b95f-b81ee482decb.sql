
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.cocktail_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cocktail_id UUID REFERENCES public.cocktails(id) ON DELETE SET NULL,
  cocktail_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.cocktail_orders TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.cocktail_orders TO authenticated;
GRANT ALL ON public.cocktail_orders TO service_role;

ALTER TABLE public.cocktail_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create orders" ON public.cocktail_orders
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can view orders" ON public.cocktail_orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update orders" ON public.cocktail_orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete orders" ON public.cocktail_orders
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX cocktail_orders_created_at_idx ON public.cocktail_orders(created_at DESC);

CREATE TRIGGER update_cocktail_orders_updated_at
  BEFORE UPDATE ON public.cocktail_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
