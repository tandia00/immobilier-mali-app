import { supabase } from '../lib/supabase';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from './NotificationService';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import { STRIPE_CONFIG, CURRENCY_CONFIG, EQUIVALENT_AMOUNTS, convertAmountToCents, formatAmount } from '../config/stripe';
import { stripeService } from './StripeService';

// Configuration des API de paiement (à remplacer par vos clés réelles)
const API_CONFIG = {
  orange_money: {
    apiKey: process.env.ORANGE_MONEY_API_KEY || 'test_key_orange',
    apiUrl: process.env.ORANGE_MONEY_API_URL || 'https://api.orange.com/payment/v1',
    supportedCurrencies: ['XOF'],
    minAmount: 100,
    maxAmount: 2000000
  },
  moov_money: {
    apiKey: process.env.MOOV_MONEY_API_KEY || 'test_key_moov',
    apiUrl: process.env.MOOV_MONEY_API_URL || 'https://api.moov.ml/payment/v1',
    supportedCurrencies: ['XOF'],
    minAmount: 100,
    maxAmount: 1000000
  },
  card: {
    apiKey: STRIPE_CONFIG.publishableKey,
    apiUrl: STRIPE_CONFIG.paymentIntentUrl,
    supportedCurrencies: Object.keys(CURRENCY_CONFIG).filter(code => CURRENCY_CONFIG[code].stripeSupported),
    minAmounts: {
      XOF: 100,     // 100 FCFA minimum
      EUR: 1,       // 1 EUR minimum
      USD: 1,       // 1 USD minimum
      GBP: 1,       // 1 GBP minimum
      CAD: 1        // 1 CAD minimum
    },
    maxAmounts: {
      XOF: 10000000, // 10 millions FCFA maximum
      EUR: 15000,    // 15 000 EUR maximum
      USD: 17000,    // 17 000 USD maximum
      GBP: 13000,    // 13 000 GBP maximum
      CAD: 23000     // 23 000 CAD maximum
    }
  },
  bank_transfer: {
    apiKey: process.env.BANK_API_KEY || 'test_key_bank',
    apiUrl: process.env.BANK_API_URL || 'https://api.bankservice.ml/transfer/v1',
    supportedCurrencies: ['XOF', 'EUR', 'USD'],
    minAmount: 1000,
    maxAmount: 50000000
  }
};

// Configuration des erreurs
const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYMENT_DECLINED: 'PAYMENT_DECLINED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// Messages d'erreur localisés
const ERROR_MESSAGES = {
  [ERROR_CODES.NETWORK_ERROR]: 'Problème de connexion réseau. Veuillez vérifier votre connexion Internet.',
  [ERROR_CODES.AUTHENTICATION_ERROR]: 'Erreur d\'authentification. Veuillez vous reconnecter.',
  [ERROR_CODES.VALIDATION_ERROR]: 'Les informations de paiement sont invalides. Veuillez vérifier vos données.',
  [ERROR_CODES.PAYMENT_DECLINED]: 'Paiement refusé par votre établissement financier.',
  [ERROR_CODES.INSUFFICIENT_FUNDS]: 'Fonds insuffisants pour effectuer ce paiement.',
  [ERROR_CODES.PROVIDER_ERROR]: 'Erreur du fournisseur de paiement. Veuillez réessayer ultérieurement.',
  [ERROR_CODES.SERVER_ERROR]: 'Erreur serveur. Veuillez réessayer ultérieurement.',
  [ERROR_CODES.TIMEOUT_ERROR]: 'Le paiement a expiré. Veuillez réessayer.',
  [ERROR_CODES.UNKNOWN_ERROR]: 'Une erreur inconnue est survenue. Veuillez réessayer ou contacter le support.'
};

/**
 * Service de paiement pour gérer les transferts d'argent et les frais de publication
 */
export const PaymentService = {
  /**
   * Vérifie la connectivité réseau
   * @returns {Promise<boolean>} - True si la connexion est disponible
   * @private
   */
  async _checkNetworkConnectivity() {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected && state.isInternetReachable;
    } catch (error) {
      console.error('Erreur lors de la vérification de la connectivité:', error);
      return false;
    }
  },

  /**
   * Vérifie l'authentification de l'utilisateur
   * @returns {Promise<Object>} - Données de l'utilisateur
   * @private
   */
  async _checkAuthentication() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        throw new Error(ERROR_MESSAGES[ERROR_CODES.AUTHENTICATION_ERROR]);
      }
      return data.user;
    } catch (error) {
      console.error('Erreur d\'authentification:', error);
      throw new Error(ERROR_MESSAGES[ERROR_CODES.AUTHENTICATION_ERROR]);
    }
  },

  /**
   * Valide les détails du paiement
   * @param {Object} paymentDetails - Détails du paiement à valider
   * @private
   */
  _validatePaymentDetails(paymentDetails) {
    const { amount, paymentMethod, currency = 'XOF', transactionType } = paymentDetails;
    
    // Exception pour les frais de publication d'annonce (montants fixes prédéfinis)
    const isListingFee = transactionType === 'listing_fee';
    if (isListingFee && EQUIVALENT_AMOUNTS) {
      // Vérifier si le montant correspond à l'un des montants équivalents prédéfinis
      const isValidAmount = Object.entries(EQUIVALENT_AMOUNTS).some(([currencyCode, equivalentAmount]) => {
        return currencyCode === currency && Math.abs(amount - equivalentAmount) < 0.1;
      });
      
      if (isValidAmount) {
        // Si c'est un montant valide pour les frais de publication, pas besoin de validation supplémentaire
        console.log(`Montant validé pour les frais de publication: ${amount} ${currency}`);
        return;
      }
    }

    // Vérifier que la méthode de paiement est supportée
    if (!API_CONFIG[paymentMethod]) {
      throw new Error(`Méthode de paiement non supportée: ${paymentMethod}`);
    }

    // Vérifier que la devise est supportée par la méthode de paiement
    if (!API_CONFIG[paymentMethod].supportedCurrencies.includes(currency)) {
      throw new Error(`La devise ${currency} n'est pas supportée par ${this._getMethodName(paymentMethod)}`);
    }

    // Vérifier que le montant est dans les limites autorisées
    if (paymentMethod === 'card') {
      // Pour les paiements par carte, utiliser les limites spécifiques à chaque devise
      const minAmount = API_CONFIG[paymentMethod].minAmounts[currency] || API_CONFIG[paymentMethod].minAmounts.XOF;
      const maxAmount = API_CONFIG[paymentMethod].maxAmounts[currency] || API_CONFIG[paymentMethod].maxAmounts.XOF;
      
      if (amount < minAmount || amount > maxAmount) {
        throw new Error(`Le montant doit être compris entre ${minAmount} et ${maxAmount} ${currency}`);
      }
    } else {
      // Pour les autres méthodes de paiement, utiliser les limites générales
      if (amount < API_CONFIG[paymentMethod].minAmount || amount > API_CONFIG[paymentMethod].maxAmount) {
        throw new Error(`Le montant doit être compris entre ${API_CONFIG[paymentMethod].minAmount} et ${API_CONFIG[paymentMethod].maxAmount} ${currency}`);
      }
    }

    // Validation spécifique selon la méthode de paiement
    if (paymentMethod === 'card' && paymentDetails.cardDetails) {
      // Validation basique des détails de la carte
      const { number, expiry, cvv } = paymentDetails.cardDetails;
      if (!number || !expiry || !cvv) {
        throw new Error('Informations de carte incomplètes');
      }
    } else if ((paymentMethod === 'orange_money' || paymentMethod === 'moov_money') && !paymentDetails.phoneNumber) {
      throw new Error('Numéro de téléphone requis pour ce mode de paiement');
    }
  },

  /**
   * Traite le paiement des frais de publication d'annonce
   * @param {Object} paymentDetails - Détails du paiement
   * @returns {Promise<Object>} - Résultat du paiement
   */
  async processListingFeePayment(paymentDetails) {
    const {
      userId,
      amount,
      paymentMethod,
      phoneNumber,
      cardDetails,
      transactionType,
      formData,
      currency = 'XOF',
      stripePaymentId
    } = paymentDetails;

    console.log('Détails du paiement:', {
      ...paymentDetails,
      formData: formData ? '***données***' : null,
      cardDetails: cardDetails ? '***sécurisé***' : null
    });
    
    // Vérifier que le montant correspond au montant équivalent pour cette devise
    if (currency !== 'XOF') {
      const expectedAmount = EQUIVALENT_AMOUNTS[currency];
      if (expectedAmount && Math.abs(amount - expectedAmount) > 0.1) {
        console.warn(`Montant incorrect pour les frais de publication en ${currency}. Reçu: ${amount}, Attendu: ${expectedAmount}`);
        // Corriger automatiquement le montant
        paymentDetails.amount = expectedAmount;
        console.log(`Montant corrigé automatiquement à ${expectedAmount} ${currency}`);
      }
    }

    try {
      // Vérifier la connectivité réseau
      const isConnected = await this._checkNetworkConnectivity();
      if (!isConnected) {
        throw new Error(ERROR_MESSAGES[ERROR_CODES.NETWORK_ERROR]);
      }

      // Vérifier l'authentification de l'utilisateur
      const user = await this._checkAuthentication();
      
      // Vérifier la concordance des IDs utilisateur
      if (userId !== user.id) {
        console.warn('ID utilisateur différent:', { 
          providedId: userId, 
          authenticatedId: user.id 
        });
        
        // En mode développement, permettre la différence d'ID pour faciliter les tests
        if (__DEV__) {
          console.warn('Mode développement: utilisation de l\'ID authentifié malgré la différence');
          // Remplacer l'ID fourni par l'ID authentifié
          paymentDetails.userId = user.id;
        } else {
          // En production, exiger une correspondance exacte
          throw new Error('ID utilisateur non concordant. Veuillez vous reconnecter.');
        }
      }

      // Valider les détails du paiement
      this._validatePaymentDetails(paymentDetails);

      // Stocker temporairement les données du formulaire dans AsyncStorage
      if (formData) {
        try {
          await AsyncStorage.setItem('pending_listing_' + userId, formData);
          console.log('Données du formulaire stockées temporairement pour l\'utilisateur:', userId);
        } catch (storageError) {
          console.error('Erreur lors du stockage des données du formulaire:', storageError);
          // Ne pas bloquer le processus si le stockage échoue
        }
      }

      // Générer un ID de transaction
      let transactionId;
      if (stripePaymentId) {
        // Utiliser l'ID de paiement Stripe si disponible
        transactionId = stripePaymentId;
      } else {
        // Générer un ID de transaction pour les autres méthodes
        transactionId = `listing-fee-${paymentMethod}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }

      // Pour les paiements par carte, utiliser le service Stripe avec capture différée
      if (paymentMethod === 'card') {
        try {
          console.log('Création d\'une intention de paiement Stripe avec capture différée');
          
          // Créer une intention de paiement avec capture différée
          const paymentIntent = await stripeService.createPaymentIntent({
            amount: amount,
            currency: currency || { code: 'XOF' },
            userId: userId,
            propertyId: null
          });
          
          console.log('Intention de paiement créée avec succès:', paymentIntent.id);
          transactionId = paymentIntent.id;
          
          // Enregistrer la transaction avec statut 'pending' (en attente de validation admin)
          const transactionData = {
            buyer_id: userId,                // L'utilisateur qui paie les frais
            seller_id: userId,               // Pour les frais de publication, c'est le même utilisateur
            amount: amount,                  // Montant du paiement
            payment_method: paymentMethod,   // Méthode de paiement (card)
            status: 'pending',               // Statut en attente de validation admin
            transaction_type: 'sale',         // Type de transaction
            phone_number: phoneNumber || null,
            transfer_reference: paymentIntent.id  // Référence de l'intention de paiement Stripe
          };
          
          // Ajouter les champs optionnels seulement s'ils ont une valeur
          if (cardDetails && (cardDetails.last4 || (cardDetails.number && cardDetails.number.length >= 4))) {
            transactionData.card_last_digits = cardDetails.last4 || cardDetails.number.slice(-4);
          }
          
          const { data: transaction, error: transactionError } = await supabase
            .from('transactions')
            .insert(transactionData);
            
          if (transactionError) {
            console.error('Erreur lors de l\'enregistrement de la transaction:', transactionError);
            return {
              success: false,
              error: 'Erreur lors de l\'enregistrement de la transaction',
              details: transactionError
            };
          }
          
          console.log('Transaction enregistrée avec succès, en attente de validation admin');
        } catch (stripeError) {
          console.error('Erreur Stripe:', stripeError);
          return {
            success: false,
            error: 'Erreur lors de la création de l\'intention de paiement',
            details: stripeError
          };
        }
      } else {
        // Pour les autres méthodes de paiement (Orange Money, etc.), utiliser le processus standard
        console.log('Tentative d\'insertion dans la table transactions avec les données suivantes:', {
          buyer_id: userId,
          seller_id: userId,
          amount,
          payment_method: paymentMethod,
          transaction_type: 'sale'
        });
        
        const transactionData = {
          buyer_id: userId,                // L'utilisateur qui paie les frais
          seller_id: userId,               // Pour les frais de publication, c'est le même utilisateur
          amount: amount,                  // Montant du paiement
          payment_method: paymentMethod,   // Méthode de paiement (orange_money, moov_money, etc.)
          status: 'pending',               // Statut en attente de validation admin
          transaction_type: 'sale',         // Type de transaction
          phone_number: phoneNumber || null,
          property_id: null
        };
        
        if (transactionId) {
          transactionData.transfer_reference = transactionId;
        }
        
        const { data: transaction, error: transactionError } = await supabase
          .from('transactions')
          .insert(transactionData)
          .select()
          .single();

        if (transactionError) {
          console.error('Erreur lors de l\'enregistrement de la transaction:', transactionError);
          
          // Analyse détaillée de l'erreur pour le diagnostic
          if (transactionError.code === '23514') {
            console.error('Erreur de contrainte de vérification. Détails:', transactionError.details);
            console.error('Message:', transactionError.message);
            
            // Essayons avec une autre valeur pour transaction_type
            console.log('Tentative avec une autre valeur pour transaction_type...');
            transactionData.transaction_type = 'payment'; // Essai avec 'payment'
            
            const { data: retryTransaction, error: retryError } = await supabase
              .from('transactions')
              .insert(transactionData)
              .select()
              .single();
            
            if (retryError) {
              console.error('Nouvelle tentative échouée avec transaction_type=payment:', retryError);
              
              // Dernier essai avec 'purchase'
              transactionData.transaction_type = 'purchase';
              const { data: lastRetryTransaction, error: lastRetryError } = await supabase
                .from('transactions')
                .insert(transactionData)
                .select()
                .single();
                
              if (lastRetryError) {
                console.error('Dernière tentative échouée avec transaction_type=purchase:', lastRetryError);
                return {
                  success: false,
                  error: 'Erreur lors de l\'enregistrement de la transaction après plusieurs tentatives',
                  details: lastRetryError
                };
              } else {
                console.log('Transaction enregistrée avec succès après correction du type de transaction à "purchase"');
                return {
                  success: true,
                  transaction: lastRetryTransaction,
                  transactionId: transactionId
                };
              }
            } else {
              console.log('Transaction enregistrée avec succès après correction du type de transaction à "payment"');
              return {
                success: true,
                transaction: retryTransaction,
                transactionId: transactionId
              };
            }
          }
          
          return {
            success: false,
            error: 'Erreur lors de l\'enregistrement de la transaction',
            details: transactionError
          };
        }

      // Fermeture de la condition else pour les méthodes de paiement autres que la carte
      }
      
      // Stocker l'historique du paiement localement pour référence future
      try {
        // Récupérer l'historique existant
        const existingHistoryString = await AsyncStorage.getItem('payment_history_' + userId) || '[]';
        const existingHistory = JSON.parse(existingHistoryString);

        // Ajouter le nouveau paiement à l'historique
        existingHistory.push({
          id: transactionId,
          type: 'listing_fee',
          amount: amount,
          currency: currency,
          payment_method: paymentMethod,
          date: new Date().toISOString(),
          status: 'pending' // Statut en attente de validation admin
        });

        // Limiter la taille de l'historique pour éviter les problèmes de mémoire
        if (existingHistory.length > 20) {
          existingHistory.splice(0, existingHistory.length - 20);
        }

        // Sauvegarder l'historique mis à jour
        await AsyncStorage.setItem('payment_history_' + userId, JSON.stringify(existingHistory));
        console.log('Historique de paiement mis à jour localement');
      } catch (historyError) {
        console.error('Erreur lors de la mise à jour de l\'historique de paiement:', historyError);
        // Ne pas bloquer le processus si la mise à jour de l'historique échoue
      }

      // Créer l'annonce dans la base de données
      let property = null;
      if (formData) {
        try {
          const propertyData = JSON.parse(formData);
          console.log('Création de l\'annonce avec les données:', {
            ...propertyData,
            images: propertyData.images ? `${propertyData.images.length} images` : 'aucune image'
          });

          // Préparer les données de la propriété en filtrant les champs non valides
          const propertyFields = {
            user_id: userId,
            title: propertyData.title,
            description: propertyData.description,
            price: parseFloat(propertyData.price) || 0,
            type: propertyData.type,
            city: propertyData.city,
            phone: propertyData.phone,
            transaction_type: propertyData.transaction_type,
            status: 'pending' // En attente de validation par l'administrateur
          };

          // Ajouter les champs optionnels s'ils existent
          if (propertyData.rooms) propertyFields.rooms = parseInt(propertyData.rooms);
          if (propertyData.bathrooms) propertyFields.bathrooms = parseInt(propertyData.bathrooms);
          if (propertyData.surface) propertyFields.surface = parseFloat(propertyData.surface);
          if (propertyData.address) propertyFields.address = propertyData.address;
          if (propertyData.neighborhood) propertyFields.neighborhood = propertyData.neighborhood;

          // Insérer l'annonce dans la table properties
          const { data: newProperty, error: propertyError } = await supabase
            .from('properties')
            .insert(propertyFields)
            .select()
            .single();

          if (propertyError) {
            console.error('Erreur lors de la création de l\'annonce:', propertyError);
          } else {
            property = newProperty;
            console.log('Annonce créée avec succès:', property.id);

            // Si des images sont présentes, les traiter
            if (propertyData.images && propertyData.images.length > 0) {
              try {
                // Optimiser les images pour éviter les problèmes de mémoire
                const optimizedImages = propertyData.images.slice(0, 10); // Limiter à 10 images maximum

                const { error: updateError } = await supabase
                  .from('properties')
                  .update({
                    images: optimizedImages
                  })
                  .eq('id', property.id);

                if (updateError) {
                  console.error('Erreur lors de la mise à jour des images de la propriété:', updateError);
                } else {
                  console.log(`${optimizedImages.length} images ajoutées à la propriété ${property.id}`);
                }
              } catch (imageError) {
                console.error('Exception lors de la mise à jour des images:', imageError);
              }
            }

            // Supprimer les données temporaires du formulaire
            await AsyncStorage.removeItem('pending_listing_' + userId);
          }
        } catch (parseError) {
          console.error('Erreur lors de l\'analyse des données du formulaire:', parseError);
        }
      }

      // Créer une notification pour informer l'utilisateur
      try {
        const formattedAmount = formatAmount(amount, currency);
        await notificationService.createNotification({
          title: 'Paiement réussi',
          message: `Votre paiement de ${formattedAmount} pour la publication d'annonce a été traité avec succès.`,
          type: 'payment_success',
          data: {
            amount: amount,
            currency: currency,
            payment_method: paymentMethod,
            transaction_id: transactionId,
            transaction_type: 'listing_fee',
            property_id: property ? property.id : null
          },
          read: false,
          user_id: userId
        });
      } catch (notificationError) {
        console.error('Erreur lors de la création de la notification:', notificationError);
        // Ne pas bloquer le processus si la notification échoue
      }

      return {
        success: true,
        transactionId: transactionId,
        propertyId: property ? property.id : null,
        status: 'completed',
        message: 'Paiement traité avec succès. Votre annonce sera publiée après validation.'
      };
    } catch (error) {
      console.error('Erreur complète lors du traitement du paiement:', error);
      
      // Enregistrer l'erreur dans les logs
      try {
        await supabase
          .from('error_logs')
          .insert({
            user_id: userId,
            error_type: 'payment_error',
            error_message: error.message,
            error_details: JSON.stringify({
              payment_method: paymentMethod,
              amount: amount,
              currency: currency,
              timestamp: new Date().toISOString(),
              platform: Platform.OS,
              version: Platform.Version
            }),
            created_at: new Date().toISOString()
          });
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement du log d\'erreur:', logError);
      }
      
      throw error;
    }
  },

  /**
   * Effectue un paiement direct au propriétaire
   * @param {Object} paymentDetails - Détails du paiement
   * @returns {Promise<Object>} - Résultat du paiement
   */
  async processDirectPayment(paymentDetails) {
    const {
      amount,
      buyerId,
      sellerId,
      propertyId,
      paymentMethod,
      transactionType,
      buyerPhoneNumber,
      cardDetails,
      propertyName,
      sellerName,
      buyerName
    } = paymentDetails;

    try {
      // Validation du montant (doit être inférieur à 100 millions FCFA)
      if (amount > 100000000) {
        throw new Error('Le montant maximum autorisé est de 100 millions FCFA');
      }

      // 1. Récupérer les informations de paiement du vendeur
      const { data: sellerPaymentInfo, error: sellerInfoError } = await supabase
        .from('payment_info')
        .select('*')
        .eq('user_id', sellerId)
        .single();

      // Définir une méthode par défaut et des informations vides si le vendeur n'a pas configuré ses informations
      let sellerPreferredMethod = 'orange_money';
      let sellerHasPaymentInfo = false;
      
      if (sellerInfoError && sellerInfoError.code !== 'PGRST116') {
        console.error('Erreur lors de la récupération des informations de paiement:', sellerInfoError);
        // Continuer avec les valeurs par défaut au lieu de lancer une erreur
      } else if (sellerPaymentInfo) {
        sellerPreferredMethod = sellerPaymentInfo.preferred_method || 'orange_money';
        sellerHasPaymentInfo = true;
      }

      // Vérifier si c'est une nouvelle propriété (ID temporaire)
      const isNewProperty = propertyId?.toString().startsWith('temp-');
      
      // Si c'est une nouvelle propriété, on utilise un ID temporaire pour la transaction
      // et on stocke les informations pour une utilisation ultérieure
      if (isNewProperty) {
        console.log('Transaction pour une nouvelle propriété (ID temporaire):', propertyId);
        
        // Stocker les informations de paiement pour une utilisation ultérieure
        try {
          await AsyncStorage.setItem('pending_payment_' + buyerId, JSON.stringify({
            amount,
            buyerId,
            sellerId,
            paymentMethod,
            transactionType,
            buyerPhoneNumber,
            timestamp: new Date().toISOString(),
            status: 'prepaid'
          }));
          
          console.log('Informations de paiement temporaires stockées pour l\'utilisateur:', buyerId);
          
          // Retourner un résultat de succès sans créer de transaction dans la base de données
          return {
            success: true,
            status: 'prepaid',
            message: 'Paiement enregistré. Il sera associé à votre propriété une fois celle-ci créée.'
          };
        } catch (storageError) {
          console.error('Erreur lors du stockage des informations de paiement temporaires:', storageError);
          throw new Error('Impossible de finaliser le paiement pour le moment. Veuillez réessayer.');
        }
      }
      
      // 3. Créer la transaction dans la base de données avec statut approprié
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          property_id: propertyId,
          buyer_id: buyerId,
          seller_id: sellerId,
          amount: amount,
          payment_method: paymentMethod,
          status: sellerHasPaymentInfo ? 'processing' : 'pending_seller_info',
          transaction_type: 'sale', // Utiliser 'sale' au lieu de 'purchase'
          phone_number: buyerPhoneNumber || null,
          card_last_digits: cardDetails ? cardDetails.cardNumber.slice(-4) : null,
          transfer_method: sellerPreferredMethod
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Si le vendeur n'a pas configuré ses informations de paiement, on s'arrête ici
      if (!sellerHasPaymentInfo) {
        // Créer une notification locale pour le propriétaire pour l'informer qu'il doit configurer ses informations
        try {
          // Créer une notification pour informer le propriétaire en utilisant le service de notification
          await notificationService.createNotification({
            id: `payment_info_${transaction.id}`,
            type: 'payment_info_needed',
            title: 'Configuration requise',
            message: 'Un acheteur souhaite vous payer. Veuillez configurer vos informations de paiement.',
            timestamp: new Date().toISOString(),
            data: {
              transaction_id: transaction.id,
              amount: amount,
              property_id: propertyId,
              property_name: propertyName || 'votre propriété',
              buyer_name: buyerName || 'un acheteur'
            },
            read: false,
            // Définir explicitement l'ID de l'utilisateur destiné à recevoir cette notification
            user_id: sellerId
          });
          
          console.log('[PaymentService] Notification de configuration requise créée pour le propriétaire:', sellerId);
        } catch (notificationError) {
          console.error('[PaymentService] Erreur lors de la création de la notification de configuration:', notificationError);
        }

        return {
          success: true,
          transactionId: transaction.id,
          status: 'pending_seller_info',
          message: 'Le propriétaire n\'a pas encore configuré ses informations de paiement. Il sera notifié de votre paiement.'
        };
      }

      // 4. Effectuer le transfert via l'API appropriée si le vendeur a configuré ses informations
      let transferResult;
      try {
        transferResult = await this._executeTransfer({
          buyerMethod: paymentMethod,
          sellerMethod: sellerPreferredMethod,
          amount,
          buyerPhoneNumber,
          cardDetails,
          sellerPaymentInfo,
          transactionId: transaction.id
        });
      } catch (transferError) {
        // En cas d'erreur de transfert, mettre à jour le statut de la transaction
        await supabase
          .from('transactions')
          .update({ status: 'failed', error_message: transferError.message })
          .eq('id', transaction.id);
        
        throw transferError;
      }

      // 5. Mettre à jour le statut de la transaction à "completed"
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ 
          status: 'completed',
          transfer_reference: transferResult.reference,
          completed_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('Erreur lors de la mise à jour de la transaction:', updateError);
      }

      // 6. Créer une notification pour le vendeur (propriétaire)
      try {
        if (sellerId) {
          // Créer la notification en utilisant le service de notification
          await notificationService.createNotification({
            id: `payment_${transaction.id}`,
            type: 'payment_received',
            title: 'Paiement reçu',
            message: `Vous avez reçu un paiement de ${amount.toLocaleString()} FCFA via ${this._getMethodName(sellerPreferredMethod)}`,
            timestamp: new Date().toISOString(),
            data: {
              transaction_id: transaction.id,
              amount: amount,
              payment_method: sellerPreferredMethod,
              reference: transferResult.reference,
              property_id: propertyId,
              property_name: propertyName || 'votre propriété',
              buyer_name: buyerName || 'un acheteur',
              seller_name: sellerName || 'vendeur'
            },
            read: false,
            // Définir explicitement l'ID de l'utilisateur destiné à recevoir cette notification
            user_id: sellerId
          });
          
          console.log('[PaymentService] Notification de paiement créée pour le propriétaire:', sellerId);
        }
      } catch (notificationError) {
        console.error('[PaymentService] Erreur lors de la création de la notification:', notificationError);
      }

      // 7. Mettre à jour le statut de la propriété si nécessaire
      if (transactionType === 'sale') {
        const { error: propertyError } = await supabase
          .from('properties')
          .update({ status: 'sold' })
          .eq('id', propertyId);

        if (propertyError) {
          console.error('Erreur lors de la mise à jour du statut de la propriété:', propertyError);
        }
      }

      // Générer les récépissés
      const sellerReceipt = {
        type: 'payment_receipt',
        title: 'Récépissé de paiement',
        message: `Vous avez reçu un paiement de ${amount} FCFA pour votre bien ${propertyName}`,
        data: {
          transaction_id: transaction.id,
          amount: amount,
          payment_method: paymentMethod,
          property_name: propertyName,
          seller_name: sellerName,
          buyer_name: buyerName,
          status: 'completed'
        }
      };

      const buyerReceipt = {
        type: 'payment_receipt',
        title: 'Récépissé de paiement',
        message: `Vous avez effectué un paiement de ${amount} FCFA pour le bien ${propertyName}`,
        data: {
          transaction_id: transaction.id,
          amount: amount,
          payment_method: paymentMethod,
          property_name: propertyName,
          seller_name: sellerName,
          buyer_name: buyerName,
          status: 'completed'
        }
      };

      // Envoyer les récépissés
      await this._sendReceipt(sellerReceipt, sellerId);
      await this._sendReceipt(buyerReceipt, buyerId);

      return {
        success: true,
        transactionId: transaction.id,
        reference: transferResult.reference
      };
    } catch (error) {
      console.error('Erreur complète lors du traitement du paiement:', error);
      throw error;
    }
  },

  /**
   * Exécute le transfert d'argent via l'API appropriée
   * @param {Object} transferDetails - Détails du transfert
   * @returns {Promise<Object>} - Résultat du transfert
   * @private
   */
  async _executeTransfer(transferDetails) {
    const {
      buyerMethod,
      sellerMethod,
      amount,
      buyerPhoneNumber,
      cardDetails,
      sellerPaymentInfo,
      transactionId
    } = transferDetails;

    // Générer une référence unique pour le transfert
    const reference = `TRF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // En mode production, vous intégreriez ici les API réelles de paiement
    // Pour cet exemple, nous simulons un transfert réussi

    // Simulation d'un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Déterminer les détails du destinataire en fonction de la méthode préférée
    let recipientDetails;
    
    // Si sellerPaymentInfo est null (cas où le vendeur n'a pas configuré ses informations),
    // utiliser des valeurs par défaut pour éviter les erreurs
    if (!sellerPaymentInfo) {
      recipientDetails = {
        provider: this._getMethodName(sellerMethod),
        note: 'Informations de paiement non configurées'
      };
    } else {
      switch (sellerMethod) {
        case 'orange_money':
          recipientDetails = {
            phoneNumber: sellerPaymentInfo.orange_money_number,
            provider: 'Orange Money'
          };
          break;
        case 'moov_money':
          recipientDetails = {
            phoneNumber: sellerPaymentInfo.moov_money_number,
            provider: 'Moov Money'
          };
          break;
        case 'bank_account':
          recipientDetails = {
            bankName: sellerPaymentInfo.bank_name,
            accountNumber: sellerPaymentInfo.account_number,
            accountName: sellerPaymentInfo.account_name
          };
          break;
        default:
          recipientDetails = {
            provider: this._getMethodName(sellerMethod),
            note: 'Méthode non prise en charge'
          };
      }
    }

    // Simulation d'un appel API à un service de paiement
    console.log(`[PAIEMENT] Transfert de ${amount} FCFA vers ${JSON.stringify(recipientDetails)}`);

    // En production, vous utiliseriez un code comme celui-ci:
    /*
    const apiConfig = API_CONFIG[sellerMethod === 'bank_account' ? 'bank_transfer' : sellerMethod];
    
    const response = await fetch(`${apiConfig.apiUrl}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        amount,
        currency: 'XOF',
        recipient: recipientDetails,
        reference,
        description: `Paiement immobilier #${transactionId}`
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Erreur lors du transfert');
    }

    const result = await response.json();
    return {
      success: true,
      reference: result.reference || reference
    };
    */

    // Pour cet exemple, nous retournons simplement un succès simulé
    return {
      success: true,
      reference: reference,
      recipientDetails
    };
  },

  /**
   * Obtient le nom lisible d'une méthode de paiement
   * @param {string} method - Code de la méthode
   * @returns {string} - Nom lisible
   * @private
   */
  _getMethodName(method) {
    switch (method) {
      case 'orange_money':
        return 'Orange Money';
      case 'moov_money':
        return 'Moov Money';
      case 'bank_account':
        return 'compte bancaire';
      default:
        return method;
    }
  },

  /**
   * Envoie un récépissé à un utilisateur
   * @param {Object} receipt - Détails du récépissé
   * @param {string} userId - ID de l'utilisateur
   * @private
   */
  async _sendReceipt(receipt, userId) {
    try {
      // Stocker le récépissé dans la base de données locale
      await AsyncStorage.setItem(`receipt_${receipt.data.transaction_id}`, JSON.stringify(receipt));
    } catch (error) {
      console.error('Erreur lors de l\'envoi du récépissé:', error);
    }
  }
};

export default PaymentService;
