import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { notificationService } from '../services/NotificationService';
import { supabase, handleAuthError } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { eventEmitter } from '../lib/EventEmitterModule';

const createStyles = (colors, isDarkMode) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 10,
  },
  notification: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 15,
    marginVertical: 5,
    backgroundColor: isDarkMode ? colors.card : colors.background,
  },
  unreadNotification: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
    color: colors.text,
  },
  notificationMessage: {
    fontSize: 14,
    marginBottom: 8,
    color: colors.text,
  },
  notificationTimestamp: {
    fontSize: 12,
    opacity: 0.7,
    color: isDarkMode ? '#aaaaaa' : '#666666',
  },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: '#FF4444',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    color: colors.text,
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  resetButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  iconColor: {
    color: isDarkMode ? colors.text : colors.primary,
  },
});

export default function NotificationsScreen() {
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => createStyles(colors, isDarkMode), [colors, isDarkMode]);
  const [notifications, setNotifications] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      console.log('[NotificationsScreen] Chargement des notifications...');
      const notifications = await notificationService.getAllNotifications();
      console.log(`[NotificationsScreen] ${notifications.length} notifications récupérées`);
      
      if (notifications.length > 0) {
        console.log('[NotificationsScreen] Types de notifications:', 
          notifications.map(n => n.type).filter((v, i, a) => a.indexOf(v) === i));
        console.log('[NotificationsScreen] Première notification:', JSON.stringify(notifications[0]));
      } else {
        console.log('[NotificationsScreen] Aucune notification récupérée');
      }
      
      setNotifications(notifications);
    } catch (error) {
      console.error('[NotificationsScreen] Erreur lors du chargement des notifications:', error);
      
      // Vérifier si c'est une erreur d'authentification
      if (error.message && (error.message.includes('JWT') || error.message.includes('Refresh Token'))) {
        console.error('[NotificationsScreen] Erreur d\'authentification détectée');
        await handleAuthError(error);
      }
    }
  };

  useEffect(() => {
    // Charger les notifications au montage du composant
    loadNotifications();
    
    // Écouter les événements de suppression de notification
    const deleteListener = eventEmitter.addListener('notificationDeleted', (notificationId) => {
      console.log('[NotificationsScreen] Événement de suppression reçu pour:', notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    });
    
    // Écouter les événements de suppression de toutes les notifications
    const clearAllListener = eventEmitter.addListener('allNotificationsDeleted', () => {
      console.log('[NotificationsScreen] Événement de suppression de toutes les notifications reçu');
      setNotifications([]);
    });
    
    // Écouter les événements de création de notification
    const createListener = eventEmitter.addListener('notificationCreated', (notification) => {
      console.log('[NotificationsScreen] Événement de création de notification reçu:', notification?.id);
      // Recharger les notifications après un court délai pour s'assurer que la notification est bien enregistrée
      setTimeout(() => {
        loadNotifications();
      }, 500);
    });
    
    // Rafraîchir les notifications périodiquement (toutes les 10 secondes)
    const refreshInterval = setInterval(() => {
      console.log('[NotificationsScreen] Rafraîchissement périodique des notifications');
      loadNotifications();
    }, 10000);
    
    return () => {
      deleteListener.remove();
      clearAllListener.remove();
      createListener.remove();
      clearInterval(refreshInterval);
    };
  }, []);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadNotifications().finally(() => setRefreshing(false));
  }, []);
  
  const resetDeletedNotifications = async () => {
    try {
      console.log('[NotificationsScreen] Réinitialisation des notifications supprimées...');
      await notificationService.resetDeletedNotifications();
      // Recharger les notifications après réinitialisation
      loadNotifications();
    } catch (error) {
      console.error('[NotificationsScreen] Erreur lors de la réinitialisation des notifications:', error);
    }
  };

  const handlePress = (notification) => {
    // Marquer comme lu
    notificationService.markAsRead(notification.id);
    
    // Mettre à jour l'interface
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );

    // Navigation conditionnelle selon le type de notification
    switch (notification.type) {
      case 'new_message':
        console.log('[NotificationsScreen] Navigation vers le chat pour la notification:', notification);
        
        // Vérifier si nous avons toutes les informations nécessaires
        if (!notification.data) {
          console.error('[NotificationsScreen] Données de notification manquantes');
          return;
        }

        // Récupérer les informations de la propriété si disponibles
        const navigateToChat = async () => {
          try {
            // Préparer les paramètres de base pour la navigation
            const chatParams = {
              property_id: notification.data.property_id,
              sender_id: notification.data.sender_id,
              receiver_id: notification.data.receiver_id,
              fromNotification: true
            };

            // Si nous avons l'ID de la propriété, récupérer les détails
            if (notification.data.property_id) {
              const { data: propertyData, error } = await supabase
                .from('properties')
                .select('*')
                .eq('id', notification.data.property_id)
                .single();

              if (error) {
                // Vérifier si c'est une erreur d'authentification
                if (error.message && (error.message.includes('JWT') || error.message.includes('Refresh Token'))) {
                  console.error('[NotificationsScreen] Erreur d\'authentification lors de la récupération de la propriété:', error);
                  await handleAuthError(error);
                  // Utiliser le nom de la propriété depuis la notification comme fallback
                  chatParams.property_name = notification.data.property_name || 'Propriété';
                } else {
                  console.error('[NotificationsScreen] Erreur lors de la récupération de la propriété:', error);
                  chatParams.property_name = notification.data.property_name || 'Propriété';
                }
              } else if (propertyData) {
                chatParams.property = propertyData;
                chatParams.property_name = propertyData.title || 'Propriété';
              } else {
                // Utiliser le nom de la propriété depuis la notification si disponible
                chatParams.property_name = notification.data.property_name || 'Propriété';
              }
            }

            // Utiliser le service de navigation pour aller au chat
            try {
              // Vérifier d'abord si nous sommes déjà dans une pile de navigation
              const currentRoute = navigation.getCurrentRoute?.();
              console.log('[NotificationsScreen] Route actuelle:', currentRoute?.name);
              
              // Sécuriser la navigation en vérifiant si nous pouvons naviguer
              if (navigation.canGoBack()) {
                console.log('[NotificationsScreen] Navigation possible vers l\'arrière');
                // Naviguer d'abord vers l'écran principal pour éviter les erreurs de navigation
                navigation.navigate('MainApp');
                
                // Ensuite naviguer vers le chat
                setTimeout(() => {
                  navigation.navigate('MainApp', {
                    screen: 'Messages',
                    params: {
                      screen: 'Chat',
                      params: chatParams
                    }
                  });
                }, 100);
              } else {
                console.log('[NotificationsScreen] Navigation directe sans retour arrière');
                // Navigation directe si nous ne pouvons pas revenir en arrière
                navigation.navigate('MainApp', {
                  screen: 'Messages',
                  params: {
                    screen: 'Chat',
                    params: chatParams
                  }
                });
              }
            } catch (navError) {
              console.error('[NotificationsScreen] Erreur de navigation:', navError);
              // Fallback ultime - utiliser le service de navigation global
              try {
                NavigationService.navigate('MainApp', {
                  screen: 'Messages',
                  params: {
                    screen: 'Chat',
                    params: chatParams
                  }
                });
              } catch (fallbackError) {
                console.error('[NotificationsScreen] Erreur de navigation fallback:', fallbackError);
              }
            }
          } catch (error) {
            console.error('[NotificationsScreen] Erreur lors de la navigation vers le chat:', error);
          }
        };
        
        // Exécuter la navigation
        navigateToChat();
        break;

      case 'payment_received':
        try {
          console.log('[NotificationsScreen] Navigation vers les détails de transaction');
          // Sécuriser la navigation
          if (navigation.canGoBack()) {
            // Naviguer d'abord vers l'écran principal
            navigation.navigate('MainApp');
            
            // Puis vers les détails de transaction
            setTimeout(() => {
              navigation.navigate('TransactionDetails', {
                transactionId: notification.data.transaction_id
              });
            }, 100);
          } else {
            // Navigation directe
            navigation.navigate('TransactionDetails', {
              transactionId: notification.data.transaction_id
            });
          }
        } catch (navError) {
          console.error('[NotificationsScreen] Erreur de navigation vers les détails de transaction:', navError);
          // Fallback avec NavigationService
          try {
            NavigationService.navigate('TransactionDetails', {
              transactionId: notification.data.transaction_id
            });
          } catch (fallbackError) {
            console.error('[NotificationsScreen] Erreur de navigation fallback:', fallbackError);
          }
        }
        break;
        
      case 'payment_info_needed':
        try {
          console.log('[NotificationsScreen] Navigation vers l\'\u00e9cran de configuration des moyens de paiement');
          // Sécuriser la navigation
          if (navigation.canGoBack()) {
            // Naviguer d'abord vers l'écran principal
            navigation.navigate('MainApp');
            
            // Puis vers l'écran de configuration des moyens de paiement
            setTimeout(() => {
              navigation.navigate('MainApp', {
                screen: 'Profile',
                params: {
                  screen: 'PaymentInfoScreen'
                }
              });
            }, 100);
          } else {
            // Navigation directe
            navigation.navigate('MainApp', {
              screen: 'Profile',
              params: {
                screen: 'PaymentInfoScreen'
              }
            });
          }
        } catch (navError) {
          console.error('[NotificationsScreen] Erreur de navigation vers PaymentInfoScreen:', navError);
          // Fallback avec NavigationService
          try {
            NavigationService.navigate('MainApp', {
              screen: 'Profile',
              params: {
                screen: 'PaymentInfoScreen'
              }
            });
          } catch (fallbackError) {
            console.error('[NotificationsScreen] Erreur de navigation fallback:', fallbackError);
          }
        }
        break;
        
      case 'payment_receipt':
        try {
          console.log('[NotificationsScreen] Navigation vers le reçu de paiement');
          // Sécuriser la navigation
          if (navigation.canGoBack()) {
            // Naviguer d'abord vers l'écran principal
            navigation.navigate('MainApp');
            
            // Puis vers le reçu
            setTimeout(() => {
              navigation.navigate('MainApp', {
                screen: 'Receipt',
                params: {
                  transaction: {
                    id: notification.data.transaction_id,
                    amount: notification.data.amount,
                    payment_method: notification.data.payment_method,
                    seller_name: notification.data.seller_name,
                    buyer_name: notification.data.buyer_name,
                    property_name: notification.data.property_name,
                    status: notification.data.status,
                    created_at: new Date().toISOString()
                  }
                }
              });
            }, 100);
          } else {
            // Navigation directe
            navigation.navigate('MainApp', {
              screen: 'Receipt',
              params: {
                transaction: {
                  id: notification.data.transaction_id,
                  amount: notification.data.amount,
                  payment_method: notification.data.payment_method,
                  seller_name: notification.data.seller_name,
                  buyer_name: notification.data.buyer_name,
                  property_name: notification.data.property_name,
                  status: notification.data.status,
                  created_at: new Date().toISOString()
                }
              }
            });
          }
        } catch (navError) {
          console.error('[NotificationsScreen] Erreur de navigation vers Receipt:', navError);
          // Fallback avec NavigationService
          try {
            NavigationService.navigate('MainApp', {
              screen: 'Receipt',
              params: {
                transaction: {
                  id: notification.data.transaction_id,
                  amount: notification.data.amount,
                  payment_method: notification.data.payment_method,
                  seller_name: notification.data.seller_name,
                  buyer_name: notification.data.buyer_name,
                  property_name: notification.data.property_name,
                  status: notification.data.status,
                  created_at: new Date().toISOString()
                }
              }
            });
          } catch (fallbackError) {
            console.error('[NotificationsScreen] Erreur de navigation fallback:', fallbackError);
          }
        }
        break;
      default:
        console.log('[NotificationsScreen] Type de notification non géré:', notification.type);
        break;
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      // Afficher un indicateur visuel que la notification est en cours de suppression
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, isDeleting: true } : n
      ));
      
      // Supprimer la notification via le service
      await notificationService.removeNotification(notificationId);
      
      // Mettre à jour l'état local (bien que l'écouteur d'événements le fera aussi)
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      console.log('[NotificationsScreen] Notification supprimée:', notificationId);
    } catch (error) {
      // En cas d'erreur, réinitialiser l'état de suppression
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, isDeleting: false } : n
      ));
      console.error('[NotificationsScreen] Erreur lors de la suppression de la notification:', error);
    }
  };

  const renderNotification = (notification) => {
    // Utiliser l'instance notificationService et l'ID comme clé
    const notificationId = `notification_${notification.id}_${notification.timestamp}`;
    return (
      <TouchableOpacity
        key={notificationId}
        style={[styles.notification, {
          borderColor: notification.read ? colors.border : colors.primary,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: 15,
          borderRadius: 8,
          marginVertical: 5,
          backgroundColor: notification.read ? colors.background : colors.card,
          opacity: notification.isDeleting ? 0.5 : 1, // Réduire l'opacité pendant la suppression
        }]}
        onPress={() => handlePress(notification)}
        activeOpacity={0.7}
        disabled={notification.isDeleting} // Désactiver pendant la suppression
      >
        <View style={{ flex: 1 }}>
          <View style={styles.notificationHeader}>
            <MaterialIcons 
              name={notification.type === 'payment_received' ? 'attach-money' : notification.type === 'new_message' ? 'chat' : 'info'} 
              size={24} 
              color={notification.read ? colors.text : colors.primary} 
            />
            <Text style={[styles.notificationTitle]}>
              {notification.title}
            </Text>
          </View>
          <Text style={[styles.notificationMessage]}>
            {notification.message}
          </Text>
          <Text style={[styles.notificationTimestamp]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {new Date(notification.timestamp).toLocaleString()}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(notification.id)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="delete"
            size={20}
            color="white"
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Fonction pour effacer toutes les notifications
  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    
    try {
      await notificationService.clearAllNotifications();
      setNotifications([]);
      console.log('[NotificationsScreen] Toutes les notifications ont été supprimées');
    } catch (error) {
      console.error('[NotificationsScreen] Erreur lors de la suppression de toutes les notifications:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      {notifications.length > 0 && (
        <TouchableOpacity
          style={{
            alignSelf: 'flex-end',
            margin: 10,
            padding: 8,
            backgroundColor: '#FF4444',
            borderRadius: 5,
          }}
          onPress={handleClearAll}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Tout effacer</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={notifications}
        renderItem={({ item }) => renderNotification(item)}
        keyExtractor={(item) => `notification_${item.id}_${item.timestamp}`}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.primary]}
            progressBackgroundColor={isDarkMode ? '#333333' : '#f2f2f2'}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="notifications-none" size={60} style={styles.iconColor} />
            <Text style={styles.emptyStateText}>Aucune notification pour le moment</Text>
            <TouchableOpacity style={styles.resetButton} onPress={resetDeletedNotifications}>
              <Text style={styles.resetButtonText}>Réinitialiser les notifications</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}
