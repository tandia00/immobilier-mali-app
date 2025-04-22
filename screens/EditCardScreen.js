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

const EditCardScreen = ({ route, navigation }) => {
  const { card } = route.params;
  const [cardHolderName, setCardHolderName] = useState(card.holder_name);
  const [expiryDate, setExpiryDate] = useState(`${card.expiry_month}/${card.expiry_year.slice(-2)}`);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef(null);
  const { colors, isDark } = useTheme();

  const formatExpiryDate = (text) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
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
    if (!cardHolderName || !expiryDate) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (!validateExpiryDate(expiryDate)) {
      Alert.alert('Erreur', 'Date d\'expiration invalide');
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const [month, year] = expiryDate.split('/');

      console.log('Tentative de modification de la carte:', {
        holder_name: cardHolderName.toUpperCase(),
        expiry_month: month,
        expiry_year: year,
      });

      const { error } = await supabase
        .from('saved_cards')
        .update({
          holder_name: cardHolderName.toUpperCase(),
          expiry_month: month,
          expiry_year: year,
        })
        .eq('id', card.id);

      if (error) throw error;

      Alert.alert(
        'Succès',
        'Carte modifiée avec succès',
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
        return (
          <View style={styles.cardLogo}>
            <MaterialIcons name="credit-card" size={24} color="#666666" />
          </View>
        );
    }
  };

  // Styles dynamiques basés sur le thème
  const dynamicStyles = {
    container: {
      backgroundColor: colors.background,
    },
    previewCard: {
      backgroundColor: isDark ? '#121212' : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? '#404040' : '#E5E5EA',
      shadowColor: isDark ? '#000000' : '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.1,
      shadowRadius: 8,
      elevation: 5,
    },
    cardNumber: {
      color: isDark ? '#FFFFFF' : '#000000',
      opacity: isDark ? 1 : 1,
    },
    cardInfo: {
      color: isDark ? '#FFFFFF' : '#000000',
      opacity: isDark ? 1 : 1,
    },
    input: {
      backgroundColor: isDark ? '#121212' : '#FFFFFF',
      color: isDark ? '#FFFFFF' : '#000000',
      borderWidth: 1,
      borderColor: isDark ? '#505050' : '#E5E5EA',
      shadowColor: isDark ? '#000000' : '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    label: {
      color: isDark ? '#FFFFFF' : '#000000',
      opacity: isDark ? 1 : 0.87,
    },
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, dynamicStyles.container]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.previewCard, dynamicStyles.previewCard]}>
          <CardIcon type={card.card_type} />
          <Text style={[styles.cardNumber, dynamicStyles.cardNumber]}>
            •••• •••• •••• {card.last_four}
          </Text>
          <Text style={[styles.cardInfo, dynamicStyles.cardInfo]}>
            {cardHolderName}
          </Text>
          <Text style={[styles.cardInfo, dynamicStyles.cardInfo]}>
            {expiryDate}
          </Text>
        </View>

        <Text style={[styles.label, dynamicStyles.label]}>Nom du titulaire</Text>
        <TextInput
          style={[styles.input, dynamicStyles.input]}
          placeholder="NOM PRÉNOM"
          placeholderTextColor={isDark ? '#808080' : '#999999'}
          value={cardHolderName}
          onChangeText={setCardHolderName}
          autoCapitalize="characters"
          onFocus={() => handleFocus(200)}
        />

        <Text style={[styles.label, dynamicStyles.label]}>Date d'expiration (MM/YY)</Text>
        <TextInput
          style={[styles.input, dynamicStyles.input]}
          placeholder="MM/YY"
          placeholderTextColor={isDark ? '#808080' : '#999999'}
          value={expiryDate}
          onChangeText={handleExpiryDateChange}
          keyboardType="numeric"
          maxLength={5}
          onFocus={() => handleFocus(300)}
        />

        <TouchableOpacity
          style={[styles.submitButton, { opacity: loading ? 0.7 : 1 }]}
          onPress={saveCard}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

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
  },
  cardNumber: {
    fontSize: 22,
    fontWeight: '500',
    marginBottom: 20,
    letterSpacing: 2,
  },
  cardInfo: {
    fontSize: 16,
    marginBottom: 10,
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
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
    width: 40,
    height: 26,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cardLogoText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default EditCardScreen;
