import React, { useState, useEffect } from 'react';
import { 
  ScrollView, 
  View, 
  StyleSheet, 
  Dimensions, 
  ActivityIndicator, 
  TouchableOpacity, 
  Image, 
  BackHandler, 
  Share, 
  Platform,
  Modal,
  StatusBar,
  Pressable,
  Alert
} from 'react-native';
import { Text, Card } from 'react-native-elements';
import { Linking } from 'react-native';
import { supabase } from '../config/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import * as NavigationService from '../navigation/NavigationService';
import { CommonActions } from '@react-navigation/native';
import EventRegister from '../services/EventRegister'; // Import EventRegister

const PropertyDetailsScreen = ({ route, navigation }) => {
  const { propertyId, scrollPosition, viewedProperties } = route.params;
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    // Gestion du bouton retour
    const handleBackNavigation = () => {
      console.log('[PropertyDetailsScreen] Retour vers Home');
      navigation.navigate('Home', { 
        restoreScroll: true,
        scrollPosition: scrollPosition || 0
      });
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('[PropertyDetailsScreen] Bouton retour physique pressé');
      handleBackNavigation();
      return true;
    });

    console.log('[PropertyDetailsScreen] BackHandler configuré');

    navigation.setOptions({
      headerStyle: {
        backgroundColor: colors.card,
      },
      headerTintColor: colors.text,
      // Sur Android, nous ne définissons pas de headerLeft pour retirer complètement le bouton visuel
      // Sur iOS et web, nous utilisons un bouton personnalisé
      ...(Platform.OS !== 'android' && {
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => {
              console.log('[PropertyDetailsScreen] Bouton retour visuel pressé');
              handleBackNavigation();
            }}
            style={{ 
              marginLeft: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8
            }}
          >
            <MaterialIcons 
              name="chevron-left" 
              size={28} 
              color={colors.text} 
              style={{
                marginLeft: -4
              }}
            />
            <Text style={{ 
              color: colors.text,
              fontSize: 17,
              fontWeight: '400'
            }}>Accueil</Text>
          </TouchableOpacity>
        ),
      }),
      // Pour Android, on désactive complètement le bouton de retour visuel
      ...(Platform.OS === 'android' && {
        headerLeft: () => null,
        headerBackVisible: false,
        headerTitleAlign: 'center',
        title: 'Détails du bien'
      }),
    });

    return () => backHandler.remove();
  }, [navigation, colors, scrollPosition]);

  useEffect(() => {
    const fetchProperty = async () => {
      if (!propertyId) {
        console.error('PropertyId is undefined');
        setLoading(false);
        navigation.goBack();
        return;
      }

      try {
        setLoading(true);
        console.log('[PROPERTY_DETAILS] Chargement de la propriété:', propertyId);

        const { data: { user } } = await supabase.auth.getUser();

        const { data: propertyData, error } = await supabase
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .single();

        if (error) throw error;

        if (!propertyData) {
          console.error('Propriété non trouvée');
          setLoading(false);
          navigation.goBack();
          return;
        }

        let ownerData = null;
        if (propertyData.user_id) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, phone, email')
            .eq('id', propertyData.user_id)
            .single();
          
          if (!profileError) {
            ownerData = profileData;
          } else {
            console.error('Erreur lors de la récupération du profil:', profileError);
          }
        }

        const propertyWithOwner = {
          ...propertyData,
          profiles: ownerData
        };

        const isOwner = user && propertyData.user_id === user.id;

        if (!isOwner) {
          const { error: viewError } = await supabase.rpc('increment_view_count', {
            property_id: propertyId
          });

          if (viewError) {
            console.error('Erreur lors de l\'incrémentation du compteur de vues:', viewError);
          }
        }

        setProperty(propertyWithOwner);
        setIsOwner(isOwner);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching property:', error);
        setLoading(false);
        Alert.alert(
          'Erreur',
          'Une erreur est survenue lors du chargement de la propriété'
        );
        navigation.goBack();
      }
    };

    fetchProperty();
  }, [propertyId, navigation]);

  useEffect(() => {
    const loadImage = async () => {
      if (property && property.images && property.images.length > 0) {
        try {
          if (property.images[0].startsWith('http')) {
            setImageUrl(property.images[0]);
            return;
          }

          const { data, error } = await supabase.storage
            .from('property-images')
            .createSignedUrl(property.images[0], 3600);

          if (error) {
            console.error('Erreur lors du chargement de l\'image:', error);
            setImageUrl('https://via.placeholder.com/400x300/CCCCCC/666666?text=Pas+d%27image');
            return;
          }

          if (data?.signedUrl) {
            setImageUrl(data.signedUrl);
          } else {
            setImageUrl('https://via.placeholder.com/400x300/CCCCCC/666666?text=Pas+d%27image');
          }
        } catch (error) {
          console.error('Erreur lors du chargement de l\'image:', error);
          setImageUrl('https://via.placeholder.com/400x300/CCCCCC/666666?text=Pas+d%27image');
        }
      } else {
        setImageUrl('https://via.placeholder.com/400x300/CCCCCC/666666?text=Pas+d%27image');
      }
    };

    loadImage();
  }, [property]);

  useEffect(() => {
    const checkFavoriteStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .rpc('is_property_favorite_v2', { 
            property_uuid: propertyId,
            user_uuid: user.id 
          });

        if (error) throw error;
        setIsFavorite(data);
      } catch (error) {
        console.error('Error checking favorite status:', error);
      }
    };

    checkFavoriteStatus();
  }, [propertyId]);

  useEffect(() => {
    // Écouter les changements de favoris depuis d'autres écrans
    const favoriteListener = EventRegister.addEventListener('favoriteToggled', (data) => {
      if (data.propertyId === propertyId) {
        setIsFavorite(data.isFavorite);
      }
    });

    return () => {
      // Se désabonner lors du démontage du composant
      EventRegister.removeEventListener(favoriteListener);
    };
  }, [propertyId]);

  const toggleFavorite = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.navigate('SignIn');
        return;
      }

      const { data, error } = await supabase
        .rpc('toggle_favorite_v2', { 
          property_uuid: propertyId,
          user_uuid: user.id 
        });

      if (error) throw error;

      setIsFavorite(data);
      
      // Émettre un événement pour synchroniser les autres écrans
      EventRegister.emit('favoriteToggled', { propertyId, isFavorite: data });
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Erreur', 'Impossible de modifier les favoris');
    }
  };

  const handleCall = (phone) => {
    if (!phone) {
      Alert.alert('Erreur', 'Numéro de téléphone non disponible');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const handleMessage = () => {
    if (property && property.profiles) {
      // Utiliser la navigation imbriquée pour accéder à l'écran Chat
      navigation.navigate('MainApp', {
        screen: 'Messages',
        params: {
          screen: 'Chat',
          params: {
            recipientId: property.user_id,
            recipientName: property.profiles.full_name,
            propertyId: property.id,
            propertyTitle: property.title,
            fromPropertyDetails: true
          }
        }
      });
    }
  };

  const handlePayment = () => {
    if (property && property.profiles) {
      navigation.navigate('Payment', {
        propertyId: property.id,
        sellerId: property.user_id,
        amount: property.price,
        transactionType: 'purchase'
      });
    }
  };

  const handleShare = async (property) => {
    try {
      const message = `${property.title}\n${property.price.toLocaleString('fr-FR')} FCFA\n${property.city}\n\nVoir plus de détails sur l'application Immobilier Mali`;
      await Share.share({
        message,
        title: property.title,
      });
    } catch (error) {
      console.error('Erreur lors du partage:', error);
    }
  };

  const handleReport = (propertyId) => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        Alert.alert('Connexion requise', 'Vous devez être connecté pour signaler une annonce');
        return;
      }
      
      navigation.navigate('SellerReview', {
        sellerId: property?.user_id,
        sellerName: property?.title,
        mode: 'report',
        property: property
      });
    }).catch(error => {
      console.error('Erreur lors de la vérification de l\'utilisateur:', error);
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
    });
  };

  const handleReview = async () => {
    navigation.navigate('SellerReview', {
      sellerId: property?.user_id,
      sellerName: property?.title,
      mode: 'reviews',
      property: property
    });
  };

  const handlePaymentNavigation = () => {
    console.log('Property data:', property);
    
    if (!property) {
      Alert.alert('Erreur', 'Informations manquantes pour procéder au paiement.');
      return;
    }

    const paymentInfo = {
      propertyId: property.id,
      sellerId: property.user_id,
      amount: property.price,
      transactionType: property.transaction_type === 'location' ? 'rent' : 'sale'
    };

    console.log('Payment info:', paymentInfo);

    if (!paymentInfo.propertyId) {
      console.log('Missing propertyId');
      Alert.alert('Erreur', 'ID de la propriété manquant.');
      return;
    }
    if (!paymentInfo.sellerId) {
      console.log('Missing sellerId');
      Alert.alert('Erreur', 'ID du vendeur manquant.');
      return;
    }
    if (!paymentInfo.amount) {
      console.log('Missing amount');
      Alert.alert('Erreur', 'Prix non défini.');
      return;
    }
    if (!paymentInfo.transactionType) {
      console.log('Missing transactionType');
      Alert.alert('Erreur', 'Type de transaction non défini.');
      return;
    }

    navigation.navigate('Payment', paymentInfo);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Modal pour afficher l'image en plein écran */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={imageModalVisible}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <StatusBar hidden={true} />
          <Pressable 
            style={styles.modalCloseButton} 
            onPress={() => setImageModalVisible(false)}
          >
            <MaterialIcons name="close" size={30} color="#fff" />
          </Pressable>
          <Pressable 
            style={styles.modalImageContainer}
            onPress={() => setImageModalVisible(false)}
          >
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : null}
          </Pressable>
        </View>
      </Modal>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : property ? (
        <View style={Platform.OS === 'web' ? styles.webContainer : { flex: 1 }}>
          <ScrollView 
            style={[styles.mainContainer, {paddingBottom: 100}]}
            contentContainerStyle={Platform.OS === 'web' ? styles.webContentContainer : null}
          >
            {Platform.OS === 'web' ? (
              // Layout en deux colonnes pour le web
              <View style={styles.webLayout}>
                {/* Colonne gauche - Image et actions */}
                <View style={styles.webLeftColumn}>
                  <View style={styles.imageContainer}>
                    {!isOwner && (
                      <TouchableOpacity
                        style={[styles.favoriteButton, { backgroundColor: colors.card }]}
                        onPress={toggleFavorite}
                        disabled={favoriteLoading}
                      >
                        <MaterialIcons
                          name={isFavorite ? "favorite" : "favorite-border"}
                          size={24}
                          color={isFavorite ? "#e74c3c" : colors.text}
                        />
                      </TouchableOpacity>
                    )}
                    {isOwner && property.view_count > 0 && (
                      <View style={[styles.viewBadge, { backgroundColor: colors.card }]}>
                        <MaterialIcons name="visibility" size={16} color={colors.text} />
                        <Text style={[styles.viewBadgeText, { color: colors.text }]}>
                          {property.view_count}
                        </Text>
                      </View>
                    )}
                    {isOwner && (
                      <View style={[styles.ownerBadge, { backgroundColor: colors.primary }]}>
                        <MaterialIcons name="verified" size={14} color="white" />
                        <Text style={styles.ownerBadgeText}>Mon annonce</Text>
                      </View>
                    )}
                    {viewedProperties && viewedProperties.includes(property.id) && (
                      <View style={styles.viewedBadge}>
                        <Text style={styles.viewedBadgeText}>Déjà vu</Text>
                      </View>
                    )}
                    {imageUrl ? (
                      <TouchableOpacity onPress={() => setImageModalVisible(true)}>
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.propertyImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.noImageContainer, { backgroundColor: colors.card }]}>
                        <MaterialIcons name="image-not-supported" size={48} color={colors.text} />
                        <Text style={[styles.noImageText, { color: colors.text }]}>
                          Aucune image disponible
                        </Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Informations du propriétaire - uniquement sur le web */}
                  {property.profiles && (
                    <View style={[styles.webOwnerCard, { backgroundColor: colors.card }]}>
                      <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 15 }]}>
                        Propriétaire
                      </Text>
                      <View style={styles.webOwnerInfo}>
                        <View style={styles.webOwnerImageContainer}>
                          <Image 
                            source={{ 
                              uri: property.profiles.avatar_url || 'https://via.placeholder.com/60'
                            }} 
                            style={styles.webOwnerImage} 
                          />
                        </View>
                        <View style={styles.webOwnerDetails}>
                          <Text style={[styles.webOwnerName, { color: colors.text }]}>
                            {property.profiles.full_name || 'Propriétaire'}
                          </Text>
                          <Text style={[styles.webOwnerPhone, { color: colors.text }]}>
                            {property.profiles.phone || 'Numéro non disponible'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
                
                {/* Colonne droite - Détails de la propriété */}
                <View style={styles.webRightColumn}>
                  <View style={styles.detailsContainer}>
                    <Text style={[styles.propertyTitle, { color: colors.text }]}>
                      {property.title}
                    </Text>
                    <Text style={[styles.propertyPrice, { color: colors.primary }]}>
                      {property.price.toLocaleString('fr-FR')} FCFA
                      {property.transaction_type === 'location' ? ' /mois' : ''}
                    </Text>
                    <Text style={[styles.propertyLocation, { color: colors.text }]}>
                      {property.city}
                    </Text>

                    <View style={[styles.separator, { backgroundColor: colors.border }]} />

                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Description
                    </Text>
                    <Text style={[styles.description, { color: colors.text }]}>
                      {property.description}
                    </Text>

                    <View style={[styles.separator, { backgroundColor: colors.border }]} />

                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      Caractéristiques
                    </Text>
                    <View style={[styles.featuresContainer, { backgroundColor: colors.card }]}>
                      <View style={[styles.featureItem, { backgroundColor: colors.background }]}>
                        <MaterialIcons name="home" size={24} color={colors.primary} />
                        <Text style={[styles.featureText, { color: colors.text }]}>
                          {property.type}
                        </Text>
                      </View>
                      <View style={[styles.featureItem, { backgroundColor: colors.background }]}>
                        <MaterialIcons name="straighten" size={24} color={colors.primary} />
                        <Text style={[styles.featureText, { color: colors.text }]}>
                          {property.surface} m²
                        </Text>
                      </View>
                      {property.rooms && (
                        <View style={[styles.featureItem, { backgroundColor: colors.background }]}>
                          <MaterialIcons name="king-bed" size={24} color={colors.primary} />
                          <Text style={[styles.featureText, { color: colors.text }]}>
                            {property.rooms} {property.rooms > 1 ? 'chambres' : 'chambre'}
                          </Text>
                        </View>
                      )}
                      {property.bathrooms && (
                        <View style={[styles.featureItem, { backgroundColor: colors.background }]}>
                          <MaterialIcons name="bathtub" size={24} color={colors.primary} />
                          <Text style={[styles.featureText, { color: colors.text }]}>
                            {property.bathrooms} {property.bathrooms > 1 ? 'salles de bain' : 'salle de bain'}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              // Layout mobile standard
              <>
                <View style={styles.imageContainer}>
                  {!isOwner && (
                    <TouchableOpacity
                      style={[styles.favoriteButton, { backgroundColor: colors.card }]}
                      onPress={toggleFavorite}
                      disabled={favoriteLoading}
                    >
                      <MaterialIcons
                        name={isFavorite ? "favorite" : "favorite-border"}
                        size={24}
                        color={isFavorite ? "#e74c3c" : colors.text}
                      />
                    </TouchableOpacity>
                  )}
                  {isOwner && property.view_count > 0 && (
                    <View style={[styles.viewBadge, { backgroundColor: colors.card }]}>
                      <MaterialIcons name="visibility" size={16} color={colors.text} />
                      <Text style={[styles.viewBadgeText, { color: colors.text }]}>
                        {property.view_count}
                      </Text>
                    </View>
                  )}
                  {isOwner && (
                    <View style={[styles.ownerBadge, { backgroundColor: colors.primary }]}>
                      <MaterialIcons name="verified" size={14} color="white" />
                      <Text style={styles.ownerBadgeText}>Mon annonce</Text>
                    </View>
                  )}
                  {viewedProperties && viewedProperties.includes(property.id) && (
                    <View style={styles.viewedBadge}>
                      <Text style={styles.viewedBadgeText}>Déjà vu</Text>
                    </View>
                  )}
                  {imageUrl ? (
                    <TouchableOpacity onPress={() => setImageModalVisible(true)}>
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.propertyImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.noImageContainer, { backgroundColor: colors.card }]}>
                      <MaterialIcons name="image-not-supported" size={48} color={colors.text} />
                      <Text style={[styles.noImageText, { color: colors.text }]}>
                        Aucune image disponible
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailsContainer}>
                  <Text style={[styles.propertyTitle, { color: colors.text }]}>
                    {property.title}
                  </Text>
                  <Text style={[styles.propertyPrice, { color: colors.primary }]}>
                    {property.price.toLocaleString('fr-FR')} FCFA
                    {property.transaction_type === 'location' ? ' /mois' : ''}
                  </Text>
                  <Text style={[styles.propertyLocation, { color: colors.text }]}>
                    {property.city}
                  </Text>

                  <View style={[styles.separator, { backgroundColor: colors.border }]} />

                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Description
                  </Text>
                  <Text style={[styles.description, { color: colors.text }]}>
                    {property.description}
                  </Text>

                  <View style={[styles.separator, { backgroundColor: colors.border }]} />

                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    Caractéristiques
                  </Text>
                  <View style={[styles.featuresContainer, { backgroundColor: colors.card }]}>
                    <View style={[styles.featureItem, { backgroundColor: colors.background }]}>
                      <MaterialIcons name="home" size={24} color={colors.primary} />
                      <Text style={[styles.featureText, { color: colors.text }]}>
                        {property.type}
                      </Text>
                    </View>
                    <View style={[styles.featureItem, { backgroundColor: colors.background }]}>
                      <MaterialIcons name="straighten" size={24} color={colors.primary} />
                      <Text style={[styles.featureText, { color: colors.text }]}>
                        {property.surface} m²
                      </Text>
                    </View>
                    {property.rooms && (
                      <View style={[styles.featureItem, { backgroundColor: colors.background }]}>
                        <MaterialIcons name="king-bed" size={24} color={colors.primary} />
                        <Text style={[styles.featureText, { color: colors.text }]}>
                          {property.rooms} {property.rooms > 1 ? 'chambres' : 'chambre'}
                        </Text>
                      </View>
                    )}
                    {property.bathrooms && (
                      <View style={[styles.featureItem, { backgroundColor: colors.background }]}>
                        <MaterialIcons name="bathtub" size={24} color={colors.primary} />
                        <Text style={[styles.featureText, { color: colors.text }]}>
                          {property.bathrooms} {property.bathrooms > 1 ? 'salles de bain' : 'salle de bain'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      ) : null}

      {property && !isOwner && (
        <View style={[
          styles.bottomBar, 
          { 
            backgroundColor: colors.card, 
            bottom: 20,
            width: Platform.OS === 'web' ? 'auto' : '95%',
            alignSelf: 'center'
          }
        ]}>
          <TouchableOpacity
            style={styles.bottomBarButton}
            onPress={() => handleCall(property.profiles.phone)}
          >
            <MaterialIcons name="phone" size={24} color={colors.primary} />
            <Text style={[styles.bottomBarText, { color: colors.text }]}>Appeler</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomBarButton}
            onPress={() => handleMessage()}
          >
            <MaterialIcons name="message" size={24} color={colors.primary} />
            <Text style={[styles.bottomBarText, { color: colors.text }]}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomBarButton}
            onPress={() => handleShare(property)}
          >
            <MaterialIcons name="share" size={24} color={colors.primary} />
            <Text style={[styles.bottomBarText, { color: colors.text }]}>Partager</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomBarButton}
            onPress={() => handlePayment()}
          >
            <MaterialIcons name="payment" size={24} color={colors.primary} />
            <Text style={[styles.bottomBarText, { color: colors.text }]}>Payer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bottomBarButton}
            onPress={() => handleReport(property.id)}
          >
            <MaterialIcons name="flag" size={24} color={colors.primary} />
            <Text style={[styles.bottomBarText, { color: colors.text }]}>Signaler</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    paddingBottom: 100, 
  },
  contentContainer: {
    padding: 15,
  },
  characteristicsContainer: {
    marginTop: 15,
  },
  characteristicRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  characteristicItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    marginHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
  },
  characteristicText: {
    marginLeft: 10,
    fontSize: 14,
  },
  spacer: {
    height: 100, 
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingBottom: 20,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    marginBottom: 10,
    marginHorizontal: '20%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    bottom: 20
  },
  bottomBarButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 15,
  },
  bottomBarText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 250,
    marginBottom: 15,
  },
  favoriteButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: '#000000',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  viewBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    backgroundColor: '#000000',
    padding: 6,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  viewBadgeText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 4,
  },
  ownerBadge: {
    position: 'absolute',
    right: 10,
    top: 10,
    padding: 6,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  ownerBadgeText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 4,
  },
  viewedBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 2,
  },
  viewedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  propertyImage: {
    width: '100%',
    height: 250,
    borderRadius: 8,
  },
  noImageContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  detailsContainer: {
    padding: 15,
  },
  propertyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  propertyPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  propertyLocation: {
    fontSize: 16,
    marginBottom: 16,
    opacity: 0.8,
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
  },
  featureItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    minWidth: '45%',
    gap: 10,
  },
  featureText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  webContainer: {
    flex: 1,
    flexDirection: 'column',
    padding: 20,
  },
  webContentContainer: {
    paddingVertical: 20,
  },
  webLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  webLeftColumn: {
    flex: 1,
    marginRight: 20,
  },
  webRightColumn: {
    flex: 2,
  },
  webOwnerCard: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  webOwnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webOwnerImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginRight: 15,
  },
  webOwnerImage: {
    width: '100%',
    height: '100%',
  },
  webOwnerDetails: {
    flex: 1,
  },
  webOwnerName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  webOwnerPhone: {
    fontSize: 14,
    color: '#666',
  },
  modalContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
  },
  modalImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});

export default PropertyDetailsScreen;
