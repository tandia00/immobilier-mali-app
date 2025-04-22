-- Add property_type column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type TEXT NOT NULL DEFAULT 'Maison';

-- Update existing records to have a property type if needed
UPDATE properties SET property_type = 'Maison' WHERE property_type IS NULL;
