import { supabase } from '../lib/supabase';
import { STRIPE_CONFIG } from '../config/stripe';

/**
 * Service pour gérer les interactions avec l'API Stripe
 */
class StripeService {
  /**
   * Crée une intention de paiement avec capture différée
   * @param {Object} paymentDetails - Détails du paiement
   * @returns {Promise<Object>} - Intention de paiement
   */
  async createPaymentIntent(paymentDetails) {
    try {
      const { amount, currency, userId, propertyId } = paymentDetails;
      
      // En mode développement, simuler l'appel API pour éviter les erreurs réseau
      if (__DEV__) {
        console.log('Mode développement: simulation de création d\'intention de paiement');
        
        // Générer un ID unique pour l'intention de paiement
        const paymentIntentId = `pi_${Math.random().toString(36).substring(2, 15)}`;
        const clientSecret = `seti_${Math.random().toString(36).substring(2, 15)}_secret_${Math.random().toString(36).substring(2, 15)}`;
        
        // Simuler un délai réseau
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Créer une intention de paiement simulée
        const paymentIntent = {
          id: paymentIntentId,
          client_secret: clientSecret,
          amount: amount,
          currency: typeof currency === 'object' ? currency.code.toLowerCase() : currency.toLowerCase(),
          status: 'requires_capture',
          capture_method: 'manual',
          metadata: {
            user_id: userId,
            property_id: propertyId,
            payment_type: 'listing_fee',
            simulated: true
          }
        };
        
        console.log('Intention de paiement simulée créée:', paymentIntent.id);
        
        // Enregistrer l'intention de paiement simulée dans la base de données
        await this.savePaymentIntent(paymentIntent, userId, propertyId);
        
        return paymentIntent;
      }
      
      // En production, appeler l'API réelle
      console.log('Appel à l\'API Stripe pour créer une intention de paiement');
      const response = await fetch(STRIPE_CONFIG.paymentIntentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          currency: typeof currency === 'object' ? currency.code.toLowerCase() : currency.toLowerCase(),
          capture_method: 'manual', // Important: capture manuelle pour différer le débit
          metadata: {
            user_id: userId,
            property_id: propertyId,
            payment_type: 'listing_fee'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la création de l\'intention de paiement');
      }

      const paymentIntent = await response.json();
      
      // Enregistrer l'intention de paiement dans la base de données
      await this.savePaymentIntent(paymentIntent, userId, propertyId);
    } catch (error) {
      console.error('Erreur lors de la création de l\'intention de paiement:', error);
      throw error;
    }
  }

  /**
   * Enregistre l'intention de paiement dans la base de données
   * @param {Object} paymentIntent - Intention de paiement Stripe
   * @param {string} userId - ID de l'utilisateur
   * @param {string} propertyId - ID de la propriété
   * @private
   */
  async savePaymentIntent(paymentIntent, userId, propertyId) {
    try {
      console.log('Tentative d\'enregistrement de l\'intention de paiement:', {
        payment_intent_id: paymentIntent.id,
        client_secret: '***SECRET***', // Masqué pour la sécurité
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        user_id: userId,
        property_id: propertyId
      });
      
      // Vérifier que les données sont valides avant insertion
      if (!paymentIntent.id || !userId || !propertyId) {
        console.error('Données invalides pour l\'enregistrement de l\'intention de paiement:', {
          hasPaymentIntentId: !!paymentIntent.id,
          hasUserId: !!userId,
          hasPropertyId: !!propertyId
        });
        return;
      }
      
      const { data, error } = await supabase
        .from('payment_intents')
        .insert({
          payment_intent_id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          user_id: userId,
          property_id: propertyId,
          captured: false,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('Erreur détaillée lors de l\'enregistrement de l\'intention de paiement:', error);
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        console.error('Détails:', error.details);
        
        // Vérifier si l'erreur est liée à une contrainte de clé étrangère
        if (error.code === '23503') {
          console.error('Erreur de contrainte de clé étrangère. Vérifiez que user_id et property_id existent dans leurs tables respectives.');
        }
      } else {
        console.log('Intention de paiement enregistrée avec succès:', data);
      }
    } catch (error) {
      console.error('Exception lors de l\'enregistrement de l\'intention de paiement:', error);
    }
  }

  /**
   * Capture un paiement après validation de l'annonce
   * @param {string} propertyId - ID de la propriété
   * @returns {Promise<Object>} - Résultat de la capture
   */
  async capturePaymentForProperty(propertyId) {
    try {
      console.log('Tentative de capture du paiement pour la propriété:', propertyId);
      
      // Vérifier que l'ID de propriété est valide
      if (!propertyId) {
        console.error('ID de propriété invalide pour la capture du paiement');
        throw new Error('ID de propriété invalide');
      }
      
      // Récupérer l'intention de paiement associée à la propriété
      const { data: paymentIntents, error: selectError } = await supabase
        .from('payment_intents')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (selectError) {
        console.error('Erreur lors de la récupération des intentions de paiement:', selectError);
        console.error('Code:', selectError.code);
        console.error('Message:', selectError.message);
        console.error('Détails:', selectError.details);
        throw new Error(`Erreur lors de la récupération de l'intention de paiement: ${selectError.message}`);
      }
      
      console.log(`Nombre d'intentions de paiement trouvées: ${paymentIntents ? paymentIntents.length : 0}`);
      
      // Si aucune intention de paiement n'est trouvée, essayer de créer une nouvelle intention
      if (!paymentIntents || paymentIntents.length === 0) {
        console.error('Aucune intention de paiement trouvée pour cette propriété:', propertyId);
        
        // Récupérer les détails de la propriété pour vérifier qu'elle existe
        const { data: property, error: propertyError } = await supabase
          .from('properties')
          .select('id, owner_id, title, status')
          .eq('id', propertyId)
          .single();
          
        if (propertyError || !property) {
          console.error('La propriété n\'existe pas:', propertyError || 'Aucune propriété trouvée');
          throw new Error('Propriété introuvable');
        }
        
        console.log('Propriété trouvée:', property);
        throw new Error('Intention de paiement non trouvée pour cette propriété');
      }
      
      // Filtrer pour trouver une intention non capturée
      const nonCapturedIntents = paymentIntents.filter(intent => !intent.captured);
      
      if (nonCapturedIntents.length === 0) {
        console.log('Toutes les intentions de paiement ont déjà été capturées');
        throw new Error('Toutes les intentions de paiement ont déjà été capturées');
      }
      
      // Utiliser la plus récente intention non capturée
      const paymentIntent = nonCapturedIntents[0];
      console.log('Intention de paiement trouvée:', {
        id: paymentIntent.id,
        payment_intent_id: paymentIntent.payment_intent_id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        created_at: paymentIntent.created_at
      });

      // En mode développement, simuler l'appel API pour éviter les erreurs réseau
      if (__DEV__) {
        console.log('Mode développement: simulation de capture du paiement', paymentIntent.payment_intent_id);
        
        // Simuler un délai réseau
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simuler un résultat de capture réussi
        const captureResult = {
          id: paymentIntent.payment_intent_id,
          amount: paymentIntent.amount,
          status: 'succeeded',
          captured: true,
          captured_at: new Date().toISOString()
        };
        
        console.log('Paiement simulé capturé avec succès:', captureResult);
        return captureResult;
      }
      
      // En production, appeler l'API réelle
      console.log('Appel à l\'API Stripe pour capturer le paiement');
      const response = await fetch(`${STRIPE_CONFIG.capturePaymentUrl}/${paymentIntent.payment_intent_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la capture du paiement');
      }

      const captureResult = await response.json();

      // Mettre à jour le statut de l'intention de paiement dans la base de données
      await supabase
        .from('payment_intents')
        .update({
          captured: true,
          captured_at: new Date().toISOString(),
          status: captureResult.status
        })
        .eq('payment_intent_id', paymentIntent.payment_intent_id);

      // Enregistrer la transaction complète
      await supabase
        .from('transactions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('transfer_reference', paymentIntent.payment_intent_id);

      return {
        success: true,
        paymentIntent: captureResult
      };
    } catch (error) {
      console.error('Erreur lors de la capture du paiement:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Annule un paiement si l'annonce est rejetée
   * @param {string} propertyId - ID de la propriété
   * @returns {Promise<Object>} - Résultat de l'annulation
   */
  async cancelPaymentForProperty(propertyId) {
    try {
      // Récupérer l'intention de paiement associée à la propriété
      const { data: paymentIntent, error } = await supabase
        .from('payment_intents')
        .select('*')
        .eq('property_id', propertyId)
        .eq('captured', false)
        .single();

      if (error || !paymentIntent) {
        console.error('Erreur lors de la récupération de l\'intention de paiement:', error);
        throw new Error('Intention de paiement non trouvée pour cette propriété');
      }

      // En mode développement, simuler l'appel API pour éviter les erreurs réseau
      if (__DEV__) {
        console.log('Mode développement: simulation d\'annulation du paiement', paymentIntent.payment_intent_id);
        
        // Simuler un délai réseau
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simuler un résultat d'annulation réussi
        const cancelResult = {
          id: paymentIntent.payment_intent_id,
          status: 'canceled',
          canceled_at: new Date().toISOString()
        };
        
        console.log('Paiement simulé annulé avec succès:', cancelResult);
        return cancelResult;
      }
      
      // En production, appeler l'API réelle
      console.log('Appel à l\'API Stripe pour annuler le paiement');
      const response = await fetch(`${STRIPE_CONFIG.cancelPaymentUrl}/${paymentIntent.payment_intent_id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'annulation du paiement');
      }

      const cancelResult = await response.json();

      // Mettre à jour le statut de l'intention de paiement dans la base de données
      await supabase
        .from('payment_intents')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString()
        })
        .eq('payment_intent_id', paymentIntent.payment_intent_id);

      // Mettre à jour la transaction
      await supabase
        .from('transactions')
        .update({
          status: 'canceled',
          error_message: 'Annonce rejetée par l\'administrateur'
        })
        .eq('transfer_reference', paymentIntent.payment_intent_id);

      return {
        success: true,
        paymentIntent: cancelResult
      };
    } catch (error) {
      console.error('Erreur lors de l\'annulation du paiement:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export const stripeService = new StripeService();
