-- Add full_name column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;

-- Add comment to explain the column
COMMENT ON COLUMN profiles.full_name IS 'Full name of the user';
