-- Add images column to properties table
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- Add comment to explain the column
COMMENT ON COLUMN properties.images IS 'Array of image URLs or storage paths';
