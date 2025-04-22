import { supabase } from '../config/supabase';

export const getImageUrl = async (fileUrl) => {
  if (!fileUrl) {
    console.log('URL manquante');
    return null;
  }
  
  // Si l'URL est déjà une URL Supabase complète, on la retourne directement
  if (fileUrl.startsWith('https://kwedbyldfnmalhotffjt.supabase.co/')) {
    return fileUrl;
  }
  
  // Si c'est une image en base64, on la retourne directement
  if (fileUrl.startsWith('data:image/')) {
    return fileUrl;
  }
  
  // Si c'est une URL locale (file://), on retourne une image par défaut
  if (fileUrl.startsWith('file://')) {
    // Retourner l'URL locale telle quelle, elle sera accessible sur l'appareil qui l'a créée
    return fileUrl;
  }
  
  // Sinon, on essaie de créer une URL signée
  try {
    const { data, error } = await supabase.storage
      .from('property-images')
      .createSignedUrl(fileUrl, 3600);

    if (error) {
      console.error('Erreur lors de la récupération de l\'URL signée:', error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error('Erreur inattendue:', error);
    return null;
  }
};
