import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import ThemeWrapper from '../components/ThemeWrapper';
import { useTheme } from '../context/ThemeContext';
import { useThemedStyles, commonStyles } from '../hooks/useThemedStyles';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import PropertyCard from '../components/PropertyCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import EventRegister from '../services/EventRegister';

// Cache pour les propriétés déjà chargées
const propertyImageCache = new Map();

const getImageUrl = async (fileUrl) => {
  if (!fileUrl) {
    console.log('[getImageUrl] URL manquante');
    return null;
  }
  
  console.log('[getImageUrl] URL reçue:', fileUrl);
  
  // Si l'URL est déjà une URL Supabase complète, on la retourne directement
  if (fileUrl.startsWith('https://kwedbyldfnmalhotffjt.supabase.co/')) {
    console.log('[getImageUrl] URL Supabase détectée, retour direct');
    return fileUrl;
  }
  
  // Sinon, on essaie de créer une URL signée
  try {
    console.log('[getImageUrl] Création d\'une URL signée pour:', fileUrl);
    const { data, error } = await supabase.storage
      .from('property-images')
      .createSignedUrl(fileUrl, 3600);

    if (error) {
      console.error('[getImageUrl] Erreur lors de la récupération de l\'URL signée:', error);
      console.error('[getImageUrl] Message d\'erreur complet:', JSON.stringify(error));
      return null;
    }

    if (data?.signedUrl) {
      console.log('[getImageUrl] URL signée obtenue avec succès:', data.signedUrl.substring(0, 100) + '...');
      return data.signedUrl;
    }

    console.error('[getImageUrl] Pas d\'URL signée dans la réponse');
    return null;
  } catch (error) {
    console.error('[getImageUrl] Erreur inattendue:', error);
    console.error('[getImageUrl] Stack trace:', error.stack);
    return null;
  }
};

function formatRelativeTime(date) {
  if (!date) return '';
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) {
    return minutes <= 1 ? 'Il y a 1 minute' : `Il y a ${minutes} minutes`;
  } else if (hours < 24) {
    return hours === 1 ? 'Il y a 1 heure' : `Il y a ${hours} heures`;
  } else if (days < 30) {
    return days === 1 ? 'Il y a 1 jour' : `Il y a ${days} jours`;
  } else {
    const date = new Date(date);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

const HomeScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  
  // Référence pour accéder au composant ScrollView
  const scrollViewRef = useRef(null);
  const scrollPosition = useRef(0);
  const isRestoringScroll = useRef(false);
  const lastSavedPosition = useRef(0);
  
  // Clés pour le stockage AsyncStorage
  const SCROLL_POSITION_STORAGE_KEY = '@homeScrollPosition';
  const VIEWED_PROPERTIES_STORAGE_KEY = '@viewedProperties';
  const FAVORITES_STORAGE_KEY = '@favorites';
  const SEARCH_HISTORY_STORAGE_KEY = '@searchHistory';

  // State
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState([]);
  const [viewedProperties, setViewedProperties] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedCity, setSelectedCity] = useState('');

  // Référence pour les propriétés consultées
  const viewedPropertiesRef = useRef([]);

  useEffect(() => {
    // Mettre à jour la référence des propriétés consultées
    viewedPropertiesRef.current = viewedProperties;
  }, [viewedProperties]);

  useEffect(() => {
    const fetchUser = async () => {
      console.log('[AUTH_DEBUG] Début de fetchUser');
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error('[AUTH_DEBUG] Erreur dans fetchUser:', error);
          return;
        }

        console.log('[AUTH_DEBUG] Utilisateur récupéré:', user ? 'Connecté' : 'Non connecté');
        setCurrentUser(user);
      } catch (e) {
        console.error('[AUTH_DEBUG] Exception dans fetchUser:', e);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (currentUser) {
        fetchFavorites();
      }
    });

    return unsubscribe;
  }, [navigation, currentUser]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerStyle: {
        backgroundColor: colors.card,
      },
      headerTintColor: colors.text,
      title: 'Accueil'
    });
  }, [navigation, colors]);

  const propertyTypes = ['Appartement', 'Maison', 'Villa', 'Bureau', 'Local'];

  const locations = [
    {
      id: 'bamako-district',
      name: 'Bamako',
      cities: ['Bamako', 'Kalaban-Coro', 'Kati', 'Moribabougou', 'Baguineda']
    },
    {
      id: 'gao-region',
      name: 'Gao',
      cities: ['Gao', 'Ansongo', 'Bourem']
    },
    {
      id: 'kayes-region',
      name: 'Kayes',
      cities: ['Kayes', 'Kéniéba', 'Kita', 'Nioro du Sahel', 'Yélimané', 'Sadiola']
    },
    {
      id: 'kidal-region',
      name: 'Kidal',
      cities: ['Kidal', 'Tessalit', 'Abeïbara', 'Tin-Essako']
    },
    {
      id: 'koulikoro-region',
      name: 'Koulikoro',
      cities: ['Koulikoro', 'Kati', 'Kolokani', 'Nara', 'Banamba', 'Dioïla']
    },
    {
      id: 'menaka-region',
      name: 'Ménaka',
      cities: ['Ménaka', 'Andéramboukane', 'Inékar']
    },
    {
      id: 'mopti-region',
      name: 'Mopti',
      cities: ['Mopti', 'Bandiagara', 'Djenné', 'Douentza', 'Koro', 'Bankass']
    },
    {
      id: 'segou-region',
      name: 'Ségou',
      cities: ['Ségou', 'San', 'Bla', 'Niono', 'Macina', 'Barouéli']
    },
    {
      id: 'sikasso-region',
      name: 'Sikasso',
      cities: ['Sikasso', 'Bougouni', 'Koutiala', 'Kadiolo', 'Kolondiéba', 'Yorosso']
    },
    {
      id: 'taoudenit-region',
      name: 'Taoudénit',
      cities: ['Taoudénit', 'Foum Alba', 'Achouratt']
    },
    {
      id: 'tombouctou-region',
      name: 'Tombouctou',
      cities: ['Tombouctou', 'Diré', 'Goundam', 'Niafunké', 'Gourma-Rharous']
    }
  ].sort((a, b) => a.name.localeCompare(b.name));

  const fetchFavorites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .rpc('get_user_favorites_v2', { user_uuid: user.id });

      if (error) throw error;

      // Extraire juste les IDs des propriétés favorites
      setFavorites((data || []).map(fav => fav.property_id));
    } catch (error) {
      console.error('Error in fetchFavorites:', error);
    }
  };

  const toggleFavorite = async (propertyId) => {
    if (!currentUser) {
      navigation.navigate('SignIn');
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('toggle_favorite_v2', { 
          property_uuid: propertyId, 
          user_uuid: currentUser.id 
        });

      if (error) throw error;

      // Mettre à jour l'état local des favoris
      if (data === true) {
        setFavorites([...favorites, propertyId]);
      } else {
        setFavorites(favorites.filter(id => id !== propertyId));
      }

      // Émettre un événement pour synchroniser les autres écrans
      EventRegister.emit('favoriteToggled', { propertyId, isFavorite: data });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Erreur', 'Impossible de modifier les favoris');
    }
  };

  // Fonction pour sauvegarder une recherche dans l'historique
  const saveSearchToHistory = async (query) => {
    if (!query || query.trim() === '') return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // Ne pas sauvegarder si l'utilisateur n'est pas connecté
      
      // Vérifier si cette recherche existe déjà pour cet utilisateur
      const { data: existingSearches } = await supabase
        .from('search_history')
        .select('id')
        .eq('user_id', user.id)
        .eq('search_query', query.trim())
        .limit(1);
      
      // Si la recherche existe déjà, ne pas la dupliquer
      if (existingSearches && existingSearches.length > 0) {
        // Mettre à jour la date de la recherche existante
        await supabase
          .from('search_history')
          .update({ created_at: new Date().toISOString() })
          .eq('id', existingSearches[0].id);
        return;
      }
      
      // Insérer la nouvelle recherche
      await supabase
        .from('search_history')
        .insert({
          user_id: user.id,
          search_query: query.trim(),
          created_at: new Date().toISOString()
        });
      
      console.log('Recherche sauvegardée dans l\'historique:', query);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la recherche:', error);
    }
  };

  // Charger les propriétés consultées depuis AsyncStorage
  const loadViewedProperties = useCallback(async () => {
    try {
      const storedProperties = await AsyncStorage.getItem(VIEWED_PROPERTIES_STORAGE_KEY);
      if (storedProperties) {
        const parsedProperties = JSON.parse(storedProperties);
        setViewedProperties(parsedProperties);
      }
    } catch (error) {
      console.error('[VIEWED_PROPERTIES] Erreur:', error);
    }
  }, []);

  // Ajouter une propriété aux propriétés consultées et incrémenter le compteur de vues
  const addToViewedProperties = useCallback(async (propertyId) => {
    try {
      if (viewedPropertiesRef.current.includes(propertyId)) {
        return;
      }

      // Mettre à jour la liste des propriétés consultées
      const updatedProperties = [propertyId, ...viewedPropertiesRef.current].slice(0, 50);
      await AsyncStorage.setItem(VIEWED_PROPERTIES_STORAGE_KEY, JSON.stringify(updatedProperties));
      setViewedProperties(updatedProperties);

      // Incrémenter le compteur de vues dans Supabase
      const { error } = await supabase.rpc('increment_view_count', { property_id: propertyId });

      if (error) {
        console.error('Erreur lors de l\'incrémentation du compteur:', error);
      }
    } catch (error) {
      console.error('[VIEWED_PROPERTIES] Erreur:', error);
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await Promise.all([
            fetchProperties(),
            fetchFavorites(),
            loadViewedProperties()
          ]);
        }
      } catch (error) {
        console.error('[HomeScreen] Erreur lors du chargement initial:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setProperties(data);
        setFilteredProperties(data);
      }
    } catch (error) {
      console.error('[HomeScreen] Erreur lors de la récupération des propriétés:', error);
      Alert.alert('Erreur', 'Impossible de charger les propriétés');
    }
  };

  // Gérer la soumission de la recherche
  const handleSearch = (text) => {
    setSearchQuery(text);
    if (text.trim().length > 2) {
      // Sauvegarder la recherche si elle a au moins 3 caractères
      saveSearchToHistory(text);
    }
  };
  
  const navigateToProperty = useCallback((property) => {
    // Ajouter la propriété aux propriétés consultées
    addToViewedProperties(property.id);
    
    // Sauvegarder la position actuelle uniquement si elle est significative
    const currentPosition = scrollPosition.current;
    let positionToSave = 0;
    
    if (currentPosition > 5) {
      positionToSave = currentPosition;
      console.log(`[NAVIGATE] Sauvegarde position: ${positionToSave}`);
      AsyncStorage.setItem(SCROLL_POSITION_STORAGE_KEY, String(positionToSave))
        .catch(err => console.log('[STORAGE] Erreur lors de la sauvegarde de la position:', err));
    } else {
      // Si au début de la liste, réinitialiser la position sauvegardée
      console.log('[NAVIGATE] Au début de la liste, réinitialisation de la position');
      AsyncStorage.setItem(SCROLL_POSITION_STORAGE_KEY, '0')
        .catch(err => console.log('[STORAGE] Erreur réinitialisation:', err));
    }
    
    navigation.navigate('PropertyDetails', {
      propertyId: property.id,
      property,
      previousScrollPosition: positionToSave,
      viewedProperties: viewedProperties // Passer les propriétés déjà vues pour afficher le badge
    });
  }, [navigation, scrollPosition, viewedProperties, addToViewedProperties]);

  const resetFilters = () => {
    setSelectedType('');
    setMinPrice('');
    setMaxPrice('');
    setSelectedCity('');
    setFilterModalVisible(false);
  };

  const applyFilters = () => {
    let filtered = [...properties];

    // Filtre par type de propriété
    if (selectedType) {
      filtered = filtered.filter(property => property.type === selectedType);
    }

    // Filtre par prix minimum
    if (minPrice) {
      const minPriceNum = parseFloat(minPrice);
      filtered = filtered.filter(property => property.price >= minPriceNum);
    }

    // Filtre par prix maximum
    if (maxPrice) {
      const maxPriceNum = parseFloat(maxPrice);
      filtered = filtered.filter(property => property.price <= maxPriceNum);
    }

    // Filtre par ville
    if (selectedCity) {
      filtered = filtered.filter(property => 
        property.city.toLowerCase().includes(selectedCity.toLowerCase())
      );
    }

    setFilteredProperties(filtered);
  };

  useEffect(() => {
    applyFilters();
  }, [selectedType, minPrice, maxPrice, selectedCity]);

  // Fonction pour gérer le défilement de la liste
  const handleScroll = useCallback((event) => {
    if (!event || !event.nativeEvent || isRestoringScroll.current) return;
    
    const position = event.nativeEvent.contentOffset.y;
    if (position >= 0) {
      scrollPosition.current = position;
      
      // Éviter de sauvegarder trop souvent - seulement si la position a changé significativement
      if (Math.abs(position - lastSavedPosition.current) > 50) {
        lastSavedPosition.current = position;
        
        // Sauvegarde dans AsyncStorage pour les positions significatives
        if (position > 10) {
          console.log(`[SCROLL] Sauvegarde position: ${position}`);
          AsyncStorage.setItem(SCROLL_POSITION_STORAGE_KEY, String(position))
            .catch(err => console.log('[STORAGE] Erreur lors de la sauvegarde de la position:', err));
        }
      }
    }
  }, []);

  // Restaurer la position de défilement lorsque l'écran reçoit le focus
  useFocusEffect(
    useCallback(() => {
      console.log('[FOCUS] Écran Home actif');
      
      // Forcer le rechargement des propriétés si elles sont vides
      if (properties.length === 0 && !isLoading) {
        console.log('[FOCUS] Aucune propriété chargée, démarrage du chargement');
        fetchProperties();
        return;
      }
      
      // Vérifier si les propriétés sont chargées
      if (isLoading) {
        console.log('[FOCUS] Attente du chargement des données avant restauration');
        return;
      }

      // Récupérer la position sauvegardée depuis AsyncStorage
      AsyncStorage.getItem(SCROLL_POSITION_STORAGE_KEY)
        .then(savedPosition => {
          if (savedPosition) {
            const positionToRestore = parseFloat(savedPosition);
            
            // Ne pas restaurer si la position est très petite (début de liste)
            if (positionToRestore < 5) {
              console.log('[FOCUS] Position trop petite, pas de restauration nécessaire');
              return;
            }
            
            // Ne restaurer que si la position est significative
            if (positionToRestore > 10 && scrollViewRef.current) {
              console.log(`[FOCUS] Restauration de la position à ${positionToRestore}`);
              
              // Marquer que nous sommes en train de restaurer pour éviter les sauvegardes pendant la restauration
              isRestoringScroll.current = true;
              
              // Utiliser un timeout pour s'assurer que le rendu est terminé
              setTimeout(() => {
                if (scrollViewRef.current) {
                  scrollViewRef.current.scrollToOffset({
                    offset: positionToRestore,
                    animated: false
                  });
                  console.log(`[FOCUS] Position restaurée à ${positionToRestore}`);
                  
                  // Réinitialiser le flag après un court délai pour permettre au scroll de se stabiliser
                  setTimeout(() => {
                    isRestoringScroll.current = false;
                  }, 500);
                }
              }, 300);
            } else {
              console.log('[FOCUS] Pas de position significative à restaurer');
            }
          } else {
            console.log('[FOCUS] Pas de position sauvegardée à restaurer');
          }
        })
        .catch(error => {
          console.log('[FOCUS] Erreur lors de la récupération de la position:', error);
        });

      return () => {
        // Sauvegarder la position au moment où l'écran perd le focus
        if (scrollPosition.current > 10) {
          AsyncStorage.setItem(SCROLL_POSITION_STORAGE_KEY, String(scrollPosition.current))
            .then(() => console.log(`[UNFOCUS] Position sauvegardée: ${scrollPosition.current}`))
            .catch(error => console.log(`[UNFOCUS] Erreur sauvegarde position: ${error}`));
        }
      };
    }, [properties.length, isLoading, fetchProperties])
  );

  // Fonction pour rafraîchir les données
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    console.log('[REFRESH] Début du rafraîchissement');
    
    // Réinitialiser la recherche, les filtres, etc.
    setSearchQuery('');
    setFilteredProperties([]);
    
    // Rafraîchir les données
    fetchProperties().then(() => {
      console.log('[REFRESH] Rafraîchissement terminé');
      setRefreshing(false);
      
      // Remonter au début de la liste
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToOffset({ offset: 0, animated: true });
        scrollPosition.current = 0;
        
        // Réinitialiser la position dans AsyncStorage
        AsyncStorage.setItem(SCROLL_POSITION_STORAGE_KEY, '0')
          .catch(error => console.log('[REFRESH] Erreur réinitialisation:', error));
      }
    }).catch(error => {
      console.log('[REFRESH] Erreur:', error);
      setRefreshing(false);
    });
  }, [fetchProperties]);

  // Précharger les images des propriétés
  const preloadPropertyImages = async (properties) => {
    console.log('[PRELOAD_IMAGES_DEBUG] Début de preloadPropertyImages avec', properties.length, 'propriétés');
    const imagePromises = properties
      .filter(property => property.images && property.images.length > 0)
      .map(async (property) => {
        const imagePath = property.images[0];
        const fileName = imagePath.split('/').pop();
        
        if (!propertyImageCache.has(property.id)) {
          try {
            console.log(`[PRELOAD_IMAGES_DEBUG] Préchargement de l'image pour la propriété ${property.id}`);
            const imageUrl = await getImageUrl(fileName);
            propertyImageCache.set(property.id, imageUrl);
          } catch (error) {
            console.error(`[PRELOAD_IMAGES_DEBUG] Erreur de préchargement pour la propriété: ${property.id}`, error);
            propertyImageCache.set(property.id, 'https://via.placeholder.com/400x300/CCCCCC/666666?text=Erreur+de+chargement');
          }
        } else {
          console.log(`[PRELOAD_IMAGES_DEBUG] Image déjà en cache pour la propriété ${property.id}`);
        }
      });

    try {
      await Promise.all(imagePromises);
      console.log('[PRELOAD_IMAGES_DEBUG] Toutes les images ont été préchargées');
    } catch (error) {
      console.error('[PRELOAD_IMAGES_DEBUG] Erreur durant Promise.all:', error);
    }
  };

  // Appliquer les filtres et la recherche aux propriétés
  useEffect(() => {
    if (!properties || properties.length === 0) {
      setFilteredProperties([]);
      return;
    }

    let result = [...properties];

    // Filtrer par texte de recherche
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(property => 
        property.title?.toLowerCase().includes(query) || 
        property.description?.toLowerCase().includes(query) || 
        property.city?.toLowerCase().includes(query) || 
        property.type?.toLowerCase().includes(query)
      );
    }

    // Filtrer par type de bien
    if (selectedType) {
      result = result.filter(property => property.type === selectedType);
    }

    // Filtrer par ville
    if (selectedCity) {
      result = result.filter(property => property.city === selectedCity);
    }

    // Filtrer par prix minimum
    if (minPrice && !isNaN(parseInt(minPrice))) {
      const min = parseInt(minPrice);
      result = result.filter(property => property.price >= min);
    }

    // Filtrer par prix maximum
    if (maxPrice && !isNaN(parseInt(maxPrice))) {
      const max = parseInt(maxPrice);
      result = result.filter(property => property.price <= max);
    }

    // Limiter le nombre de propriétés à afficher si nécessaire pour éviter les problèmes de performance
    setFilteredProperties(result);
    
    // Remonter au début de la liste après une recherche
    if (searchQuery.trim() !== '' && scrollViewRef.current) {
      scrollViewRef.current.scrollToOffset({ offset: 0, animated: true });
    }
  }, [properties, searchQuery, selectedType, selectedCity, minPrice, maxPrice]);

  const styles = useThemedStyles((colors) => ({
    ...commonStyles(colors),
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      backgroundColor: colors.card,
      margin: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      marginLeft: 10,
      color: colors.text,
    },
    filterButton: {
      padding: 8,
    },
    row: {
      justifyContent: 'space-between',
      paddingHorizontal: 8,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      minHeight: '50%',
      backgroundColor: colors.card,
    },
    filterModal: {
      padding: 20,
    },
    filterContent: {
      flexGrow: 1,
      paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    },
    filterHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    filterTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 5,
    },
    filterSection: {
      padding: 15,
    },
    filterSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 10,
      marginTop: 5,
      color: colors.text,
    },
    typeContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 15,
    },
    typeButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    typeButtonText: {
      fontSize: 14,
      color: colors.text,
    },
    typeButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    typeButtonTextSelected: {
      color: '#fff',
    },
    priceInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
      gap: 8,
    },
    priceInput: {
      flex: 1,
      height: 40,
      borderRadius: 8,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    priceSeparator: {
      fontSize: 20,
      fontWeight: '500',
      color: colors.text,
    },
    cityInput: {
      height: 40,
      borderRadius: 8,
      paddingHorizontal: 10,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
    },
    filterButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
      paddingTop: 5,
      paddingBottom: Platform.OS === 'ios' ? 20 : 5,
    },
    resetButton: {
      flex: 1,
      padding: 15,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    applyButton: {
      flex: 1,
      padding: 15,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    resetButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '500',
    },
    applyButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '500',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    propertiesContainer: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      padding: 8,
    },
    cardWrapper: {
      width: '48%',
      margin: '1%',
      height: 'auto',
    },
    flatListContainer: {
      padding: 8,
      paddingBottom: 80,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: 25,
      paddingBottom: 30,
    },
    listContainer: {
      padding: 2,
      gap: 0, 
    },
    regionContainer: {
      marginBottom: 15,
    },
    regionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
      marginLeft: 5,
    },
    propertyCard: {
      width: '48%',
      marginBottom: -85, 
    },
    container: {
      flex: 1,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 100,
      padding: 20,
      backgroundColor: colors.background,
    },
    emptyText: {
      fontSize: 18,
      marginTop: 16,
      marginBottom: 16,
      textAlign: 'center',
    },
    refreshButton: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      marginTop: 16,
    },
    refreshButtonText: {
      fontSize: 16,
      fontWeight: '500',
    },
    webScrollContainer: {
      padding: 20,
      minHeight: '100%',
    },
    webGrid: {
      display: Platform.OS === 'web' ? 'grid' : 'flex',
      gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
      gap: 20,
      maxWidth: 1200,
      margin: '0 auto',
    },
    webCardContainer: {
      marginBottom: Platform.OS === 'web' ? 0 : 10,
    },
  }));

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.webScrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.webGrid}>
            {filteredProperties.map((item) => (
              <View key={item.id} style={styles.webCardContainer}>
                <PropertyCard
                  property={item}
                  onPress={() => navigateToProperty(item)}
                  onFavoritePress={(e) => {
                    // Empêcher la navigation vers la page de détails
                    if (Platform.OS === 'web' && e) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                    toggleFavorite(item.id);
                  }}
                  isFavorite={favorites.includes(item.id)}
                  isUserProperty={item.user_id === currentUser?.id}
                  isViewed={viewedProperties.includes(item.id)}
                  viewCount={item.view_count}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <ThemeWrapper style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={styles.searchContainer}>
            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.card, color: colors.text }]}
              placeholder="Rechercher une propriété..."
              placeholderTextColor={colors.text}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setFilterModalVisible(true)}
            >
              <MaterialIcons name="filter-list" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ color: colors.text, marginTop: 10 }}>
                Chargement des propriétés... {properties.length > 0 ? `(${properties.length} déjà chargées)` : ''}
              </Text>
            </View>
          ) : filteredProperties.length > 0 ? (
            <FlatList
              ref={scrollViewRef}
              data={filteredProperties}
              numColumns={2}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={[styles.cardWrapper, { marginBottom: 16 }]}>
                  <PropertyCard
                    property={item}
                    onPress={() => navigateToProperty(item)}
                    onFavoritePress={(e) => {
                      // Empêcher la navigation vers la page de détails
                      if (Platform.OS === 'web' && e) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                      toggleFavorite(item.id);
                    }}
                    isFavorite={favorites.includes(item.id)}
                    isUserProperty={item.user_id === currentUser?.id}
                    isViewed={viewedProperties.includes(item.id)}
                    viewCount={item.view_count}
                  />
                </View>
              )}
              contentContainerStyle={{ padding: 8, paddingBottom: 200 }}
              style={{ flex: 1, backgroundColor: colors.background }}
              showsVerticalScrollIndicator={true}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colors.primary]}
                />
              }
              onScroll={handleScroll}
              scrollEventThrottle={16}
            />
          ) : (
            <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
              <Text style={[styles.emptyText, { color: colors.text }]}>
                Aucune propriété trouvée
              </Text>
            </View>
          )}

          {/* Modal des filtres */}
          <Modal
            visible={filterModalVisible}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setFilterModalVisible(false)}
          >
            <TouchableOpacity 
              style={styles.modalOverlay} 
              activeOpacity={1} 
              onPress={() => setFilterModalVisible(false)}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ width: '100%' }}
                keyboardVerticalOffset={20}
              >
                <View style={styles.modalContainer}>
                  <ScrollView 
                    style={styles.filterModal}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.filterContent}
                    bounces={false}
                  >
                    <View style={styles.filterHeader}>
                      <Text style={[styles.filterTitle, { color: colors.text }]}>Filtres</Text>
                      <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                        <MaterialIcons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    {/* Type de propriété */}
                    <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Type de propriété</Text>
                    <View style={styles.typeContainer}>
                      {['Maison', 'Appartement', 'Bureau', 'Terrain'].map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.typeButton,
                            selectedType === type && { backgroundColor: colors.primary }
                          ]}
                          onPress={() => setSelectedType(selectedType === type ? '' : type)}
                        >
                          <Text
                            style={[
                              styles.typeButtonText,
                              { color: selectedType === type ? '#fff' : colors.text }
                            ]}
                          >
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Prix */}
                    <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Prix (FCFA)</Text>
                    <View style={styles.priceInputContainer}>
                      <TextInput
                        style={[styles.priceInput, { backgroundColor: colors.background, color: colors.text }]}
                        placeholder="Prix min"
                        placeholderTextColor={colors.text}
                        value={minPrice}
                        onChangeText={setMinPrice}
                        keyboardType="numeric"
                      />
                      <Text style={[styles.priceSeparator, { color: colors.text }]}>-</Text>
                      <TextInput
                        style={[styles.priceInput, { backgroundColor: colors.background, color: colors.text }]}
                        placeholder="Prix max"
                        placeholderTextColor={colors.text}
                        value={maxPrice}
                        onChangeText={setMaxPrice}
                        keyboardType="numeric"
                      />
                    </View>

                    {/* Ville */}
                    <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Ville</Text>
                    <TextInput
                      style={[styles.cityInput, { backgroundColor: colors.background, color: colors.text }]}
                      placeholder="Sélectionner une ville"
                      placeholderTextColor={colors.text}
                      value={selectedCity}
                      onChangeText={setSelectedCity}
                    />

                    {/* Boutons */}
                    <View style={styles.filterButtons}>
                      <TouchableOpacity
                        style={styles.resetButton}
                        onPress={() => {
                          setSelectedType('');
                          setMinPrice('');
                          setMaxPrice('');
                          setSelectedCity('');
                        }}
                      >
                        <Text style={styles.resetButtonText}>Réinitialiser</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.applyButton}
                        onPress={() => {
                          applyFilters();
                          setFilterModalVisible(false);
                        }}
                      >
                        <Text style={styles.applyButtonText}>Appliquer</Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </KeyboardAvoidingView>
            </TouchableOpacity>
          </Modal>
        </View>
      </ThemeWrapper>
    );
  }

  return (
    <ThemeWrapper style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.container, { flex: 1, backgroundColor: colors.background }]}>
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.card, color: colors.text }]}
            placeholder="Rechercher une propriété..."
            placeholderTextColor={colors.text}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <MaterialIcons name="filter-list" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.text, marginTop: 10 }}>
              Chargement des propriétés... {properties.length > 0 ? `(${properties.length} déjà chargées)` : ''}
            </Text>
          </View>
        ) : filteredProperties.length > 0 ? (
          <FlatList
            ref={scrollViewRef}
            data={filteredProperties}
            numColumns={2}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <View style={[styles.cardWrapper, Platform.OS === 'android' ? { marginBottom: 16 } : {}]}>
                <PropertyCard
                  property={item}
                  onPress={() => navigateToProperty(item)}
                  onFavoritePress={(e) => {
                    // Empêcher la navigation vers la page de détails
                    if (Platform.OS === 'web' && e) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                    toggleFavorite(item.id);
                  }}
                  isFavorite={favorites.includes(item.id)}
                  isUserProperty={item.user_id === currentUser?.id}
                  isViewed={viewedProperties.includes(item.id)}
                  viewCount={item.view_count}
                />
              </View>
            )}
            contentContainerStyle={[
              styles.flatListContainer, 
              Platform.OS === 'android' ? { paddingBottom: 200, flexGrow: 1 } : {}
            ]}
            style={{ flex: 1, backgroundColor: colors.background }}
            showsVerticalScrollIndicator={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
              />
            }
            onScroll={handleScroll}
            scrollEventThrottle={16}
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 10
            }}
          />
        ) : (
          <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Aucune propriété trouvée
            </Text>
          </View>
        )}

        {/* Modal des filtres */}
        <Modal
          visible={filterModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setFilterModalVisible(false)}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ width: '100%' }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
              <View style={styles.modalContainer}>
                <ScrollView 
                  style={styles.filterModal}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.filterContent}
                  bounces={false}
                >
                  <View style={styles.filterHeader}>
                    <Text style={[styles.filterTitle, { color: colors.text }]}>Filtres</Text>
                    <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                      <MaterialIcons name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  {/* Type de propriété */}
                  <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Type de propriété</Text>
                  <View style={styles.typeContainer}>
                    {['Maison', 'Appartement', 'Bureau', 'Terrain'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeButton,
                          selectedType === type && { backgroundColor: colors.primary }
                        ]}
                        onPress={() => setSelectedType(selectedType === type ? '' : type)}
                      >
                        <Text
                          style={[
                            styles.typeButtonText,
                            { color: selectedType === type ? '#fff' : colors.text }
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Prix */}
                  <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Prix (FCFA)</Text>
                  <View style={styles.priceInputContainer}>
                    <TextInput
                      style={[styles.priceInput, { backgroundColor: colors.background, color: colors.text }]}
                      placeholder="Prix min"
                      placeholderTextColor={colors.text}
                      value={minPrice}
                      onChangeText={setMinPrice}
                      keyboardType="numeric"
                    />
                    <Text style={[styles.priceSeparator, { color: colors.text }]}>-</Text>
                    <TextInput
                      style={[styles.priceInput, { backgroundColor: colors.background, color: colors.text }]}
                      placeholder="Prix max"
                      placeholderTextColor={colors.text}
                      value={maxPrice}
                      onChangeText={setMaxPrice}
                      keyboardType="numeric"
                    />
                  </View>

                  {/* Ville */}
                  <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Ville</Text>
                  <TextInput
                    style={[styles.cityInput, { backgroundColor: colors.background, color: colors.text }]}
                    placeholder="Sélectionner une ville"
                    placeholderTextColor={colors.text}
                    value={selectedCity}
                    onChangeText={setSelectedCity}
                  />

                  {/* Boutons */}
                  <View style={styles.filterButtons}>
                    <TouchableOpacity
                      style={styles.resetButton}
                      onPress={() => {
                        setSelectedType('');
                        setMinPrice('');
                        setMaxPrice('');
                        setSelectedCity('');
                      }}
                    >
                      <Text style={styles.resetButtonText}>Réinitialiser</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.applyButton}
                      onPress={() => {
                        applyFilters();
                        setFilterModalVisible(false);
                      }}
                    >
                      <Text style={styles.applyButtonText}>Appliquer</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      </View>
    </ThemeWrapper>
  );
};

export default HomeScreen;
