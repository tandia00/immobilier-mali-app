// Configuration globale pour les logs de l'application
// Permet de contrôler facilement le niveau de verbosité des logs

const LOG_LEVELS = {
  NONE: 0,    // Aucun log
  ERROR: 1,   // Uniquement les erreurs
  WARN: 2,    // Erreurs et avertissements
  INFO: 3,    // Informations générales
  DEBUG: 4,   // Logs détaillés pour le débogage
  VERBOSE: 5  // Tous les logs, très verbeux
};

// Définir le niveau de log actuel (changer cette valeur pour contrôler la verbosité)
// En production, utilisez ERROR ou WARN
// En développement, utilisez INFO ou DEBUG selon les besoins
const CURRENT_LOG_LEVEL = LOG_LEVELS.ERROR;

// Logger personnalisé qui respecte le niveau de log configuré
export const logger = {
  error: (message, ...args) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(message, ...args);
    }
  },
  
  warn: (message, ...args) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(message, ...args);
    }
  },
  
  info: (message, ...args) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.INFO) {
      console.log(message, ...args);
    }
  },
  
  debug: (message, ...args) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  
  verbose: (message, ...args) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.VERBOSE) {
      console.log(`[VERBOSE] ${message}`, ...args);
    }
  }
};

// Fonction utilitaire pour désactiver temporairement tous les logs
export const disableAllLogs = () => {
  // Sauvegarde des fonctions originales
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalConsoleDebug = console.debug;
  const originalConsoleInfo = console.info;
  
  // Remplacer par des fonctions vides
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};
  console.info = () => {};
  
  // Retourner une fonction pour restaurer les logs
  return () => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    console.debug = originalConsoleDebug;
    console.info = originalConsoleInfo;
  };
};

// Fonction pour désactiver temporairement les logs pendant l'exécution d'une fonction
export const withoutLogs = async (fn) => {
  const restore = disableAllLogs();
  try {
    return await fn();
  } finally {
    restore();
  }
};
