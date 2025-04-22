import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { supabase } from '../config/supabase';
import PropertyCard from '../components/PropertyCard';
import { useIsFocused } from '@react-navigation/native';

export default function FavoritesScreen({ navigation }) {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('Utilisateur non connecté');
        return;
      }

      const { data: favoritesData, error: favoritesError } = await supabase
        .rpc('get_user_favorites_v2', { user_uuid: user.id });

      if (favoritesError) {
        console.error('Erreur lors du chargement des favoris:', favoritesError.message);
        return;
      }

      setFavorites(favoritesData || []);
    } catch (error) {
      console.error('Erreur:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleFavorite = async (propertyId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .rpc('toggle_favorite_v2', { 
          property_uuid: propertyId, 
          user_uuid: user.id 
        });

      if (error) throw error;

      // Recharger les favoris
      loadFavorites();
    } catch (error) {
      console.error('Erreur lors de la modification du favori:', error);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadFavorites();
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadFavorites();
    }
  }, [isFocused]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>Chargement...</Text>
      </View>
    );
  }

  if (favorites.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.text}>Aucun favori pour le moment</Text>
        <Text style={styles.subtitle}>
          Les propriétés que vous ajoutez en favori apparaîtront ici
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.favorite_id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <View style={styles.cardContainer}>
            <PropertyCard
              property={{
                id: item.property_id,
                title: item.property_title,
                price: item.property_price,
                city: item.property_city,
                type: item.property_type,
                images: item.property_images,
                isFavorite: true
              }}
              onPress={() => navigation.navigate('PropertyDetails', { 
                propertyId: item.property_id 
              })}
              onFavoritePress={() => toggleFavorite(item.property_id)}
              isFavorite={true}
              style={styles.card}
            />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1C1C1E',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  subtitle: {
    marginTop: 10,
    textAlign: 'center',
    color: '#E0E0E0',
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cardContainer: {
    flex: 1,
    maxWidth: '48%',
    marginHorizontal: 4,
  },
  card: {
    width: '100%',
    backgroundColor: '#2C2C2E',
  }
});
