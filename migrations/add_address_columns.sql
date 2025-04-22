-- Temporarily disable RLS
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Add address-related columns
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS street_name TEXT,
    ADD COLUMN IF NOT EXISTS street_number TEXT,
    ADD COLUMN IF NOT EXISTS postal_code TEXT,
    ADD COLUMN IF NOT EXISTS address_details TEXT,
    ADD COLUMN IF NOT EXISTS neighborhood TEXT;

-- Make sure all previous columns exist too
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Mali',
    ADD COLUMN IF NOT EXISTS phone TEXT;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Force PostgREST to reload its schema cache multiple times
SELECT pg_notify('pgrst', 'reload schema');
NOTIFY pgrst, 'reload schema';

-- Verify the structure
SELECT 
    column_name,
    data_type
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'profiles'
ORDER BY 
    ordinal_position;
