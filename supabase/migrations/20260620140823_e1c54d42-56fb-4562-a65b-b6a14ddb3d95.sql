
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins see all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Ingredients
CREATE TABLE public.ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'Andet',
  available boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ingredients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingredients TO authenticated;
GRANT ALL ON public.ingredients TO service_role;
ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads ingredients" ON public.ingredients FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins insert ingredients" ON public.ingredients FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update ingredients" ON public.ingredients FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete ingredients" ON public.ingredients FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Cocktails
CREATE TABLE public.cocktails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  glass text,
  garnish text,
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
GRANT SELECT ON public.cocktails TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocktails TO authenticated;
GRANT ALL ON public.cocktails TO service_role;
ALTER TABLE public.cocktails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads cocktails" ON public.cocktails FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins insert cocktails" ON public.cocktails FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update cocktails" ON public.cocktails FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete cocktails" ON public.cocktails FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Cocktail ingredients
CREATE TABLE public.cocktail_ingredients (
  cocktail_id uuid NOT NULL REFERENCES public.cocktails(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  amount numeric,
  unit text,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (cocktail_id, ingredient_id)
);
GRANT SELECT ON public.cocktail_ingredients TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocktail_ingredients TO authenticated;
GRANT ALL ON public.cocktail_ingredients TO service_role;
ALTER TABLE public.cocktail_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads cocktail_ingredients" ON public.cocktail_ingredients FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write cocktail_ingredients" ON public.cocktail_ingredients FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Cocktail tags
CREATE TABLE public.cocktail_tags (
  cocktail_id uuid NOT NULL REFERENCES public.cocktails(id) ON DELETE CASCADE,
  tag text NOT NULL,
  PRIMARY KEY (cocktail_id, tag)
);
GRANT SELECT ON public.cocktail_tags TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocktail_tags TO authenticated;
GRANT ALL ON public.cocktail_tags TO service_role;
ALTER TABLE public.cocktail_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads cocktail_tags" ON public.cocktail_tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write cocktail_tags" ON public.cocktail_tags FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-promote the first user to admin
CREATE OR REPLACE FUNCTION public.handle_first_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_first_user();
