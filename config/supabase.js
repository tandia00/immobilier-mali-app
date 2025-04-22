import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://kwedbyldfnmalhotffjt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3ZWRieWxkZm5tYWxob3RmZmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2MjE1ODQsImV4cCI6MjA1NDE5NzU4NH0.IQgSlGmg2Xs_89zwF32AskFsbKu1dd5Mq_zVFKiO3zI';

// Remplacer complètement les fonctions de log pour désactiver tous les logs
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Fonction pour filtrer les logs de Supabase
const filterSupabaseLogs = (args) => {
  if (args && args.length > 0) {
    const logString = String(args[0]);
    return logString.includes('GoTrueClient') || 
           logString.includes('NOBRIDGE') || 
           logString.includes('supabase');
  }
  return false;
};

// Remplacer les fonctions de log pour filtrer les logs de Supabase
console.log = (...args) => {
  if (!filterSupabaseLogs(args)) {
    originalConsoleLog(...args);
  }
};

console.warn = (...args) => {
  if (!filterSupabaseLogs(args)) {
    originalConsoleWarn(...args);
  }
};

console.error = (...args) => {
  if (!filterSupabaseLogs(args)) {
    originalConsoleError(...args);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  // Désactiver complètement les logs
  debug: false,
  logger: {
    warn: () => {},
    error: () => {},
    debug: () => {}
  }
});
