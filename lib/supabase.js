import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = 'https://kwedbyldfnmalhotffjt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3ZWRieWxkZm5tYWxob3RmZmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MjE1ODQsImV4cCI6MjA1NDE5NzU4NH0.IQgSlGmg2Xs_89zwF32AskFsbKu1dd5Mq_zVFKiO3zI';

// Wrapper personnalisé pour AsyncStorage pour gérer les erreurs de session
const customStorage = {
  getItem: async (key) => {
    try {
      const data = await AsyncStorage.getItem(key);
      return data;
    } catch (error) {
      console.error(`[Supabase] Erreur lors de la récupération de ${key}:`, error);
      return null;
    }
  },
  setItem: async (key, value) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`[Supabase] Erreur lors de l'enregistrement de ${key}:`, error);
    }
  },
  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`[Supabase] Erreur lors de la suppression de ${key}:`, error);
    }
  }
};

// Créer le client Supabase avec une configuration améliorée
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Augmenter le délai avant expiration pour éviter les problèmes de token
    flowType: 'pkce',
    debug: __DEV__,
  },
  // Ajouter des en-têtes personnalisés pour aider au débogage
  global: {
    headers: {
      'X-Client-Info': `immobilier-mali-app/${Platform.OS}`
    },
  },
});

// Fonction pour gérer les erreurs d'authentification
export const handleAuthError = async (error) => {
  if (error && error.message && error.message.includes('Invalid Refresh Token')) {
    console.warn('[Supabase] Token de rafraîchissement invalide, tentative de nettoyage de session');
    
    try {
      // Effacer la session locale
      await AsyncStorage.removeItem('supabase.auth.token');
      
      // Déconnecter l'utilisateur pour forcer une nouvelle connexion
      await supabase.auth.signOut();
      
      console.log('[Supabase] Session nettoyée avec succès');
      return true;
    } catch (cleanupError) {
      console.error('[Supabase] Erreur lors du nettoyage de la session:', cleanupError);
      return false;
    }
  }
  return false;
};
