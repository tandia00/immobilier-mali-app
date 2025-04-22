-- Désactiver temporairement RLS
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Vérifier les rôles existants
SELECT * FROM user_roles WHERE user_id = '024fb95e-4ce4-496d-ad41-d1493f87fba9';

-- Réinsérer le rôle admin si nécessaire
INSERT INTO user_roles (user_id, role)
VALUES ('024fb95e-4ce4-496d-ad41-d1493f87fba9', 'admin')
ON CONFLICT (user_id) DO UPDATE 
SET role = 'admin'
WHERE user_roles.user_id = '024fb95e-4ce4-496d-ad41-d1493f87fba9';

-- Réactiver RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
