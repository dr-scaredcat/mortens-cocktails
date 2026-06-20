CREATE TABLE public.cocktail_ratings (
  cocktail_id uuid NOT NULL REFERENCES public.cocktails(id) ON DELETE CASCADE,
  rater_id text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cocktail_id, rater_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cocktail_ratings TO anon, authenticated;
GRANT ALL ON public.cocktail_ratings TO service_role;

ALTER TABLE public.cocktail_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are publicly readable"
  ON public.cocktail_ratings FOR SELECT USING (true);

CREATE POLICY "Anyone can submit a rating"
  ON public.cocktail_ratings FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update a rating"
  ON public.cocktail_ratings FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete their rating"
  ON public.cocktail_ratings FOR DELETE USING (true);

CREATE INDEX cocktail_ratings_cocktail_idx ON public.cocktail_ratings(cocktail_id);