-- Drop existing function and trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Recreate handle_new_user with proper security settings
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''  -- Empty string for maximum security
AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;  -- Prevent duplicate entries
    
    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Clean up any duplicate profiles
DELETE FROM public.profiles a
    USING public.profiles b
    WHERE a.id = b.id 
    AND a.created_at > b.created_at;

-- Ensure each auth.users has exactly one profile
INSERT INTO public.profiles (id, email)
SELECT id, email
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.id = u.id
);
