// Fichier de configuration pour désactiver les logs indésirables
// Ce fichier doit être importé en premier dans index.js ou App.js

// Sauvegarder les fonctions de console originales
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

// Liste des termes à filtrer dans les logs
const FILTERED_TERMS = [
  'GoTrueClient',
  'NOBRIDGE',
  'supabase',
  'NotificationService',
  '#_',
  '#get',
  '#__',
  '#auto',
  'lock acquired',
  'lock released',
  'session from storage',
  'session has not expired',
];

// Fonction pour vérifier si un log doit être filtré
const shouldFilter = (args) => {
  if (!args || args.length === 0) return false;
  
  // Convertir tous les arguments en chaînes et les joindre
  const logString = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  // Vérifier si le log contient l'un des termes à filtrer
  return FILTERED_TERMS.some(term => logString.includes(term));
};

// Remplacer les fonctions de console
console.log = (...args) => {
  if (!shouldFilter(args)) {
    originalConsoleLog(...args);
  }
};

console.warn = (...args) => {
  if (!shouldFilter(args)) {
    originalConsoleWarn(...args);
  }
};

console.error = (...args) => {
  // Toujours afficher les erreurs, sauf si elles contiennent des termes spécifiques à Supabase
  if (!shouldFilter(args)) {
    originalConsoleError(...args);
  }
};

console.info = (...args) => {
  if (!shouldFilter(args)) {
    originalConsoleInfo(...args);
  }
};

console.debug = (...args) => {
  if (!shouldFilter(args)) {
    originalConsoleDebug(...args);
  }
};

// Fonction pour restaurer les fonctions de console originales si nécessaire
export const restoreConsoleFunctions = () => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
  console.info = originalConsoleInfo;
  console.debug = originalConsoleDebug;
};

// Fonction pour désactiver complètement tous les logs
export const disableAllLogs = () => {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.info = () => {};
  console.debug = () => {};
};

// Exporter la liste des termes filtrés pour permettre de la modifier ailleurs
export const filteredTerms = FILTERED_TERMS;
