SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_name = 'profiles'
);
