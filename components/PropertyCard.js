import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getImageUrl } from '../utils/images';

const PropertyCard = React.memo(({ 
  property, 
  onPress, 
  onFavoritePress,
  isFavorite,
  isUserProperty = false,
  isViewed = false,
  viewCount = 0,
  showFavoriteButton = true
}) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isMounted = useRef(true);
  const { colors } = useTheme();

  // Utiliser un ID unique pour chaque carte pour éviter les problèmes de rendu
  const cardId = useRef(`property-${property.id}`).current;

  // Log pour le debug du badge "Déjà vu"
  useEffect(() => {
    console.log(`[PROPERTY_CARD] Rendu de la carte ${property.id} - Vue: ${isViewed}, Favori: ${isFavorite}, Propriétaire: ${isUserProperty}`);
    
    return () => {
      console.log(`[PROPERTY_CARD] Démontage de la carte ${property.id}`);
    };
  }, [property.id, isViewed, isFavorite, isUserProperty]);

  useEffect(() => {
    loadImage();
    return () => {
      isMounted.current = false;
    };
  }, [property.images]);

  const loadImage = async () => {
    try {
      if (!property.images || property.images.length === 0) {
        setImageError(true);
        setIsLoading(false);
        return;
      }

      // Si l'URL est déjà une URL complète, on l'utilise directement
      if (property.images[0].startsWith('http')) {
        setImageUrl(property.images[0]);
        setIsLoading(false);
        return;
      }

      const url = await getImageUrl(property.images[0]);
      if (isMounted.current) {
        if (url) {
          setImageUrl(url);
          setIsLoading(false);
        } else {
          setImageError(true);
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Erreur de chargement de l\'image:', error);
      if (isMounted.current) {
        setImageError(true);
        setIsLoading(false);
      }
    }
  };

  return (
    <TouchableOpacity 
      style={{
        borderRadius: 8,
        borderWidth: 1,
        overflow: 'hidden',
        backgroundColor: colors.card,
        borderColor: colors.border,
        width: '100%',
        height: 'auto',
        marginBottom: 0,
        transform: Platform.OS === 'web' && isHovered ? [{ translateY: -5 }] : [],
        boxShadow: Platform.OS === 'web' && isHovered ? '0 8px 16px rgba(0, 0, 0, 0.2)' : 'none',
        transition: Platform.OS === 'web' ? 'transform 0.3s ease, box-shadow 0.3s ease' : 'none',
      }} 
      onPress={onPress}
      onMouseEnter={Platform.OS === 'web' ? () => setIsHovered(true) : undefined}
      onMouseLeave={Platform.OS === 'web' ? () => setIsHovered(false) : undefined}
    >
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : imageError ? (
        <View style={[styles.loadingContainer, { backgroundColor: colors.card }]}>
          <MaterialIcons name="broken-image" size={40} color={colors.text} />
        </View>
      ) : (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
          
          {/* Badge "Déjà vu" */}
          {isViewed && (
            <View style={styles.viewedBadge}>
              <Text style={styles.viewedBadgeText}>Déjà vu</Text>
            </View>
          )}

          {/* Badge compteur de vues - visible uniquement pour le propriétaire */}
          {isUserProperty && viewCount > 0 && (
            <View style={styles.viewCountBadge}>
              <Ionicons name="eye-outline" size={14} color="#fff" />
              <Text style={styles.viewCountText}>{viewCount || 0}</Text>
            </View>
          )}
        </View>
      )}
      
      {/* Badge "Mon annonce" pour les annonces de l'utilisateur */}
      {isUserProperty && (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <MaterialIcons name="verified" size={12} color="white" />
          <Text style={styles.badgeText}>Mon annonce</Text>
        </View>
      )}

      {/* Bouton favori uniquement pour les annonces qui ne sont pas les nôtres */}
      {!isUserProperty && showFavoriteButton && (
        <TouchableOpacity
          style={[styles.favoriteButton]}
          onPress={(e) => {
            // Passer l'événement à la fonction parent
            onFavoritePress(e);
          }}
        >
          <MaterialIcons 
            name={isFavorite ? "favorite" : "favorite-border"} 
            size={24} 
            color={isFavorite ? "#FF3B30" : colors.text} 
          />
        </TouchableOpacity>
      )}

      <View style={styles.infoContainer}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {property.title}
        </Text>
        <Text style={[styles.price, { color: colors.text }]} numberOfLines={1}>
          {property.price.toLocaleString()} FCFA
        </Text>
        <View style={styles.locationContainer}>
          <MaterialIcons name="location-on" size={14} color={colors.text} style={styles.locationIcon} />
          <Text style={[styles.location, { color: colors.text }]} numberOfLines={1}>
            {property.city}
          </Text>
          <Text style={[styles.type, { color: colors.text }]}>• {property.type}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: 150,
    backgroundColor: '#2C2C2E',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
  },
  loadingContainer: {
    width: '100%',
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
  },
  infoContainer: {
    padding: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    marginRight: 2,
  },
  location: {
    fontSize: 12,
    marginRight: 4,
  },
  type: {
    fontSize: 12,
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  favoriteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(44, 44, 46, 0.8)',
  },
  viewedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  viewCountBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(44, 44, 46, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
  }
});

export default PropertyCard;