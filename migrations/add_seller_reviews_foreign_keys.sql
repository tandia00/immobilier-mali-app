-- Ajouter les clés étrangères pour seller_reviews
ALTER TABLE public.seller_reviews
ADD CONSTRAINT seller_reviews_reviewer_id_fkey
FOREIGN KEY (reviewer_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

ALTER TABLE public.seller_reviews
ADD CONSTRAINT seller_reviews_seller_id_fkey
FOREIGN KEY (seller_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Mettre à jour les politiques
DROP POLICY IF EXISTS "Les utilisateurs peuvent voir les avis" ON public.seller_reviews;
DROP POLICY IF EXISTS "Les utilisateurs peuvent créer des avis" ON public.seller_reviews;
DROP POLICY IF EXISTS "Les utilisateurs peuvent modifier leurs avis" ON public.seller_reviews;

CREATE POLICY "Les utilisateurs peuvent voir les avis"
ON public.seller_reviews
FOR SELECT
USING (true);

CREATE POLICY "Les utilisateurs peuvent créer des avis"
ON public.seller_reviews
FOR INSERT
WITH CHECK (
  auth.uid() = reviewer_id
  AND NOT EXISTS (
    SELECT 1 FROM public.seller_reviews
    WHERE reviewer_id = auth.uid()
    AND seller_id = NEW.seller_id
  )
);

CREATE POLICY "Les utilisateurs peuvent modifier leurs avis"
ON public.seller_reviews
FOR UPDATE
USING (auth.uid() = reviewer_id)
WITH CHECK (auth.uid() = reviewer_id);
