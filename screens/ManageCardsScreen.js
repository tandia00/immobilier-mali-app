import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../config/supabase';

export default function ManageCardsScreen({ navigation }) {
  const { colors } = useTheme();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      fetchCards();
    }, [])
  );

  const fetchCards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { data, error } = await supabase
        .from('saved_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCards(data || []);
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteCard = async (cardId) => {
    Alert.alert(
      'Supprimer la carte',
      'Êtes-vous sûr de vouloir supprimer cette carte ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('saved_cards')
                .delete()
                .eq('id', cardId);

              if (error) throw error;
              fetchCards();
            } catch (error) {
              Alert.alert('Erreur', error.message);
            }
          }
        }
      ]
    );
  };

  const toggleDefaultCard = async (cardId, isCurrentlyDefault) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      if (isCurrentlyDefault) {
        // Si la carte est déjà par défaut, on retire simplement son statut
        const { error } = await supabase
          .from('saved_cards')
          .update({ is_default: false })
          .eq('id', cardId);

        if (error) throw error;
      } else {
        // Si la carte n'est pas par défaut, on la définit comme carte par défaut
        // D'abord, on retire le statut par défaut de toutes les cartes
        const { error: resetError } = await supabase
          .from('saved_cards')
          .update({ is_default: false })
          .eq('user_id', user.id);

        if (resetError) throw resetError;

        // Ensuite, on définit la carte sélectionnée comme carte par défaut
        const { error: updateError } = await supabase
          .from('saved_cards')
          .update({ is_default: true })
          .eq('id', cardId);

        if (updateError) throw updateError;
      }

      // Rafraîchir la liste des cartes
      fetchCards();
    } catch (error) {
      console.error('Erreur lors de la modification de la carte par défaut:', error);
      Alert.alert('Erreur', error.message);
    }
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

  const renderCard = ({ item }) => {
    // Ajouter des logs pour déboguer
    console.log('Card item:', item);
    
    return (
      <View style={[styles.cardItem, { backgroundColor: colors.card }]}>
        <View style={styles.cardContent}>
          <CardIcon type={item.card_type} />
          <View style={styles.cardInfo}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardNumber, { color: colors.text }]}>
                •••• •••• •••• {item.last_four || ''}
              </Text>
              {item.is_default && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>Par défaut</Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardExpiry, { color: colors.text }]}>
              Expire {(item.expiry_month || '').toString().padStart(2, '0')}/{item.expiry_year || ''}
            </Text>
            <Text style={[styles.cardHolder, { color: colors.text }]}>
              {item.holder_name || ''}
            </Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.defaultButton}
            onPress={() => toggleDefaultCard(item.id, item.is_default)}
          >
            <MaterialIcons 
              name={item.is_default ? "star" : "star-outline"} 
              size={24} 
              color={item.is_default ? "#FFB800" : "#007AFF"} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditCard', { card: item })}
          >
            <MaterialIcons name="edit" size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => deleteCard(item.id)}
          >
            <MaterialIcons name="delete-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const addNewCard = () => {
    navigation.navigate('AddCard');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {cards.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={styles.emptyState}>
            <MaterialIcons name="credit-card" size={48} color={colors.text} />
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Aucune carte enregistrée
            </Text>
          </View>
          
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={addNewCard}
          >
            <MaterialIcons name="add" size={24} color="white" />
            <Text style={styles.addButtonText}>Ajouter une carte</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cards}
            renderItem={renderCard}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.cardsList}
          />

          <View style={styles.bottomButton}>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={addNewCard}
            >
              <MaterialIcons name="add" size={24} color="white" />
              <Text style={styles.addButtonText}>Ajouter une carte</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 90 : 70,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 16,
  },
  addButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cardsList: {
    padding: 16,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardNumber: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#000000',
  },
  cardExpiry: {
    fontSize: 14,
    marginTop: 4,
    color: '#666666',
  },
  cardHolder: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
    color: '#666666',
    textTransform: 'uppercase',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
  },
  bottomButton: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 35 : 20,
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
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  defaultBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultButton: {
    padding: 10,
    marginRight: 5,
  },
  editButton: {
    padding: 8,
    marginRight: 5,
  },
});
