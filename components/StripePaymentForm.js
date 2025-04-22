import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CardField, useStripe, useConfirmPayment } from '@stripe/stripe-react-native';
import { STRIPE_CONFIG, LISTING_FEE, EQUIVALENT_AMOUNTS, getCurrencyByCountry } from '../config/stripe';
import { useTheme } from '../context/ThemeContext';
import * as Location from 'expo-location';
import { supabase } from '../config/supabase';
import NetInfo from '@react-native-community/netinfo';

const StripePaymentForm = ({ onPaymentSuccess, onCancel, propertyData }) => {
  const { colors } = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { confirmPayment } = useConfirmPayment();
  const [loading, setLoading] = useState(false);
  const [cardDetails, setCardDetails] = useState(null);
  const [currency, setCurrency] = useState(null);
  const [amount, setAmount] = useState(LISTING_FEE);
  const [countryCode, setCountryCode] = useState('ML'); // Default to Mali
  const [networkAvailable, setNetworkAvailable] = useState(true);
  const [error, setError] = useState(null);

  // Vérifier la connectivité réseau
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkAvailable(state.isConnected);
    });
    
    // Vérification initiale
    NetInfo.fetch().then(state => {
      setNetworkAvailable(state.isConnected);
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Détecter le pays de l'utilisateur
  useEffect(() => {
    const detectUserCountry = async () => {
      try {
        setError(null);
        
        // Vérifier la connectivité réseau
        if (!networkAvailable) {
          console.log('Pas de connexion réseau, utilisation des valeurs par défaut');
          const defaultCurrency = getCurrencyByCountry('ML');
          setCurrency(defaultCurrency);
          setAmount(LISTING_FEE);
          return;
        }
        
        // Demander la permission de localisation
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Low, // Précision réduite pour économiser la batterie
            timeout: 5000 // Timeout de 5 secondes pour éviter les blocages
          });
          
          const { latitude, longitude } = location.coords;
          
          // Obtenir les informations de localisation
          const geoData = await Location.reverseGeocodeAsync({ latitude, longitude });
          
          if (geoData && geoData.length > 0) {
            const detectedCountryCode = geoData[0].isoCountryCode;
            setCountryCode(detectedCountryCode);
            
            // Obtenir la devise correspondante
            const currencyConfig = getCurrencyByCountry(detectedCountryCode);
            setCurrency(currencyConfig);
            
            // Utiliser les montants équivalents préconfigurés
            if (EQUIVALENT_AMOUNTS[currencyConfig.code]) {
              setAmount(EQUIVALENT_AMOUNTS[currencyConfig.code]);
            } else {
              // Fallback au montant en FCFA si la devise n'est pas configurée
              setAmount(LISTING_FEE);
            }
          }
        } else {
          // Permission refusée, utiliser les valeurs par défaut
          const defaultCurrency = getCurrencyByCountry('ML');
          setCurrency(defaultCurrency);
          setAmount(LISTING_FEE);
        }
      } catch (error) {
        console.error('Erreur lors de la détection du pays:', error);
        // Utiliser les valeurs par défaut (Mali, XOF)
        const defaultCurrency = getCurrencyByCountry('ML');
        setCurrency(defaultCurrency);
        setAmount(LISTING_FEE); // Montant en FCFA par défaut
      }
    };

    detectUserCountry();
  }, [networkAvailable]);

  // Fonction pour créer une intention de paiement via le backend
  const createPaymentIntent = async () => {
    try {
      // Vérifier la connectivité réseau
      if (!networkAvailable) {
        throw new Error('Pas de connexion Internet. Veuillez vérifier votre connexion et réessayer.');
      }

      // Récupérer l'utilisateur connecté
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      // Dans une application réelle, cette partie serait gérée par votre backend
      // Ici, nous simulons une réponse de l'API Stripe
      const paymentIntent = {
        id: `pi_${Math.random().toString(36).substring(2, 15)}`,
        client_secret: `seti_${Math.random().toString(36).substring(2, 15)}_secret_${Math.random().toString(36).substring(2, 15)}`,
        amount: currency ? amount : LISTING_FEE,
        currency: currency ? currency.code.toLowerCase() : 'xof',
      };

      return paymentIntent;
    } catch (error) {
      console.error('Erreur lors de la création de l\'intention de paiement:', error);
      throw error;
    }
  };

  const handlePayment = async () => {
    console.log('Tentative de paiement avec cardDetails:', cardDetails ? JSON.stringify(cardDetails) : 'null');
    
    // En mode développement, on permet le paiement même sans détails de carte
    // Cela permet de tester le flux de paiement sans avoir à saisir une carte valide
    if (__DEV__) {
      console.warn('Mode développement: paiement autorisé même sans détails de carte complets');
      
      // Si les détails de carte sont complètement absents, créer un objet fictif pour le test
      if (!cardDetails) {
        console.warn('Création de détails de carte fictifs pour le test');
        // Ne pas modifier l'état, juste utiliser une variable locale
        const testCardDetails = {
          brand: 'visa',
          complete: true,
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 25,
          postalCode: null,
          validNumber: true,
          validExpiryDate: true,
          validCVC: true
        };
        
        // Continuer avec les détails de carte fictifs
        try {
          setLoading(true);
          setError(null);
          
          // Simuler un délai réseau
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Récupérer l'utilisateur connecté
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('Utilisateur non connecté');
          }
          
          // Simuler un paiement réussi avec les détails de carte fictifs
          const paymentResult = {
            paymentId: `pi_${Math.random().toString(36).substring(2, 15)}`,
            amount: amount,
            currency: currency ? currency.code : 'XOF',
            paymentMethod: 'card',
            status: 'succeeded',
            userId: user.id,
            propertyData,
            timestamp: new Date().toISOString()
          };
          
          // Informer le composant parent du succès du paiement
          onPaymentSuccess(paymentResult);
          return;
        } catch (error) {
          console.error('Erreur de paiement:', error);
          setError(error.message || 'Le paiement a échoué. Veuillez réessayer.');
          Alert.alert('Erreur', error.message || 'Le paiement a échoué. Veuillez réessayer.');
          return;
        } finally {
          setLoading(false);
        }
      }
    } else {
      // En production, validation stricte
      if (!cardDetails) {
        setError('Veuillez saisir les informations de votre carte');
        Alert.alert('Informations manquantes', 'Veuillez saisir les informations de votre carte');
        return;
      }
      
      if (!cardDetails.complete) {
        setError('Informations de carte incomplètes. Veuillez vérifier le numéro, la date d\'expiration et le code CVC.');
        Alert.alert('Erreur', 'Informations de carte incomplètes. Veuillez vérifier le numéro, la date d\'expiration et le code CVC.');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      // Vérifier la connectivité réseau
      if (!networkAvailable) {
        throw new Error('Pas de connexion Internet. Veuillez vérifier votre connexion et réessayer.');
      }

      // Récupérer l'utilisateur connecté
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Erreur d\'authentification:', authError);
        throw new Error('Erreur d\'authentification. Veuillez vous reconnecter.');
      }
      
      if (!user || !user.id) {
        console.error('Utilisateur non identifié ou ID manquant');
        throw new Error('Utilisateur non connecté ou session expirée. Veuillez vous reconnecter.');
      }
      
      console.log('Utilisateur authentifié:', { id: user.id });

      // Créer une intention de paiement
      const paymentIntent = await createPaymentIntent();
      
      // Dans une application réelle, nous utiliserions confirmPayment avec le client_secret
      // Comme nous simulons le paiement, nous allons simplement attendre un peu
      // puis simuler une réponse réussie
      
      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simuler un paiement réussi
      const paymentResult = {
        paymentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentMethod: 'card',
        status: 'succeeded',
        userId: user.id,
        propertyData,
        timestamp: new Date().toISOString()
      };
      
      // Informer le composant parent du succès du paiement
      onPaymentSuccess(paymentResult);
      
    } catch (error) {
      console.error('Erreur de paiement:', error);
      setError(error.message || 'Le paiement a échoué. Veuillez réessayer.');
      Alert.alert('Erreur', error.message || 'Le paiement a échoué. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Paiement des frais de publication
      </Text>
      
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {currency ? `${amount} ${currency.symbol}` : `${LISTING_FEE} FCFA`}
      </Text>
      
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        Ce paiement unique permet la publication de votre annonce immobilière.
      </Text>
      
      {!networkAvailable && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Pas de connexion Internet. Veuillez vérifier votre connexion pour continuer.
          </Text>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      <View style={styles.cardFieldContainer}>
        <Text style={styles.cardFieldLabel}>Carte de crédit ou débit</Text>
        <Text style={styles.cardFieldInfo}>Pour tester, utilisez: 4242 4242 4242 4242 - MM/YY: 12/25 - CVC: 123</Text>
        
        <CardField
          postalCodeEnabled={false}
          placeholder={{
            number: '4242 4242 4242 4242',
            expiration: 'MM/YY',
            cvc: 'CVC',
          }}
          cardStyle={{
            backgroundColor: '#FFFFFF',  // Fond blanc pour meilleure visibilité
            textColor: '#000000',       // Texte noir pour contraste maximal
            textErrorColor: '#FF0000',  // Erreurs en rouge vif
            placeholderColor: '#999999', // Placeholder gris moyen
            fontSize: 20,               // Taille de police augmentée pour meilleure lisibilité
            fontWeight: '600',          // Police plus grasse pour meilleure visibilité
            letterSpacing: 0.5,         // Espacement des lettres pour meilleure lisibilité
            borderWidth: 0,             // Pas de bordure interne (la bordure est sur le conteneur)
            borderRadius: 8,            // Coins arrondis
            cursorColor: '#0066CC',     // Couleur du curseur visible (bleu)
            inputStyle: {
              color: '#000000',          // Couleur du texte saisi
              fontWeight: 'bold'         // Texte en gras pour meilleure visibilité
            }
          }}
          style={styles.cardField}
          onCardChange={cardDetails => {
            console.log('Card details changed:', cardDetails ? 'Valid: ' + cardDetails.complete : 'No details');
            console.log('Card brand:', cardDetails?.brand);
            console.log('Last 4 digits:', cardDetails?.last4);
            console.log('Card details object:', JSON.stringify(cardDetails));
            
            // Vérifier que cardDetails est un objet valide avant de le stocker
            if (cardDetails) {
              setCardDetails(cardDetails);
              // Réinitialiser les erreurs lorsque l'utilisateur modifie les détails de la carte
              if (error) setError(null);
            } else {
              console.warn('CardField a retourné des détails null ou undefined');
            }
          }}
          onFocus={() => console.log('CardField a reçu le focus')}
          autofocus={true}
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
          onPress={onCancel}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>Annuler</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.button, 
            styles.payButton, 
            { backgroundColor: colors.primary },
            (loading || !networkAvailable) && styles.disabledButton
          ]}
          onPress={handlePayment}
          disabled={loading || !networkAvailable}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.payButtonText}>
              Payer {currency ? `${amount} ${currency.symbol}` : `${LISTING_FEE} FCFA`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    marginVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    marginBottom: 20,
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#ffeeee',
    padding: 10,
    borderRadius: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
  errorText: {
    color: '#cc0000',
    fontSize: 14,
  },
  cardFieldContainer: {
    marginBottom: 20,
  },
  cardFieldLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333333',
  },
  cardFieldInfo: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  cardField: {
    width: '100%',
    height: 70,              // Hauteur augmentée pour meilleure visibilité
    marginVertical: 10,
    backgroundColor: '#FFFFFF', // Fond blanc pour le champ
    borderWidth: 2,          // Bordure plus épaisse pour meilleure visibilité
    borderColor: '#0066CC',  // Couleur de bordure bleue plus visible
    borderRadius: 8,         // Coins arrondis
    padding: 10,             // Padding interne
    shadowColor: '#000',     // Ombre pour faire ressortir le champ
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,            // Élévation pour Android
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  cancelButton: {
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  payButton: {
    borderWidth: 0,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: '600',
  },
  payButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default StripePaymentForm;
