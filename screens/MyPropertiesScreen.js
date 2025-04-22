import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../config/supabase';

export default function MyPropertiesScreen({ navigation }) {
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const { colors } = useTheme();

  // Fonction pour rafraîchir les données
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProperties();
    setRefreshing(false);
  };

  // Effet pour charger les données au montage et quand l'écran devient actif
  useEffect(() => {
    fetchProperties();
    
    // Rafraîchir les données quand l'écran devient actif
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProperties();
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    filterProperties(activeFilter);
  }, [properties, activeFilter]);

  const fetchProperties = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setError('Vous devez être connecté pour voir vos annonces');
        setLoading(false);
        return;
      }
      
      console.log('Récupération des propriétés pour l\'utilisateur:', user.id);
      
      // Récupérer les propriétés avec le champ view_count
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          title,
          price,
          city,
          type,
          images,
          created_at,
          phone,
          status,
          view_count
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Erreur lors de la récupération des propriétés:', error);
        setError('Impossible de charger vos annonces');
        setLoading(false);
        return;
      }
      
      console.log('Données reçues:', data);
      
      // Ajouter des logs pour déboguer les compteurs de vues
      if (data && data.length > 0) {
        data.forEach(property => {
          console.log(`[VIEW_COUNT] Propriété ${property.id} - ${property.title}: ${property.view_count ?? 'non défini'} vues`);
        });
      }
      
      // S'assurer que toutes les propriétés ont un compteur de vues, même si null
      const propertiesWithViewCount = (data || []).map(property => ({
        ...property,
        view_count: property.view_count ?? 0 // Utiliser l'opérateur nullish coalescing
      }));
      
      setProperties(propertiesWithViewCount);
    } catch (error) {
      console.error('Erreur complète:', error);
      Alert.alert('Erreur', 'Impossible de charger vos annonces');
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const filterProperties = (filter) => {
    switch (filter) {
      case 'pending':
        setFilteredProperties(properties.filter(p => p.status === 'pending'));
        break;
      case 'approved':
        setFilteredProperties(properties.filter(p => p.status === 'approved'));
        break;
      case 'rejected':
        setFilteredProperties(properties.filter(p => p.status === 'rejected'));
        break;
      default:
        setFilteredProperties(properties);
        break;
    }
  };

  const getSignedUrl = async (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;

    try {
      const { data: { publicUrl }, error } = await supabase.storage
        .from('property-images')
        .getPublicUrl(imagePath);

      if (error) throw error;
      console.log('URL publique générée:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Erreur lors de la génération de l\'URL publique:', error);
      return null;
    }
  };

  const handleDelete = async (propertyId) => {
    // Demander confirmation avant de supprimer
    Alert.alert(
      'Confirmation',
      'Êtes-vous sûr de vouloir supprimer cette annonce ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('properties')
                .delete()
                .eq('id', propertyId);

              if (error) throw error;
              
              // Mettre à jour la liste des propriétés
              setProperties(properties.filter(prop => prop.id !== propertyId));
              Alert.alert('Succès', 'Annonce supprimée avec succès');
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer l\'annonce');
              console.error('Erreur lors de la suppression:', error.message);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const renderPropertyCard = ({ item }) => {
    console.log('Rendu de la carte de propriété:', {
      id: item.id,
      title: item.title,
      images: item.images,
      main_image: item.main_image
    });
    
    if (!item) return null;

    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.imageContainer}>
          <Image
            source={{ 
              uri: item.images[0] || 'https://via.placeholder.com/300x200',
              cache: 'reload'
            }}
            style={styles.propertyImage}
            resizeMode="cover"
            onError={(error) => console.error('Erreur de chargement de l\'image:', error.nativeEvent.error)}
            onLoad={() => console.log('Image chargée avec succès:', item.images[0])}
          />
          {/* Badge compteur de vues */}
          {item.view_count > 0 && (
            <View style={styles.viewCountBadge}>
              <MaterialIcons name="visibility" size={14} color="#fff" />
              <Text style={styles.viewCountText}>{item.view_count || 0}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          <Text style={[styles.price, { color: colors.primary }]}>
            {item.price?.toLocaleString()} FCFA
          </Text>
          <View style={styles.location}>
            <MaterialIcons name="location-on" size={16} color={colors.text} />
            <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
              {item.city}
            </Text>
          </View>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary + '20' }]}
            onPress={() => navigation.navigate('EditProperty', { propertyId: item.id })}
          >
            <MaterialIcons name="edit" size={18} color={colors.primary} />
            <Text style={[styles.buttonText, { color: colors.primary }]}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: '#FF3B30' }]}
            onPress={() => handleDelete(item.id)}
          >
            <MaterialIcons name="delete" size={18} color="#FFFFFF" />
            <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFilterBar = () => {
    return (
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'all' && styles.activeFilterButton]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterText, activeFilter === 'all' && styles.activeFilterText]}>Tous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'pending' && styles.activeFilterButton]}
          onPress={() => setActiveFilter('pending')}
        >
          <Text style={[styles.filterText, activeFilter === 'pending' && styles.activeFilterText]}>En attente</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'approved' && styles.activeFilterButton]}
          onPress={() => setActiveFilter('approved')}
        >
          <Text style={[styles.filterText, activeFilter === 'approved' && styles.activeFilterText]}>Approuvés</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'rejected' && styles.activeFilterButton]}
          onPress={() => setActiveFilter('rejected')}
        >
          <Text style={[styles.filterText, activeFilter === 'rejected' && styles.activeFilterText]}>Rejetés</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Barre de filtres toujours visible */}
      {renderFilterBar()}
      
      {loading && properties.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={fetchProperties}
          >
            <Text style={styles.retryButtonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : filteredProperties.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="home" size={48} color={colors.text} />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            {activeFilter === 'all' 
              ? "Vous n'avez pas encore d'annonces" 
              : `Aucune annonce ${
                  activeFilter === 'pending' ? 'en attente' : 
                  activeFilter === 'approved' ? 'approuvée' : 'rejetée'
                }`
            }
          </Text>
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('AddProperty')}
          >
            <Text style={styles.addButtonText}>Ajouter une annonce</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredProperties}
          renderItem={renderPropertyCard}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 5,
    marginBottom: 10,
    borderRadius: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 5,
    alignItems: 'center',
    borderRadius: 5,
    marginHorizontal: 2,
  },
  activeFilterButton: {
    backgroundColor: '#4CAF50',
  },
  filterText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 10,
    marginBottom: 15,
    overflow: 'hidden',
    flex: 1,
    maxWidth: '48%',
    margin: 5,
  },
  imageContainer: {
    position: 'relative',
  },
  propertyImage: {
    width: '100%',
    height: 150,
    backgroundColor: '#2a2a2a',
  },
  cardContent: {
    padding: 15,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    marginLeft: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 5,
    borderRadius: 8,
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginHorizontal: 5,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 12,
    marginLeft: 5,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  addButton: {
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 5,
    fontWeight: '500',
  },
  listContainer: {
    padding: 5,
  },
  row: {
    flex: 1,
    justifyContent: 'space-between',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginLeft: 5,
    fontWeight: '500',
  },
  viewCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewCountText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 4,
  },
});
