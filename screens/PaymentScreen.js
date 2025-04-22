import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  BackHandler,
  Image
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { PaymentService } from '../services/PaymentService';
import { StripeProvider } from '@stripe/stripe-react-native';
import StripePaymentForm from '../components/StripePaymentForm';
import { STRIPE_CONFIG, EQUIVALENT_AMOUNTS, getCurrencyByCountry } from '../config/stripe';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';

export default function PaymentScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { 
    propertyId, 
    userId, 
    amount: initialAmount, 
    transactionType, 
    paymentType = 'property_purchase', // Par défaut, c'est un achat de propriété
    formData, 
    returnScreen,
    sellerId // Pour la compatibilité avec l'ancien code
  } = route.params;
  
  // Afficher les paramètres reçus pour le débogage
  console.log('PaymentScreen params:', route.params);
  
  // Déterminer si c'est un paiement de frais de publication ou un achat de propriété
  const isListingFee = paymentType === 'listing_fee';
  const [phoneNumber, setPhoneNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('orange_money');
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [networkAvailable, setNetworkAvailable] = useState(true);
  const [error, setError] = useState(null);
  const [processedFormData, setProcessedFormData] = useState(null);
  const [amount, setAmount] = useState(initialAmount || 5000);
  const [currency, setCurrency] = useState(null);
  const [countryCode, setCountryCode] = useState('ML'); // Default to Mali

  const paymentMethods = [
    { label: 'Orange Money', value: 'orange_money', icon: 'account-balance-wallet' },
    { label: 'Moov Money', value: 'moov_money', icon: 'account-balance-wallet' },
    { label: 'Carte Bancaire', value: 'card', icon: 'credit-card' },
  ];
  
  // Vérifier la connectivité réseau
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkAvailable(state.isConnected);
      if (!state.isConnected && !error) {
        setError('Pas de connexion Internet. Veuillez vérifier votre connexion pour continuer.');
      } else if (state.isConnected && error === 'Pas de connexion Internet. Veuillez vérifier votre connexion pour continuer.') {
        setError(null);
      }
    });
    
    // Vérification initiale
    NetInfo.fetch().then(state => {
      setNetworkAvailable(state.isConnected);
      if (!state.isConnected) {
        setError('Pas de connexion Internet. Veuillez vérifier votre connexion pour continuer.');
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [error]);
  
  // Gérer le bouton retour pour éviter les abandons accidentels
  useEffect(() => {
    const backAction = () => {
      if (loading) {
        Alert.alert(
          'Paiement en cours',
          'Un paiement est en cours de traitement. Êtes-vous sûr de vouloir annuler ?',
          [
            { text: 'Continuer le paiement', style: 'cancel', onPress: () => {} },
            { text: 'Annuler le paiement', style: 'destructive', onPress: () => navigation.goBack() }
          ]
        );
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [loading, navigation]);
  
  // Détecter le pays et configurer la devise
  useEffect(() => {
    const detectCurrency = async () => {
      try {
        // Pour les besoins de test, on force l'utilisation de l'Euro pour tous les utilisateurs
        // En production, on utiliserait le code ci-dessous pour détecter le pays de l'utilisateur
        /*
        const { data: profile } = await supabase
          .from('profiles')
          .select('country_code')
          .eq('id', userId)
          .single();
        
        const userCountryCode = profile?.country_code || 'ML';
        */
        
        // Forcer le code pays sur 'FR' (France) pour utiliser l'Euro
        const userCountryCode = 'FR';
        setCountryCode(userCountryCode);
        
        // Obtenir la devise correspondante (EUR pour la France)
        const currencyConfig = getCurrencyByCountry(userCountryCode);
        setCurrency(currencyConfig);
        
        // Utiliser les montants équivalents préconfigurés si c'est un frais de publication
        if (isListingFee && EQUIVALENT_AMOUNTS[currencyConfig.code]) {
          setAmount(EQUIVALENT_AMOUNTS[currencyConfig.code]);
        }
      } catch (error) {
        console.error('Erreur lors de la détection de la devise:', error);
        // Utiliser les valeurs par défaut (Mali, XOF)
        const defaultCurrency = getCurrencyByCountry('ML');
        setCurrency(defaultCurrency);
      }
    };

    if (isListingFee) {
      detectCurrency();
    }
  }, [userId, isListingFee]);
  
  // Prétraiter les données du formulaire pour optimiser la mémoire
  useEffect(() => {
    const processFormData = async () => {
      if (!formData) return;
      
      try {
        const parsedData = JSON.parse(formData);
        
        // Si des images sont présentes, les remplacer par des placeholders pour éviter les logs volumineux
        if (parsedData.images && parsedData.images.length > 0) {
          // Désactivé temporairement: traitement complet des images
          // Remplacer par des placeholders pour réduire les logs
          const imageCount = parsedData.images.length;
          console.log(`Traitement de ${imageCount} images (logs détaillés désactivés)`);
          
          // Remplacer les images par des placeholders
          parsedData.images = parsedData.images.map((_, index) => 
            `[Image ${index + 1}/${imageCount}]`
          );
        }
        
        setProcessedFormData(parsedData);
      } catch (error) {
        console.error('Erreur lors du traitement des données du formulaire:', error);
        setError('Erreur lors du traitement des données du formulaire. Veuillez réessayer.');
      }
    };
    
    processFormData();
  }, [formData]);

  // Fonction pour vérifier l'authentification de l'utilisateur
  const checkUserAuthentication = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        throw new Error('Vous devez être connecté pour effectuer un paiement');
      }
      return user;
    } catch (error) {
      console.error('Erreur d\'authentification:', error);
      throw new Error('Erreur d\'authentification. Veuillez vous reconnecter.');
    }
  };

  // Fonction pour valider les données de paiement
  const validatePaymentData = () => {
    if (!networkAvailable) {
      throw new Error('Pas de connexion Internet. Veuillez vérifier votre connexion et réessayer.');
    }
    
    if (paymentMethod === 'card') {
      if (!cardNumber.trim() || !expiryDate.trim() || !cvv.trim() || !cardHolderName.trim()) {
        throw new Error('Veuillez remplir tous les champs de la carte');
      }
      
      // Validation basique du numéro de carte
      const cleanCardNumber = cardNumber.replace(/\s/g, '');
      if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19 || !/^\d+$/.test(cleanCardNumber)) {
        throw new Error('Numéro de carte invalide');
      }
      
      // Validation de la date d'expiration
      const expiryParts = expiryDate.split('/');
      if (expiryParts.length !== 2 || !/^\d{2}$/.test(expiryParts[0]) || !/^\d{2}$/.test(expiryParts[1])) {
        throw new Error('Date d\'expiration invalide');
      }
      
      // Validation du CVV
      if (!/^\d{3,4}$/.test(cvv)) {
        throw new Error('CVV invalide');
      }
    } else {
      // Validation du numéro de téléphone pour les paiements mobiles
      if (!phoneNumber.trim()) {
        throw new Error('Veuillez saisir votre numéro de téléphone');
      }
      
      // Format malien: 7X XX XX XX ou 9X XX XX XX ou 2X XX XX XX ou 6X XX XX XX
      const phoneRegex = /^(7[0-9]|9[0-9]|2[0-9]|6[0-9])[0-9]{6}$/;
      const cleanPhone = phoneNumber.replace(/\s/g, '');
      
      if (!phoneRegex.test(cleanPhone)) {
        throw new Error('Numéro de téléphone invalide. Veuillez saisir un numéro malien valide.');
      }
    }
  };

  // Fonction principale de traitement du paiement
  const handlePayment = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Vérifier la connexion réseau
      if (!networkAvailable) {
        throw new Error('Pas de connexion Internet. Veuillez vérifier votre connexion et réessayer.');
      }

      // Vérifier l'authentification
      const user = await checkUserAuthentication();
      
      // Valider les données de paiement
      validatePaymentData();

      // Vérifier si nous avons un ID d'intention de paiement passé depuis l'écran précédent
      const { paymentIntentId } = route.params;
      console.log('ID d\'intention de paiement reçu:', paymentIntentId);
      
      // Si nous avons un ID d'intention de paiement, vérifier qu'il existe dans la base de données
      if (paymentIntentId) {
        console.log('Vérification de l\'intention de paiement existante:', paymentIntentId);
        const { data: existingIntent, error: intentError } = await supabase
          .from('payment_intents')
          .select('*')
          .eq('payment_intent_id', paymentIntentId)
          .eq('property_id', propertyId)
          .single();
          
        if (intentError || !existingIntent) {
          console.error('Intention de paiement non trouvée dans la base de données:', intentError);
          console.log('Création d\'une nouvelle intention de paiement...');
        } else {
          console.log('Intention de paiement trouvée:', existingIntent);
        }
      }

      // Préparer les détails du paiement
      const paymentDetails = {
        userId: user.id,
        amount,
        paymentMethod,
        phoneNumber: phoneNumber.replace(/\s/g, ''),
        cardDetails: paymentMethod === 'card' ? {
          number: cardNumber.replace(/\s/g, ''),
          expiry: expiryDate,
          cvv,
          name: cardHolderName
        } : null,
        transactionType: isListingFee ? 'listing_fee' : 'property_purchase',
        propertyId,
        sellerId,
        formData: processedFormData ? JSON.stringify(processedFormData) : formData,
        currency: currency ? currency.code : 'XOF',
        // Ajouter l'ID d'intention de paiement s'il existe
        stripePaymentId: paymentIntentId
      };

      console.log('PAIEMENT - Détails:', {
        userId: paymentDetails.userId,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        paymentMethod: paymentDetails.paymentMethod,
        transactionType: paymentDetails.transactionType,
        stripePaymentId: paymentDetails.stripePaymentId
        // Omettre formData et cardDetails pour réduire les logs
      });

      // Effectuer le paiement en fonction du type avec gestion des erreurs
      let result;
      try {
        if (isListingFee) {
          result = await PaymentService.processListingFeePayment(paymentDetails);
        } else {
          result = await PaymentService.processDirectPayment(paymentDetails);
        }
      } catch (paymentError) {
        console.error('Erreur lors du traitement du paiement:', paymentError);
        throw new Error(paymentError.message || 'Le traitement du paiement a échoué. Veuillez réessayer.');
      }

      console.log('Résultat du paiement:', result);

      // Déterminer l'écran de retour
      const targetScreen = returnScreen || (isListingFee ? 'Home' : 'PropertyDetails');

      // Afficher un message de confirmation
      let titre = 'Succès';
      let message = 'Paiement effectué avec succès!';
      
      if (isListingFee) {
        // Messages pour le paiement des frais de publication
        switch (result.status) {
          case 'completed':
            message = "Paiement effectué avec succès ! Votre annonce sera publiée après validation par nos équipes.";
            break;
          case 'processing':
            message = "Votre paiement est en cours de traitement. Vous recevrez une notification dès que votre annonce sera publiée.";
            break;
          case 'prepaid':
            message = "Votre paiement a été enregistré. Votre annonce sera publiée une fois les informations complétées.";
            break;
          case 'failed':
            titre = 'Échec';
            message = "Échec du paiement. Veuillez réessayer ou contacter le support.";
            break;
          default:
            message = "Votre paiement a été enregistré. Vous serez notifié dès que votre annonce sera publiée.";
        }
      } else {
        // Messages pour le paiement d'achat/location de propriété
        switch (result.status) {
          case 'pending_seller_info':
            message = "Votre paiement a été enregistré. Le propriétaire doit configurer ses informations de paiement. Vous serez notifié dès que le paiement sera finalisé.";
            break;
          case 'pending_admin_validation':
            message = "Votre paiement a été enregistré. Le propriétaire recevra les fonds après validation de l'annonce par un administrateur. Vous serez notifié dès que la transaction sera finalisée.";
            break;
          case 'processing':
            message = "Votre paiement est en cours de traitement. Vous recevrez une notification dès qu'il sera finalisé.";
            break;
          case 'completed':
            message = "Paiement effectué avec succès ! Le propriétaire recevra directement le montant sur son compte.";
            break;
          case 'failed':
            titre = 'Échec';
            message = "Échec du paiement. Veuillez réessayer ou contacter le support.";
            break;
          default:
            message = "Votre paiement a été enregistré. Vous serez notifié dès qu'il sera finalisé.";
        }
      }
      
      Alert.alert(
        titre,
        message,
        [{ text: 'OK', onPress: () => navigation.navigate(targetScreen) }]
      );
    } catch (error) {
      console.error('Erreur complète:', error);
      setError(error.message || 'Une erreur est survenue lors du paiement');
      Alert.alert('Erreur', error.message || 'Une erreur est survenue lors du paiement');
    } finally {
      setLoading(false);
    }
  };

  // Formater le numéro de carte avec des espaces tous les 4 chiffres
  const formatCardNumber = (text) => {
    const cleaned = text.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19); // 16 chiffres + 3 espaces
  };

  // Formater la date d'expiration au format MM/YY
  const formatExpiryDate = (text) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };
  
  // Formater le numéro de téléphone au format malien XX XX XX XX
  const formatPhoneNumber = (text) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    
    if (cleaned.length > 2) {
      formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
    }
    if (cleaned.length > 4) {
      formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4)}`;
    }
    if (cleaned.length > 6) {
      formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)}`;
    }
    
    return formatted;
  };

  // Traiter le résultat du paiement Stripe
  const handleStripePaymentSuccess = async (paymentResult) => {
    try {
      setLoading(true);
      setError(null);
      
      // Vérifier que nous avons bien reçu un résultat de paiement valide
      if (!paymentResult || !paymentResult.paymentId) {
        throw new Error('Résultat de paiement invalide');
      }
      
      // Vérifier que l'ID utilisateur est présent
      if (!paymentResult.userId) {
        console.error('ID utilisateur manquant dans le résultat du paiement');
        
        // Essayer de récupérer l'ID utilisateur depuis Supabase
        try {
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error || !user) {
            throw new Error('Impossible de récupérer l\'utilisateur connecté');
          }
          // Ajouter l'ID utilisateur au résultat du paiement
          paymentResult.userId = user.id;
          console.log('ID utilisateur récupéré depuis Supabase:', user.id);
        } catch (authError) {
          console.error('Erreur lors de la récupération de l\'utilisateur:', authError);
          throw new Error('Utilisateur non connecté. Veuillez vous reconnecter et réessayer.');
        }
      }
      
      console.log('PAIEMENT STRIPE - Résultat:', {
        success: true,
        userId: paymentResult.userId,
        amount: paymentResult.amount,
        currency: paymentResult.currency || 'XOF',
        paymentId: paymentResult.paymentId,
        platform: Platform.OS
      });
      
      // Enregistrer le paiement dans le système
      let result;
      
      try {
        if (isListingFee) {
          // Créer un objet de détails de paiement compatible avec notre service
          const paymentDetails = {
            userId: paymentResult.userId,
            amount: paymentResult.amount,
            paymentMethod: 'card',
            transactionType: 'listing_fee',
            formData: processedFormData ? JSON.stringify(processedFormData) : formData,
            stripePaymentId: paymentResult.paymentId,
            currency: paymentResult.currency || 'XOF',
            platform: Platform.OS
          };
          
          result = await PaymentService.processListingFeePayment(paymentDetails);
        } else {
          // Paiement direct au propriétaire
          const paymentDetails = {
            amount: paymentResult.amount,
            buyerId: paymentResult.userId,
            sellerId: sellerId,
            propertyId: propertyId,
            paymentMethod: 'card',
            transactionType: 'property_purchase',
            stripePaymentId: paymentResult.paymentId,
            currency: paymentResult.currency || 'XOF',
            platform: Platform.OS
          };
          
          result = await PaymentService.processDirectPayment(paymentDetails);
        }
      } catch (serviceError) {
        console.error('Erreur lors du traitement du paiement par le service:', serviceError);
        // Si l'erreur vient du service mais que le paiement Stripe a réussi,
        // nous devons quand même considérer le paiement comme réussi pour éviter
        // de facturer le client deux fois
        result = {
          status: 'processing',
          message: 'Le paiement a été reçu mais est en cours de traitement.'
        };
      }
      
      // Déterminer l'écran de retour
      const targetScreen = returnScreen || (isListingFee ? 'Home' : 'PropertyDetails');
      
      // Afficher un message de confirmation adapté au statut
      const status = result?.status || 'processing';
      const titre = status === 'failed' ? 'Attention' : 'Paiement réussi';
      
      let message = isListingFee 
        ? "Paiement effectué avec succès ! Votre annonce sera publiée après validation par nos équipes."
        : "Paiement effectué avec succès ! Le propriétaire recevra directement le montant sur son compte.";
        
      if (status === 'processing') {
        message = isListingFee
          ? "Votre paiement est en cours de traitement. Vous recevrez une notification dès que votre annonce sera publiée."
          : "Votre paiement est en cours de traitement. Vous recevrez une notification dès qu'il sera finalisé.";
      } else if (status === 'failed') {
        message = "Le paiement a été reçu mais une erreur est survenue lors de l'enregistrement. Notre équipe a été notifiée et vous contactera sous peu.";
      }
      
      Alert.alert(
        titre,
        message,
        [{ text: 'OK', onPress: () => navigation.navigate(targetScreen) }]
      );
    } catch (error) {
      console.error('Erreur lors du traitement du paiement Stripe:', error);
      setError(error.message || 'Une erreur est survenue lors du traitement du paiement');
      Alert.alert('Erreur', error.message || 'Une erreur est survenue lors du traitement du paiement');
    } finally {
      setLoading(false);
    }
  };

  // Optimisation du rendu pour améliorer les performances
  const renderPaymentForm = () => {
    if (paymentMethod === 'card') {
      return (
        <StripePaymentForm 
          onPaymentSuccess={handleStripePaymentSuccess}
          onCancel={() => navigation.goBack()}
          propertyData={processedFormData || formData}
        />
      );
    }
    
    return (
      <>
        {/* Formulaire de paiement mobile money */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {paymentMethod === 'orange_money' ? 'Orange Money' : 'Moov Money'}
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Veuillez saisir le numéro de téléphone associé à votre compte 
            {paymentMethod === 'orange_money' ? ' Orange Money' : ' Moov Money'}.
          </Text>
          <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Numéro de téléphone"
              placeholderTextColor={colors.textSecondary}
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(formatPhoneNumber(text));
                if (error) setError(null);
              }}
              maxLength={14}
            />
          </View>
          
          {/* Instructions de paiement */}
          <View style={styles.instructionsContainer}>
            <Text style={[styles.instructionsTitle, { color: colors.text }]}>
              Instructions de paiement :
            </Text>
            <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
              1. Saisissez votre numéro {paymentMethod === 'orange_money' ? 'Orange Money' : 'Moov Money'}
            </Text>
            <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
              2. Cliquez sur "Payer"
            </Text>
            <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
              3. Vous recevrez un code de confirmation par SMS
            </Text>
            <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
              4. Confirmez le paiement sur votre téléphone
            </Text>
          </View>
        </View>

        {/* Bouton de paiement */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handlePayment}
            disabled={loading || !phoneNumber.trim() || !networkAvailable}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                Payer {amount.toLocaleString()} {currency ? currency.symbol : 'FCFA'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  };

  // Rendu principal optimisé pour Android
  return (
    <StripeProvider
      publishableKey={STRIPE_CONFIG.publishableKey}
      merchantIdentifier={STRIPE_CONFIG.merchantIdentifier}
    >
      <View style={[styles.wrapper, { backgroundColor: colors.background }]}>
        {!networkAvailable && (
          <View style={styles.networkWarning}>
            <MaterialIcons name="wifi-off" size={20} color="#fff" />
            <Text style={styles.networkWarningText}>
              Pas de connexion Internet. Veuillez vérifier votre connexion pour continuer.
            </Text>
          </View>
        )}
        
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={true}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS === 'android'}
        >
          {/* En-tête et montant */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Montant</Text>
            <Text style={[styles.amount, { color: colors.text }]}>
              {amount.toLocaleString()} {currency ? currency.symbol : 'FCFA'}
            </Text>
            {isListingFee && (
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                Ce paiement unique permet la publication de votre annonce immobilière.
              </Text>
            )}
          </View>
          
          {/* Affichage des erreurs */}
          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={24} color="#cc0000" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Sélection de la méthode de paiement */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Méthode de paiement</Text>
            <View style={styles.paymentMethods}>
              {paymentMethods.map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[
                    styles.paymentMethod,
                    { 
                      backgroundColor: paymentMethod === method.value ? colors.primary : colors.card,
                      borderColor: colors.border
                    },
                    !networkAvailable && styles.disabledButton
                  ]}
                  onPress={() => {
                    setPaymentMethod(method.value);
                    if (error) setError(null);
                  }}
                  disabled={!networkAvailable || loading}
                >
                  <MaterialIcons 
                    name={method.icon} 
                    size={24} 
                    color={paymentMethod === method.value ? '#fff' : colors.text} 
                  />
                  <Text 
                    style={[
                      styles.paymentMethodText, 
                      { color: paymentMethod === method.value ? '#fff' : colors.text }
                    ]}
                  >
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Formulaire de paiement */}
          {renderPaymentForm()}
          
          {/* Bouton d'annulation */}
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => {
              if (loading) {
                Alert.alert(
                  'Paiement en cours',
                  'Un paiement est en cours de traitement. Êtes-vous sûr de vouloir annuler ?',
                  [
                    { text: 'Continuer le paiement', style: 'cancel', onPress: () => {} },
                    { text: 'Annuler le paiement', style: 'destructive', onPress: () => navigation.goBack() }
                  ]
                );
              } else {
                navigation.goBack();
              }
            }}
            disabled={loading}
          >
            <Text style={[styles.cancelButtonText, { color: colors.primary }]}>
              Annuler le paiement
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingBottom: Platform.OS === 'android' ? 100 : 40, // Plus d'espace en bas sur Android
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  description: {
    marginBottom: 16,
    fontSize: 14,
  },
  networkWarning: {
    backgroundColor: '#cc0000',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkWarningText: {
    color: '#ffffff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#ffeeee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffcccc',
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    color: '#cc0000',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Platform.OS === 'android' ? 16 : 12, // Boutons plus grands sur Android pour faciliter le toucher
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    marginHorizontal: 4,
    minHeight: Platform.OS === 'android' ? 60 : 48, // Hauteur minimale plus grande sur Android
  },
  paymentMethodText: {
    marginLeft: 8,
    fontWeight: '500',
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  input: {
    height: 50,
    fontSize: 16,
  },
  buttonContainer: {
    marginTop: 24,
  },
  button: {
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardInputsContainer: {
    marginBottom: 16,
  },
  cardInputRow: {
    flexDirection: 'row',
    marginHorizontal: -8,
  },
  cardInputHalf: {
    flex: 1,
    marginHorizontal: 8,
  },
  cardInputLabel: {
    marginBottom: 8,
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  instructionsContainer: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  instructionsTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 14,
  },
  instructionsText: {
    fontSize: 14,
    marginBottom: 4,
  },
  cancelButton: {
    marginTop: 16,
    alignItems: 'center',
    padding: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
