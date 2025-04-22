import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';

export default function SearchHistoryScreen({ navigation }) {
  const [searchHistory, setSearchHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      const { data, error } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSearchHistory(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error);
      Alert.alert('Erreur', 'Impossible de charger l\'historique de recherche');
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryItem = async (itemId) => {
    try {
      const { error } = await supabase
        .from('search_history')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      setSearchHistory(prev => prev.filter(item => item.id !== itemId));
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      Alert.alert('Erreur', 'Impossible de supprimer cet élément');
    }
  };

  const clearAllHistory = async () => {
    Alert.alert(
      'Confirmer la suppression',
      'Voulez-vous vraiment supprimer tout l\'historique de recherche ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              const { error } = await supabase
                .from('search_history')
                .delete()
                .eq('user_id', user.id);

              if (error) throw error;
              setSearchHistory([]);
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'historique');
            }
          }
        }
      ]
    );
  };

  const renderHistoryItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.historyItem, { backgroundColor: colors.card }]}
      onPress={() => navigation.navigate('Home', { searchQuery: item.search_query })}
    >
      <View style={styles.historyContent}>
        <MaterialIcons name="history" size={24} color={colors.text} style={styles.historyIcon} />
        <View style={styles.historyTextContainer}>
          <Text style={[styles.historyText, { color: colors.text }]}>
            {item.search_query}
          </Text>
          <Text style={[styles.historyDate, { color: colors.text }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => deleteHistoryItem(item.id)}
        style={styles.deleteButton}
      >
        <MaterialIcons name="close" size={24} color={colors.text} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {searchHistory.length > 0 ? (
        <>
          <TouchableOpacity
            style={[styles.clearAllButton, { backgroundColor: colors.card }]}
            onPress={clearAllHistory}
          >
            <MaterialIcons name="delete-sweep" size={24} color="#FF5252" />
            <Text style={[styles.clearAllText, { color: '#FF5252' }]}>
              Effacer tout l'historique
            </Text>
          </TouchableOpacity>

          <FlatList
            data={searchHistory}
            renderItem={renderHistoryItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContainer}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="history" size={48} color={colors.text} />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            Aucun historique de recherche
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    padding: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    justifyContent: 'space-between',
  },
  historyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyIcon: {
    marginRight: 12,
  },
  historyTextContainer: {
    flex: 1,
  },
  historyText: {
    fontSize: 16,
    marginBottom: 4,
  },
  historyDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  deleteButton: {
    padding: 8,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  clearAllText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
  },
});
