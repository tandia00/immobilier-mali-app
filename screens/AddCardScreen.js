import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../config/supabase';

const MasterCardLogo = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#EB001B', marginRight: -8 }} />
    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#F79E1B', opacity: 0.8 }} />
  </View>
);

const CardIcon = ({ type }) => {
  switch (type) {
    case 'visa':
      return (
        <View style={[styles.cardLogo, { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E5EA' }]}>
          <Text style={[styles.cardLogoText, { color: '#1A1F71' }]}>VISA</Text>
        </View>
      );
    case 'mastercard':
      return (
        <View style={[styles.cardLogo, { backgroundColor: '#FFFFFF', padding: 3 }]}>
          <MasterCardLogo />
        </View>
      );
    case 'amex':
      return (
        <View style={[styles.cardLogo, { backgroundColor: '#2E77BB' }]}>
          <Text style={[styles.cardLogoText, { color: '#FFFFFF' }]}>AMEX</Text>
        </View>
      );
    default:
      return null;
  }
};

const detectCardType = (number) => {
  const firstTwo = number.substring(0, 2);
  if (firstTwo.length < 2) return null;
  
  // Visa
  if (firstTwo[0] === '4') return 'visa';
  
  // Mastercard
  if (['51', '52', '53', '54', '55'].includes(firstTwo)) return 'mastercard';
  
  // American Express
  if (['34', '37'].includes(firstTwo)) return 'amex';
  
  return null;
};

const formatCardNumber = (number) => {
  const cleaned = number.replace(/\D/g, '');
  const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
  return formatted.slice(0, 19); // 16 chiffres + 3 espaces
};

const formatExpiryDate = (text) => {
  const cleaned = text.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
  }
  return cleaned;
};

export default function AddCardScreen({ navigation }) {
  const { colors } = useTheme();
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef(null);

  const cardType = detectCardType(cardNumber);

  const handleCardNumberChange = (text) => {
    const cleaned = text.replace(/\D/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    setCardNumber(formatted.slice(0, 19)); // 16 chiffres + 3 espaces
    
    // Détecter le type de carte dès que nous avons les deux premiers chiffres
    const detectedType = detectCardType(cleaned);
    // setCardType(detectedType);
  };

  const handleExpiryDateChange = (text) => {
    const formatted = formatExpiryDate(text);
    setExpiryDate(formatted);
  };

  const validateExpiryDate = (date) => {
    if (!date.includes('/')) return false;
    const [month, year] = date.split('/');
    if (!month || !year) return false;
    const monthNum = parseInt(month);
    return monthNum > 0 && monthNum <= 12;
  };

  const saveCard = async () => {
    if (!cardNumber || !cardHolderName || !expiryDate || !cvv) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (!validateExpiryDate(expiryDate)) {
      Alert.alert('Erreur', 'Date d\'expiration invalide');
      return;
    }

    if (cardNumber.replace(/\s/g, '').length !== 16) {
      Alert.alert('Erreur', 'Numéro de carte invalide');
      return;
    }

    if (cvv.length !== 3) {
      Alert.alert('Erreur', 'CVV invalide');
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const [month, year] = expiryDate.split('/');
      const last_four = cardNumber.slice(-4);

      const { error } = await supabase
        .from('saved_cards')
        .insert({
          user_id: user.id,
          last_four,
          expiry_month: month,
          expiry_year: year,
          holder_name: cardHolderName.toUpperCase(),
          card_type: cardType,
          is_default: false
        });

      if (error) throw error;

      Alert.alert(
        'Succès',
        'Carte ajoutée avec succès',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Erreur complète:', error);
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFocus = (y) => {
    scrollViewRef.current?.scrollTo({
      y: y,
      animated: true
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewCard}>
          {cardType && (
            <CardIcon type={cardType} />
          )}
          <Text style={styles.cardNumber}>
            {formatCardNumber(cardNumber) || '•••• •••• •••• ••••'}
          </Text>
          <Text style={styles.cardInfo}>
            {cardHolderName || 'NOM DU TITULAIRE'}
          </Text>
          <Text style={styles.cardInfo}>
            {formatExpiryDate(expiryDate) || 'MM/YY'}
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.text }]}>Numéro de carte</Text>
        <TextInput
          style={[styles.cardNumberInput, { backgroundColor: '#2C2C2E', color: '#FFFFFF', borderWidth: 1, borderColor: '#3C3C3E' }]}
          placeholder="1234 5678 9012 3456"
          placeholderTextColor={colors.text + '80'}
          value={cardNumber}
          onChangeText={handleCardNumberChange}
          keyboardType="numeric"
          maxLength={19}
          onFocus={() => handleFocus(200)}
        />

        <Text style={[styles.label, { color: colors.text }]}>Nom sur la carte</Text>
        <TextInput
          style={[styles.input, { backgroundColor: '#2C2C2E', color: '#FFFFFF', borderWidth: 1, borderColor: '#3C3C3E' }]}
          placeholder="NOM PRÉNOM"
          placeholderTextColor={colors.text + '80'}
          value={cardHolderName}
          onChangeText={setCardHolderName}
          autoCapitalize="characters"
          onFocus={() => handleFocus(300)}
        />

        <View style={styles.row}>
          <View style={{ width: '48%' }}>
            <Text style={[styles.label, { color: colors.text }]}>MM/YY</Text>
            <TextInput
              style={[styles.halfInput, { backgroundColor: '#2C2C2E', color: '#FFFFFF', borderWidth: 1, borderColor: '#3C3C3E' }]}
              placeholder="MM/YY"
              placeholderTextColor={colors.text + '80'}
              value={expiryDate}
              onChangeText={handleExpiryDateChange}
              keyboardType="numeric"
              maxLength={5}
              onFocus={() => handleFocus(400)}
            />
          </View>

          <View style={{ width: '48%' }}>
            <Text style={[styles.label, { color: colors.text }]}>CVV</Text>
            <TextInput
              style={[styles.halfInput, { backgroundColor: '#2C2C2E', color: '#FFFFFF', borderWidth: 1, borderColor: '#3C3C3E' }]}
              placeholder="123"
              placeholderTextColor={colors.text + '80'}
              value={cvv}
              onChangeText={setCvv}
              keyboardType="numeric"
              maxLength={3}
              secureTextEntry
              onFocus={() => handleFocus(400)}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={saveCard}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Enregistrer la carte</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  previewCard: {
    height: 200,
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    backgroundColor: '#1C1C1E',
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3C3C3E'
  },
  cardNumberInput: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3C3C3E'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  halfInput: {
    width: '48%',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3C3C3E'
  },
  submitButton: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    backgroundColor: '#4CD964',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cardLogo: {
    width: 50,
    height: 30,
    marginBottom: 20,
  },
  cardNumber: {
    fontSize: 22,
    fontWeight: '500',
    marginBottom: 20,
    letterSpacing: 2,
    color: '#FFFFFF',
  },
  cardInfo: {
    fontSize: 16,
    marginBottom: 10,
    color: '#FFFFFF',
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
});
