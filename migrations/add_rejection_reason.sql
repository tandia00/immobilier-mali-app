-- Ajouter la colonne rejection_reason à la table properties
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Mettre à jour les politiques pour permettre la mise à jour de rejection_reason
DROP POLICY IF EXISTS "Admin can update rejection_reason" ON public.properties;

CREATE POLICY "Admin can update rejection_reason"
ON public.properties
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND p.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles p
    WHERE p.id = auth.uid() 
    AND p.is_admin = true
  )
);
