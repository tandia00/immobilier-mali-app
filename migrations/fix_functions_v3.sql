-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_messages_status(BIGINT);
DROP FUNCTION IF EXISTS public.has_messages(BIGINT);

-- Recreate get_messages_status with fixed search_path
CREATE OR REPLACE FUNCTION public.get_messages_status(p_property_id BIGINT)
RETURNS TABLE (
    unread_count BIGINT,
    last_message_date TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
STABLE
LANGUAGE plpgsql
AS $$
BEGIN
    RESET search_path;
    
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS unread_count,
        MAX(created_at) AS last_message_date
    FROM public.messages
    WHERE property_id = p_property_id
    AND receiver_id = auth.uid()
    AND read = false;
END;
$$ SET search_path = '';

-- Recreate has_messages with fixed search_path
CREATE OR REPLACE FUNCTION public.has_messages(p_property_id BIGINT)
RETURNS BOOLEAN
SECURITY DEFINER
STABLE
LANGUAGE plpgsql
AS $$
BEGIN
    RESET search_path;
    
    RETURN EXISTS (
        SELECT 1
        FROM public.messages
        WHERE property_id = p_property_id
        AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    );
END;
$$ SET search_path = '';
