import React from 'react';
import { View, Text, StyleSheet, Share, TouchableOpacity } from 'react-native';
import { useTheme } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import moment from 'moment';

const ReceiptScreen = ({ route }) => {
  const { colors } = useTheme();
  const { transaction } = route.params;

  const shareReceipt = async () => {
    try {
      const result = await Share.share({
        message: `
        RÉCÉPISSE DE PAIEMENT
        
        Transaction ID: ${transaction.id}
        Date: ${moment(transaction.created_at).format('DD/MM/YYYY HH:mm')}
        
        Montant: ${transaction.amount} FCFA
        Type: ${transaction.payment_method}
        
        Propriétaire: ${transaction.seller_name}
        Client: ${transaction.buyer_name}
        
        Bien: ${transaction.property_name}
        
        Statut: ${transaction.status}
        `
      });
    } catch (error) {
      console.log('Erreur lors du partage:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="receipt" size={40} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>RÉCÉPISSE DE PAIEMENT</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Transaction ID:</Text>
          <Text style={[styles.value, { color: colors.text }]}>{transaction.id}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Date:</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {moment(transaction.created_at).format('DD/MM/YYYY HH:mm')}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Montant:</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {transaction.amount} FCFA
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Type de paiement:</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {transaction.payment_method}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Propriétaire:</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {transaction.seller_name}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Client:</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {transaction.buyer_name}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Bien:</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {transaction.property_name}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.text }]}>Statut:</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {transaction.status}
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.shareButton, { backgroundColor: colors.primary }]} 
        onPress={shareReceipt}
      >
        <Text style={[styles.shareButtonText, { color: colors.background }]}>
          Partager le récépissé
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  content: {
    backgroundColor: '#f5f5f5',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    marginTop: 5,
  },
  shareButton: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReceiptScreen;
