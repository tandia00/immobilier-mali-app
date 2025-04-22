-- Autoriser l'accès à la fonction uniquement pour les utilisateurs authentifiés
ALTER FUNCTION get_users_info(UUID[]) SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION get_users_info(UUID[]) TO authenticated;
