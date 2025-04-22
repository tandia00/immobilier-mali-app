-- Migrate existing users to profiles
WITH users_to_migrate AS (
    SELECT 
        u.id,
        COALESCE(
            raw_user_meta_data->>'email',
            u.email,
            'user_' || u.id || '@example.com'
        ) as email,
        p.id as existing_profile_id
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE p.id IS NULL
)
INSERT INTO profiles (id, email)
SELECT id, email
FROM users_to_migrate
WHERE existing_profile_id IS NULL;

-- Update user_reports to use existing user IDs
-- This ensures we don't have any orphaned reports
DELETE FROM user_reports
WHERE reporter_id NOT IN (SELECT id FROM profiles)
   OR reported_user_id NOT IN (SELECT id FROM profiles);
