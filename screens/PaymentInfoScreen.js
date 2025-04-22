import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';

export default function PaymentInfoScreen({ navigation }) {
  const { colors, dark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('orange_money');
  const [orangeMoneyNumber, setOrangeMoneyNumber] = useState('');
  const [moovMoneyNumber, setMoovMoneyNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  useEffect(() => {
    loadPaymentInfo();
  }, []);

  const loadPaymentInfo = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      const { data, error } = await supabase
        .from('payment_info')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPaymentMethod(data.preferred_method || 'orange_money');
        setOrangeMoneyNumber(data.orange_money_number || '');
        setMoovMoneyNumber(data.moov_money_number || '');
        setBankName(data.bank_name || '');
        setAccountNumber(data.account_number || '');
        setAccountName(data.account_name || '');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des informations de paiement:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePaymentInfo = async () => {
    // Validation de base
    if (paymentMethod === 'orange_money' && !orangeMoneyNumber) {
      Alert.alert('Erreur', 'Veuillez saisir votre numéro Orange Money');
      return;
    }
    if (paymentMethod === 'moov_money' && !moovMoneyNumber) {
      Alert.alert('Erreur', 'Veuillez saisir votre numéro Moov Money');
      return;
    }
    if (paymentMethod === 'bank_account' && (!bankName || !accountNumber || !accountName)) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs bancaires');
      return;
    }

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non connecté');

      const paymentData = {
        user_id: user.id,
        preferred_method: paymentMethod,
        orange_money_number: orangeMoneyNumber,
        moov_money_number: moovMoneyNumber,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        updated_at: new Date().toISOString()
      };

      // Vérifier si l'enregistrement existe déjà
      const { data: existingData, error: checkError } = await supabase
        .from('payment_info')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      let error;
      if (existingData) {
        // Mise à jour
        const { error: updateError } = await supabase
          .from('payment_info')
          .update(paymentData)
          .eq('user_id', user.id);
        error = updateError;
      } else {
        // Insertion
        const { error: insertError } = await supabase
          .from('payment_info')
          .insert(paymentData);
        error = insertError;
      }

      if (error) throw error;

      Alert.alert(
        'Succès',
        'Vos informations de paiement ont été enregistrées avec succès',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement des informations de paiement:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer vos informations de paiement');
    } finally {
      setSaving(false);
    }
  };

  const paymentMethods = [
    { id: 'orange_money', label: 'Orange Money', icon: 'account-balance-wallet' },
    { id: 'moov_money', label: 'Moov Money', icon: 'account-balance-wallet' },
    { id: 'bank_account', label: 'Compte Bancaire', icon: 'account-balance' },
  ];

  // Styles dynamiques basés sur le thème
  const dynamicStyles = {
    container: {
      backgroundColor: colors.background,
    },
    title: {
      color: colors.text,
    },
    label: {
      color: colors.text,
    },
    input: {
      backgroundColor: dark ? '#121212' : '#FFFFFF',
      color: colors.text,
      borderColor: dark ? '#404040' : '#E5E5EA',
    },
    methodButton: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    selectedMethod: {
      backgroundColor: colors.primary,
    },
    methodText: {
      color: colors.text,
    },
    selectedMethodText: {
      color: '#FFFFFF',
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
  };

  if (loading) {
    return (
      <View style={[styles.container, dynamicStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, dynamicStyles.container]}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, dynamicStyles.title]}>
          Informations de paiement
        </Text>
        <Text style={[styles.subtitle, dynamicStyles.label]}>
          Ces informations seront utilisées pour recevoir vos paiements
        </Text>

        <Text style={[styles.sectionTitle, dynamicStyles.label]}>
          Méthode de paiement préférée
        </Text>

        <View style={styles.paymentMethods}>
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodButton,
                dynamicStyles.methodButton,
                paymentMethod === method.id && [styles.selectedMethod, dynamicStyles.selectedMethod],
              ]}
              onPress={() => setPaymentMethod(method.id)}
            >
              <View style={styles.methodContent}>
                <MaterialIcons
                  name={method.icon}
                  size={24}
                  color={paymentMethod === method.id ? '#fff' : colors.text}
                />
                <Text
                  style={[
                    styles.methodText,
                    dynamicStyles.methodText,
                    paymentMethod === method.id && dynamicStyles.selectedMethodText,
                  ]}
                >
                  {method.label}
                </Text>
              </View>
              {paymentMethod === method.id && (
                <MaterialIcons name="check-circle" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {paymentMethod === 'orange_money' && (
          <View style={styles.section}>
            <Text style={[styles.label, dynamicStyles.label]}>Numéro Orange Money</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="Ex: 70123456"
              placeholderTextColor={dark ? '#808080' : '#A0A0A0'}
              value={orangeMoneyNumber}
              onChangeText={setOrangeMoneyNumber}
              keyboardType="phone-pad"
            />
          </View>
        )}

        {paymentMethod === 'moov_money' && (
          <View style={styles.section}>
            <Text style={[styles.label, dynamicStyles.label]}>Numéro Moov Money</Text>
            <TextInput
              style={[styles.input, dynamicStyles.input]}
              placeholder="Ex: 76123456"
              placeholderTextColor={dark ? '#808080' : '#A0A0A0'}
              value={moovMoneyNumber}
              onChangeText={setMoovMoneyNumber}
              keyboardType="phone-pad"
            />
          </View>
        )}

        {paymentMethod === 'bank_account' && (
          <>
            <View style={styles.section}>
              <Text style={[styles.label, dynamicStyles.label]}>Nom de la banque</Text>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder="Ex: BDM-SA"
                placeholderTextColor={dark ? '#808080' : '#A0A0A0'}
                value={bankName}
                onChangeText={setBankName}
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, dynamicStyles.label]}>Numéro de compte</Text>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder="Ex: ML123456789"
                placeholderTextColor={dark ? '#808080' : '#A0A0A0'}
                value={accountNumber}
                onChangeText={setAccountNumber}
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.label, dynamicStyles.label]}>Nom du titulaire</Text>
              <TextInput
                style={[styles.input, dynamicStyles.input]}
                placeholder="Ex: Amadou Diallo"
                placeholderTextColor={dark ? '#808080' : '#A0A0A0'}
                value={accountName}
                onChangeText={setAccountName}
              />
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.saveButton, dynamicStyles.saveButton]}
          onPress={savePaymentInfo}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  paymentMethods: {
    marginBottom: 24,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  selectedMethod: {
    backgroundColor: '#4CAF50',
  },
  methodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  saveButton: {
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
