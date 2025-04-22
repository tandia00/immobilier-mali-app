// Configuration Stripe
export const STRIPE_CONFIG = {
  // Clé publique Stripe pour l'environnement de production
  publishableKey: 'pk_live_51RG9DlKpW6LLUAeyv5RuQwjG2h840MbZ5Ta1l7LosDQjHPogdfzjqtZ28esXjT8kx3pDEXw72gDPEoPYAMiybRNB00Ul8n2rhS',
  // URLs de votre backend pour les opérations Stripe
  // En développement: utiliser localhost
  // En production: utiliser l'URL de votre backend déployé sur Render
  paymentIntentUrl: __DEV__ ? 'http://localhost:3000/api/payment/create-intent' : 'https://sigiyoro-payment-api.onrender.com/api/payment/create-intent',
  capturePaymentUrl: __DEV__ ? 'http://localhost:3000/api/payment/capture' : 'https://sigiyoro-payment-api.onrender.com/api/payment/capture',
  cancelPaymentUrl: __DEV__ ? 'http://localhost:3000/api/payment/cancel' : 'https://sigiyoro-payment-api.onrender.com/api/payment/cancel',
  // Configuration pour le Mali et la France
  merchantIdentifier: 'merchant.com.immobiliermali',
  // Paramètres additionnels
  appName: 'Sigiyoro',
  companyDisplayName: 'Sigiyoro Immobilier Mali',
  // Activer le mode de débogage en développement
  enableLogging: process.env.NODE_ENV !== 'production',
  // Délai d'expiration des paiements en secondes (15 minutes)
  paymentExpirationTimeout: 15 * 60,
  // Capture différée des paiements (uniquement après validation admin)
  captureMethod: 'manual',
};

// Montant fixe pour les frais de publication d'annonce
export const LISTING_FEE = 5000; // 5000 FCFA

// Montants équivalents dans d'autres devises (configurés dans Stripe)
export const EQUIVALENT_AMOUNTS = {
  XOF: 5000,  // Franc CFA
  EUR: 9,     // Euro
  USD: 10.30, // Dollar américain
  GBP: 7.80,  // Livre sterling
  CAD: 14.20  // Dollar canadien
};

// Configuration des devises par région
export const CURRENCY_CONFIG = {
  // Afrique de l'Ouest (Mali, Sénégal, Côte d'Ivoire, etc.)
  XOF: {
    code: 'XOF',
    symbol: 'FCFA',
    name: 'Franc CFA',
    countries: ['ML', 'SN', 'CI', 'BF', 'BJ', 'NE', 'TG', 'GW'],
    default: true,
    stripeSupported: true,
    decimalPlaces: 0 // Pas de décimales pour le FCFA
  },
  // Europe
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    countries: ['FR', 'DE', 'ES', 'IT', 'BE', 'NL', 'PT', 'AT', 'FI', 'IE', 'LT', 'LV', 'SK', 'SI', 'EE', 'GR', 'MT', 'CY', 'LU'],
    stripeSupported: true,
    decimalPlaces: 2
  },
  // Amérique du Nord et du Sud
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'Dollar américain',
    countries: ['US', 'CA', 'MX', 'BR', 'AR', 'CO', 'CL', 'PE', 'EC', 'VE', 'DO', 'GT', 'CR', 'PA', 'UY', 'BS', 'BB'],
    stripeSupported: true,
    decimalPlaces: 2
  },
  // Royaume-Uni
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'Livre sterling',
    countries: ['GB'],
    stripeSupported: true,
    decimalPlaces: 2
  },
  // Canada
  CAD: {
    code: 'CAD',
    symbol: 'CA$',
    name: 'Dollar canadien',
    countries: ['CA'],
    stripeSupported: true,
    decimalPlaces: 2
  },
  // Autres régions peuvent être ajoutées ici
};

/**
 * Détermine la devise à utiliser en fonction du pays de l'utilisateur
 * @param {string} countryCode - Code ISO du pays (ex: 'FR', 'ML')
 * @returns {Object} - Configuration de la devise
 */
export const getCurrencyByCountry = (countryCode) => {
  if (!countryCode) return CURRENCY_CONFIG.XOF; // Par défaut: FCFA
  
  // Rechercher la devise correspondant au pays
  for (const [code, config] of Object.entries(CURRENCY_CONFIG)) {
    if (config.countries.includes(countryCode)) {
      return config;
    }
  }
  
  // Si aucune correspondance, retourner la devise par défaut
  return CURRENCY_CONFIG.XOF;
};

/**
 * Convertit un montant de FCFA vers une autre devise ou inversement
 * Note: Dans une application réelle, utilisez une API de taux de change
 * @param {number} amount - Montant à convertir
 * @param {string} fromCurrency - Code de la devise source
 * @param {string} toCurrency - Code de la devise cible
 * @returns {number} - Montant converti
 */
export const convertCurrency = (amount, fromCurrency = 'XOF', toCurrency = 'XOF') => {
  // Si les devises sont identiques, retourner le montant tel quel
  if (fromCurrency === toCurrency) return amount;
  
  // Si nous avons des montants équivalents préconfigurés et que nous convertissons depuis XOF
  if (fromCurrency === 'XOF' && EQUIVALENT_AMOUNTS[toCurrency]) {
    return EQUIVALENT_AMOUNTS[toCurrency];
  }
  
  // Si nous convertissons vers XOF et que nous avons des montants équivalents préconfigurés
  if (toCurrency === 'XOF' && EQUIVALENT_AMOUNTS[fromCurrency]) {
    return LISTING_FEE; // Montant fixe en XOF
  }
  
  // Taux de conversion approximatifs (1 unité de devise = X FCFA)
  const ratesFromXOF = {
    'EUR': 0.0015, // 1 FCFA ≈ 0.0015 EUR
    'USD': 0.0017, // 1 FCFA ≈ 0.0017 USD
    'GBP': 0.0013, // 1 FCFA ≈ 0.0013 GBP
    'CAD': 0.0023  // 1 FCFA ≈ 0.0023 CAD
  };
  
  // Taux de conversion inverses (1 unité de devise = X FCFA)
  const ratesToXOF = {
    'EUR': 655.957, // 1 EUR ≈ 655.957 FCFA
    'USD': 588.235, // 1 USD ≈ 588.235 FCFA
    'GBP': 769.231, // 1 GBP ≈ 769.231 FCFA
    'CAD': 434.783  // 1 CAD ≈ 434.783 FCFA
  };
  
  // Conversion de XOF vers une autre devise
  if (fromCurrency === 'XOF') {
    return amount * (ratesFromXOF[toCurrency] || 1);
  }
  
  // Conversion d'une autre devise vers XOF
  if (toCurrency === 'XOF') {
    return amount * (ratesToXOF[fromCurrency] || 1);
  }
  
  // Conversion entre deux devises étrangères (via XOF)
  const amountInXOF = amount * (ratesToXOF[fromCurrency] || 1);
  return amountInXOF * (ratesFromXOF[toCurrency] || 1);
};

/**
 * Convertit un montant de FCFA vers une autre devise (pour compatibilité)
 * @param {number} amount - Montant en FCFA
 * @param {string} targetCurrency - Code de la devise cible
 * @returns {number} - Montant converti
 */
export const convertAmount = (amount, targetCurrency = 'XOF') => {
  return convertCurrency(amount, 'XOF', targetCurrency);
};

/**
 * Formate un montant selon la devise spécifiée
 * @param {number} amount - Montant à formater
 * @param {string} currencyCode - Code de la devise
 * @returns {string} - Montant formaté avec symbole de devise
 */
export const formatAmount = (amount, currencyCode = 'XOF') => {
  const currency = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.XOF;
  
  // Formater le montant selon le nombre de décimales de la devise
  const formattedAmount = currency.decimalPlaces > 0 
    ? amount.toFixed(currency.decimalPlaces) 
    : Math.round(amount).toString();
  
  // Ajouter des séparateurs de milliers
  const parts = formattedAmount.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  
  // Retourner le montant formaté avec le symbole de la devise
  return `${parts.join(',')} ${currency.symbol}`;
};

/**
 * Vérifie si une devise est supportée par Stripe
 * @param {string} currencyCode - Code de la devise à vérifier
 * @returns {boolean} - True si la devise est supportée
 */
export const isCurrencySupportedByStripe = (currencyCode) => {
  const currency = CURRENCY_CONFIG[currencyCode];
  return currency ? currency.stripeSupported : false;
};

/**
 * Convertit un montant en cents pour Stripe (nécessaire pour certaines devises)
 * @param {number} amount - Montant dans la devise spécifiée
 * @param {string} currencyCode - Code de la devise
 * @returns {number} - Montant en cents pour Stripe
 */
export const convertAmountToCents = (amount, currencyCode = 'XOF') => {
  const currency = CURRENCY_CONFIG[currencyCode] || CURRENCY_CONFIG.XOF;
  
  // Pour les devises sans décimales comme le FCFA, pas besoin de multiplier par 100
  if (currency.decimalPlaces === 0) {
    return Math.round(amount);
  }
  
  // Pour les autres devises, convertir en cents (multiplier par 100)
  return Math.round(amount * 100);
};
