-- Add user_id column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Add foreign key constraint
ALTER TABLE properties 
  ADD CONSTRAINT fk_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
