ALTER TABLE public.ingredients ADD CONSTRAINT ingredients_name_unique UNIQUE (name);

CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE TABLE public.tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tags TO authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads tags" ON public.tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write tags" ON public.tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));

CREATE POLICY "admins insert user_roles" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "admins delete user_roles" ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role));

INSERT INTO public.categories (name, position) VALUES
  ('Spiritus',1),('Likør',2),('Juice',3),('Sirup',4),('Sodavand',5),
  ('Frugt & bær',6),('Krydderier & urter',7),('Mejeri',8),('Andet',99)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.tags (name, position) VALUES
  ('boozy',1),('frugtig',2),('sød',3),('sur',4),('frisk',5),
  ('krydret',6),('cremet',7),('bitter',8),('klassisk',9),('mocktail',10)
ON CONFLICT (name) DO NOTHING;