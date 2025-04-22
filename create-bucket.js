import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kwedbyldfnmalhotffjt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3ZWRieWxkZm5tYWxob3RmZmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MjE1ODQsImV4cCI6MjA1NDE5NzU4NH0.IQgSlGmg2Xs_89zwF32AskFsbKu1dd5Mq_zVFKiO3zI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createBucket() {
  try {
    const { data, error } = await supabase
      .storage
      .createBucket('property-images', {
        public: true,
        fileSizeLimit: 52428800, // 50MB en bytes
      });

    if (error) {
      console.error('Erreur:', error.message);
    } else {
      console.log('Bucket créé avec succès:', data);
    }
  } catch (error) {
    console.error('Erreur:', error.message);
  }
}

createBucket();
