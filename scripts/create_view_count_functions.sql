-- Fonction pour vérifier si une colonne existe dans une table
CREATE OR REPLACE FUNCTION public.check_column_exists(table_name text, column_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  column_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = $1
    AND column_name = $2
  ) INTO column_exists;
  
  RETURN column_exists;
END;
$$;

-- Fonction pour incrémenter le compteur de vues d'une propriété
CREATE OR REPLACE FUNCTION public.increment_view_count(property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier si la colonne view_count existe
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'properties'
    AND column_name = 'view_count'
  ) THEN
    -- Incrémenter le compteur de vues
    UPDATE public.properties
    SET view_count = COALESCE(view_count, 0) + 1
    WHERE id = property_id;
  ELSE
    -- Si la colonne n'existe pas, on ne fait rien (la colonne doit être ajoutée manuellement)
    RAISE NOTICE 'La colonne view_count n''existe pas dans la table properties';
  END IF;
END;
$$;

-- Fonction pour récupérer les compteurs de vues pour plusieurs propriétés
CREATE OR REPLACE FUNCTION public.get_properties_view_counts(property_ids uuid[])
RETURNS TABLE(property_id uuid, view_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier si la colonne view_count existe
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'properties'
    AND column_name = 'view_count'
  ) THEN
    -- Retourner les compteurs de vues pour les propriétés demandées
    RETURN QUERY
    SELECT p.id, COALESCE(p.view_count, 0) as view_count
    FROM public.properties p
    WHERE p.id = ANY(property_ids);
  ELSE
    -- Si la colonne n'existe pas, retourner des compteurs à 0
    RETURN QUERY
    SELECT p.id, 0 as view_count
    FROM public.properties p
    WHERE p.id = ANY(property_ids);
  END IF;
END;
$$;
