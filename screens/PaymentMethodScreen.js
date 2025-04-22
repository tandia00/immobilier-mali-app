import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';

export default function PaymentMethodScreen({ navigation }) {
  const { colors } = useTheme();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [loading, setLoading] = useState(true);

  const paymentMethods = [
    { id: 'orange_money', label: 'Orange Money', icon: 'account-balance-wallet' },
    { id: 'moov_money', label: 'Moov Money', icon: 'account-balance-wallet' },
    { id: 'card', label: 'Carte Bancaire', icon: 'credit-card' },
  ];

  useEffect(() => {
    loadPaymentMethod();
  }, []);

  const loadPaymentMethod = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { data, error } = await supabase
        .from('profiles')
        .select('payment_method')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setSelectedMethod(data.payment_method);
    } catch (error) {
      console.error('Erreur lors du chargement du moyen de paiement:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentMethod = async (method) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const { error } = await supabase
        .from('profiles')
        .update({ payment_method: method })
        .eq('id', user.id);

      if (error) throw error;

      setSelectedMethod(method);
      Alert.alert('Succès', 'Votre moyen de paiement préféré a été mis à jour');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour le moyen de paiement');
      console.error('Erreur lors de la mise à jour du moyen de paiement:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        Choisissez votre moyen de paiement préféré
      </Text>

      {paymentMethods.map((method) => (
        <TouchableOpacity
          key={method.id}
          style={[
            styles.methodButton,
            { backgroundColor: colors.card },
            selectedMethod === method.id && styles.selectedMethod,
          ]}
          onPress={() => updatePaymentMethod(method.id)}
          disabled={loading}
        >
          <View style={styles.methodContent}>
            <MaterialIcons
              name={method.icon}
              size={24}
              color={selectedMethod === method.id ? '#fff' : colors.text}
            />
            <Text
              style={[
                styles.methodText,
                { color: selectedMethod === method.id ? '#fff' : colors.text },
              ]}
            >
              {method.label}
            </Text>
          </View>
          {selectedMethod === method.id && (
            <MaterialIcons name="check-circle" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
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
});
