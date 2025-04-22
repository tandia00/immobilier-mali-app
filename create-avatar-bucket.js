import { supabase } from './config/supabase.js';

async function createAvatarBucket() {
  try {
    // Créer le bucket pour les avatars
    const { data, error } = await supabase
      .storage
      .createBucket('avatars', {
        public: true,
        fileSizeLimit: 1024 * 1024 * 2, // 2MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg']
      });

    if (error) throw error;
    console.log('Bucket avatars créé avec succès:', data);

    // Définir la politique de stockage pour permettre l'accès public
    const { error: policyError } = await supabase
      .storage
      .from('avatars')
      .createSignedUrl('policy.sql', 3600);

    if (policyError) throw policyError;
    console.log('Politique de stockage mise à jour avec succès');

  } catch (error) {
    console.error('Erreur:', error.message);
  }
}

createAvatarBucket();
