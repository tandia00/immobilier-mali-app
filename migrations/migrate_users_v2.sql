-- Migrate existing users to profiles
INSERT INTO profiles (id, email)
SELECT id, email
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

-- Clean up orphaned reports
DELETE FROM user_reports
WHERE reporter_id NOT IN (SELECT id FROM profiles)
   OR reported_user_id NOT IN (SELECT id FROM profiles);
