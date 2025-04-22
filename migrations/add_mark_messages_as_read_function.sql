-- Création de la fonction mark_messages_as_read
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(message_ids uuid[], user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER -- Utilise les permissions du créateur de la fonction
AS $$
DECLARE
  updated_count integer;
BEGIN
  -- Mettre à jour les messages où le destinataire est l'utilisateur courant et le message est non lu
  UPDATE public.messages
  SET read = true
  WHERE id = ANY(message_ids)
    AND receiver_id = user_id
    AND read = false;
    
  -- Récupérer le nombre de lignes affectées
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Journaliser l'opération pour le débogage
  INSERT INTO public.logs (event, details, user_id)
  VALUES ('mark_messages_as_read', 
          json_build_object('message_ids', message_ids, 'user_id', user_id, 'updated_count', updated_count)::text,
          user_id);
  
  -- Retourner true si au moins un message a été mis à jour
  RETURN updated_count > 0;
END;
$$;

-- Vérifier si la table logs existe, sinon la créer pour les besoins de débogage
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'logs') THEN
    CREATE TABLE public.logs (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      event TEXT,
      details TEXT,
      user_id UUID
    );
    
    -- Ajouter des politiques d'accès à la table logs
    ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
    
    -- Seuls les administrateurs peuvent voir les logs
    CREATE POLICY logs_admin_policy ON public.logs
      USING (EXISTS (
        SELECT 1 FROM auth.users
        WHERE auth.users.id = auth.uid()
        AND auth.users.role = 'admin'
      ));
  END IF;
END
$$;

-- Accorder les permissions nécessaires
GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(uuid[], uuid) TO service_role;
