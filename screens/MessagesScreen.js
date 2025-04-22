import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ScrollView,
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase, handleAuthError } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { format, formatDistance } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as NavigationService from '../navigation/NavigationService';
import { eventEmitter } from '../lib/EventEmitterModule';
import { MaterialIcons } from '@expo/vector-icons';
import { notificationService } from '../services/NotificationService';

// Détection de la plateforme
const isWeb = Platform.OS === 'web';

// Styles
const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webContainer: {
    flex: 1,
    maxWidth: 800,
    marginHorizontal: 'auto',
    width: '100%',
    backgroundColor: colors.background,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    borderWidth: isWeb ? 1 : 0,
    borderColor: '#EEEEEE',
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  webScrollView: {
    flex: 1,
    padding: 10,
  },
  webHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: colors.card,
  },
  webTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  webRefreshButton: {
    padding: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webRefreshText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
  },
  webConversationList: {
    flex: 1,
    padding: 0,
  },
  webConversationItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginHorizontal: 10,
  },
  webPropertyImage: {
    width: 60, 
    height: 60, 
    borderRadius: 8, 
    marginRight: 15
  },
  webContentContainer: {
    flex: 1,
    marginLeft: 15,
  },
  webPropertyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 5,
  },
  webLastMessage: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.7,
    marginBottom: 5,
  },
  webTimeText: {
    fontSize: 12,
    color: colors.text,
    opacity: 0.5,
  },
  webEmptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 300,
  },
  webEmptyText: {
    marginTop: 15,
    color: colors.text,
    opacity: 0.7,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
    fontSize: 15,
  },
  webLoadingText: {
    marginTop: 15,
    color: colors.text,
    opacity: 0.7,
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: colors.text,
    opacity: 0.6,
    textAlign: 'center',
    fontSize: 16,
    marginTop: 10,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: colors.card,
  },
  propertyImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 15,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: colors.text,
    opacity: 0.8,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 12,
    color: colors.text,
    opacity: 0.6,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 10,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  refreshText: {
    textAlign: 'center',
    padding: 10,
    color: colors.text,
  },
});

// Composant pour afficher une conversation
const ConversationItem = ({ item, onPress, styles }) => {
  const formattedTime = formatDistance(new Date(item.last_message_time), new Date(), {
    addSuffix: true,
    locale: fr
  });

  return (
    <TouchableOpacity style={styles.conversationItem} onPress={onPress}>
      <Image 
        source={{ uri: item.property_image || 'https://via.placeholder.com/60' }} 
        style={styles.propertyImage} 
      />
      <View style={styles.contentContainer}>
        <Text style={styles.propertyTitle}>{item.property_title}</Text>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message}
        </Text>
        <Text style={styles.timeText}>{formattedTime}</Text>
      </View>
      {item.unread_count > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Composant pour afficher une conversation en version web
const WebConversationItem = ({ item, onPress, styles }) => {
  const [isHovered, setIsHovered] = useState(false);
  const { colors, isDark } = useTheme();
  
  const formattedTime = formatDistance(new Date(item.last_message_time), new Date(), {
    addSuffix: true,
    locale: fr
  });

  const dynamicStyles = useMemo(() => ({
    container: [
      styles.webConversationItem,
      Platform.OS === 'web' && {
        transform: isHovered ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.3s ease',
        backgroundColor: isDark ? (isHovered ? '#050505' : '#121212') : (isHovered ? '#F5F5F5' : colors.card),
        boxShadow: isDark ? (isHovered ? '0 4px 12px rgba(0, 0, 0, 0.9)' : 'none') : 'none'
      }
    ],
    title: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDark ? (isHovered ? '#4CAF50' : '#FFFFFF') : colors.text,
      marginBottom: 5,
    },
    message: {
      fontSize: 14,
      color: isDark ? '#E0E0E0' : colors.text,
      opacity: 0.9,
      marginBottom: 5,
    },
    time: {
      fontSize: 12,
      color: isDark ? '#BDBDBD' : colors.text,
      opacity: 0.7,
    }
  }), [isHovered, isDark, colors]);

  return (
    <TouchableOpacity 
      key={item.id} 
      style={dynamicStyles.container}
      onPress={onPress}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Image 
        source={{ uri: item.property_image || 'https://via.placeholder.com/60' }} 
        style={styles.webPropertyImage} 
      />
      <View style={styles.webContentContainer}>
        <Text style={dynamicStyles.title}>
          {item.property_title}
        </Text>
        <Text style={dynamicStyles.message} numberOfLines={1}>
          {item.last_message}
        </Text>
        <Text style={dynamicStyles.time}>
          {formattedTime}
        </Text>
      </View>
      {item.unread_count > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unread_count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Fonction pour créer une notification pour un message non lu
const createMessageNotification = async (message, property) => {
  try {
    // Vérifier si le message est valide
    if (!message || !message.id) {
      console.error('[MessagesScreen] Message invalide pour la création de notification');
      return;
    }
    
    // Créer le titre de la notification
    const propertyName = property?.title || 'Propriété';
    
    // Créer la notification
    console.log(`[MessagesScreen] Notification créée pour le message: ${message.id}`);
    await notificationService.createNotification({
      type: 'new_message',
      title: 'Nouveau message',
      message: `Vous avez reçu un message concernant "${propertyName}"`,
      data: {
        sender_id: message.sender_id,
        receiver_id: message.receiver_id,
        property_id: message.property_id,
        message_id: message.id,
        property_name: propertyName
      },
      // Spécifier explicitement que cette notification est pour le destinataire
      user_id: message.receiver_id,
      read: false
    });
  } catch (error) {
    console.error('[MessagesScreen] Erreur lors de la création de la notification:', error);
  }
};

// Composant principal
const MessagesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [blockAutoNavigation, setBlockAutoNavigation] = useState(false);
  
  // Récupérer l'utilisateur actuel
  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('[MessagesScreen] Erreur lors de la récupération de l\'utilisateur:', error);
          
          // Gérer les erreurs d'authentification
          const cleaned = await handleAuthError(error);
          if (cleaned) {
            // Si la session a été nettoyée, rediriger vers la page de connexion
            console.log('[MessagesScreen] Redirection vers la page de connexion après nettoyage de session');
            // Vous pouvez ajouter ici la logique de redirection vers la page de connexion
            return;
          }
          
          return;
        }
        
        console.log('[MessagesScreen] Utilisateur actuel:', user);
        setCurrentUser(user);
        
        // Forcer la mise à jour du compteur de messages non lus
        eventEmitter.emit('globalUnreadCountRefresh');
      } catch (error) {
        console.error('[MessagesScreen] Exception lors de la récupération de l\'utilisateur:', error);
      }
    };
    
    getUser();
  }, []);
  
  // Charger les conversations
  const loadConversations = useCallback(async () => {
    if (!currentUser?.id) {
      console.log('[MessagesScreen] Aucun utilisateur connecté');
      setLoading(false);
      return;
    }
    
    try {
      console.log('[MessagesScreen] Chargement des conversations pour', currentUser.id);
      
      // Récupérer tous les messages de l'utilisateur sans intégration
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          read,
          property_id,
          sender_id,
          receiver_id
        `)
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });
      
      if (error) {
        // Vérifier si c'est une erreur d'authentification
        if (error.message && error.message.includes('JWT')) {
          console.error('[MessagesScreen] Erreur d\'authentification lors de la récupération des messages:', error);
          await handleAuthError({ message: 'Invalid Refresh Token' });
          return;
        }
        throw error;
      }
      
      console.log(`[MessagesScreen] ${messages.length} messages récupérés`);
      
      // Forcer une mise à jour des messages lus depuis la base de données
      // pour s'assurer que les compteurs sont à jour
      const forceRefresh = true;
      
      // Récupérer les propriétés associées aux messages
      const propertyIds = [...new Set(messages.map(msg => msg.property_id))];
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, title, images')
        .in('id', propertyIds);
        
      if (propertiesError) throw propertiesError;
      
      // Créer un map des propriétés pour un accès rapide
      const propertiesMap = properties.reduce((map, property) => {
        map[property.id] = property;
        return map;
      }, {});
      
      // Transformer les messages en conversations
      const conversationsMap = new Map();
      
      for (const message of messages) {
        const property = propertiesMap[message.property_id];
        if (!property) continue;
        
        const propertyId = property.id;
        const otherUserId = message.sender_id === currentUser.id ? message.receiver_id : message.sender_id;
        const conversationKey = `${propertyId}-${otherUserId}`;
        
        // Vérifier si le message est non lu (reçu par l'utilisateur actuel et non lu)
        const isUnread = message.receiver_id === currentUser.id && !message.read;
        
        if (!conversationsMap.has(conversationKey)) {
          conversationsMap.set(conversationKey, {
            id: conversationKey,
            property_id: propertyId,
            property_title: property.title,
            property_image: property.images && property.images.length > 0 ? property.images[0] : null,
            other_user_id: otherUserId,
            last_message: message.content,
            last_message_time: message.created_at,
            unread_count: isUnread ? 1 : 0,
            messages_ids: isUnread ? [message.id] : [],
          });
          
          // Créer une notification pour le premier message non lu
          if (isUnread) {
            createMessageNotification(message, property);
          }
        } else {
          const existingConversation = conversationsMap.get(conversationKey);
          
          // Mettre à jour le compteur de messages non lus
          if (isUnread) {
            existingConversation.unread_count += 1;
            existingConversation.messages_ids.push(message.id);
            
            // Créer une notification pour chaque nouveau message non lu
            createMessageNotification(message, property);
          }
          
          // Mettre à jour le dernier message si celui-ci est plus récent
          if (new Date(message.created_at) > new Date(existingConversation.last_message_time)) {
            existingConversation.last_message = message.content;
            existingConversation.last_message_time = message.created_at;
          }
        }
      }
      
      // Si forceRefresh est activé, émettre un événement pour mettre à jour les compteurs
      if (forceRefresh) {
        // Ne pas émettre d'événements messagesRead pour éviter une boucle infinie
        // Simplement mettre à jour les compteurs localement
        
        // Forcer une mise à jour du compteur global sans déclencher de nouvelles requêtes
        setTimeout(() => {
          console.log('[MessagesScreen] Émission forcée de globalUnreadCountRefresh');
          eventEmitter.emit('globalUnreadCountRefresh');
        }, 500);
      }
      
      // Convertir la Map en tableau et trier par date du dernier message
      const conversationsArray = Array.from(conversationsMap.values())
        .sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
      
      console.log(`[MessagesScreen] ${conversationsArray.length} conversations générées`);
      setConversations(conversationsArray);
      
    } catch (error) {
      console.error('[MessagesScreen] Erreur lors du chargement des conversations:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id]);
  
  // Charger les conversations au montage
  useEffect(() => {
    if (currentUser?.id) {
      loadConversations();
    }
  }, [currentUser?.id, loadConversations]);
  
  // Rafraîchir les conversations
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [loadConversations]);
  
  // Effet pour mettre à jour le compteur de messages non lus lorsque l'écran est focalisé
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[MessagesScreen] Écran focalisé, mise à jour du compteur de messages non lus');
      eventEmitter.emit('globalUnreadCountRefresh');
      
      // Si la fonction globale de rafraîchissement du compteur existe, l'appeler directement
      if (typeof window !== 'undefined' && window.refreshUnreadMessagesCount) {
        console.log('[MessagesScreen] Appel direct de la fonction de rafraîchissement du compteur');
        window.refreshUnreadMessagesCount();
      }
    });
    
    return unsubscribe;
  }, [navigation]);

  // Écouter les événements de messages
  useEffect(() => {
    const handleMessagesRead = (data) => {
      console.log('[MessagesScreen] Événement messagesRead reçu:', data);
      
      if (!data || !data.messageIds || data.messageIds.length === 0) {
        console.log('[MessagesScreen] Aucun ID de message trouvé dans l\'événement messagesRead');
        return;
      }
      
      // Mettre à jour les conversations localement
      setConversations((prevConversations) => {
        // Créer une copie des conversations
        const updatedConversations = [...prevConversations];
        let conversationUpdated = false;
        
        // Parcourir toutes les conversations
        for (let i = 0; i < updatedConversations.length; i++) {
          const conv = updatedConversations[i];
          
          // Vérifier si cette conversation contient les messages lus
          const messageIdsInConv = conv.messages_ids || [];
          const readMessageIds = messageIdsInConv.filter(id => data.messageIds.includes(id));
          
          if (readMessageIds.length > 0) {
            console.log(`[MessagesScreen] Mise à jour de la conversation ${conv.id}, ${readMessageIds.length} messages lus`);
            
            // Mettre à jour le compteur de messages non lus
            const newUnreadCount = Math.max(0, conv.unread_count - readMessageIds.length);
            
            // Mettre à jour la liste des messages non lus
            const newMessagesIds = messageIdsInConv.filter(id => !data.messageIds.includes(id));
            
            // Mettre à jour la conversation
            updatedConversations[i] = {
              ...conv,
              unread_count: newUnreadCount,
              messages_ids: newMessagesIds
            };
            
            conversationUpdated = true;
          }
        }
        
        if (!conversationUpdated) {
          console.log('[MessagesScreen] Aucune conversation mise à jour, rechargement forcé');
          // Si aucune conversation n'a été mise à jour, forcer un rechargement complet
          loadConversations(true);
        }
        
        return conversationUpdated ? updatedConversations : prevConversations;
      });
      
      // Recharger les conversations depuis la base de données avec un délai
      // pour s'assurer que les mises à jour sont bien prises en compte
      setTimeout(() => {
        loadConversations(true);
      }, 500);
    };
    
    const handleConversationsRefresh = (data) => {
      console.log('[MessagesScreen] Événement conversationsRefresh reçu:', data);
      
      if (data && data.forceClearStates) {
        console.log('[MessagesScreen] Blocage de la navigation automatique activé');
        setBlockAutoNavigation(true);
      }
      
      // Recharger les conversations depuis la base de données
      loadConversations(true);
    };
    
    const handleMessageSent = () => {
      loadConversations();
    };
    
    // Ajouter les écouteurs d'événements
    const messagesReadListener = eventEmitter.addListener('messagesRead', handleMessagesRead);
    const conversationsRefreshListener = eventEmitter.addListener('conversationsRefresh', handleConversationsRefresh);
    const messageSentListener = eventEmitter.addListener('messageSent', handleMessageSent);
    
    // Nettoyer les écouteurs lors du démontage
    return () => {
      messagesReadListener.remove();
      conversationsRefreshListener.remove();
      messageSentListener.remove();
    };
  }, [loadConversations]);
  
  // Naviguer vers un chat
  const navigateToChat = useCallback((conversation) => {
    if (!conversation || !conversation.property_id || !conversation.other_user_id) {
      console.error('[MessagesScreen] Données de conversation incomplètes:', conversation);
      return;
    }
    
    // Émettre un événement pour indiquer que nous allons ouvrir un chat
    eventEmitter.emit('chatOpened', {
      propertyId: conversation.property_id,
      senderId: conversation.other_user_id,
      receiverId: currentUser?.id
    });
    
    console.log('[MessagesScreen] Navigation vers le chat:', conversation);
    
    // Récupérer les détails de la propriété
    const getPropertyDetails = async () => {
      try {
        const { data: property, error } = await supabase
          .from('properties')
          .select('*')
          .eq('id', conversation.property_id)
          .single();
        
        if (error) throw error;
        
        // Naviguer vers le chat avec les paramètres nécessaires
        NavigationService.navigate('MainApp', {
          screen: 'Messages',
          params: {
            screen: 'Chat',
            params: {
              propertyId: property.id,
              propertyTitle: property.title,
              recipientId: conversation.other_user_id,
              fromMessages: true
            }
          }
        });
        
      } catch (error) {
        console.error('[MessagesScreen] Erreur lors de la récupération des détails de la propriété:', error.message);
      }
    };
    
    getPropertyDetails();
  }, []);

  const handlePress = useCallback((conversation) => {
    // Émettre un événement pour indiquer que nous allons ouvrir un chat
    eventEmitter.emit('chatOpened', {
      propertyId: conversation.property_id,
      senderId: conversation.other_user_id,
      receiverId: currentUser?.id
    });
    
    NavigationService.navigate('Messages', {
      screen: 'Chat',
      params: {
        fromMessages: true,
        propertyId: conversation.property_id,
        propertyTitle: conversation.property_title,
        recipientId: conversation.other_user_id,
        propertyImage: conversation.property_image
      }
    });
  }, [currentUser?.id]);

  // Rendu principal
  if (isWeb) {
    console.log('[MessagesScreen] Rendu version web avec', conversations.length, 'conversations');
    return (
      <View style={styles.webContainer}>
        <View style={styles.webHeader}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={onRefresh}
            style={styles.webRefreshButton}
          >
            <MaterialIcons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={styles.webRefreshText}>Rafraîchir</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView
          style={styles.webScrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {loading ? (
            <View style={styles.webEmptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.webLoadingText}>
                Chargement des conversations...
              </Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.webEmptyContainer}>
              <MaterialIcons name="chat-bubble-outline" size={60} color={colors.primary} opacity={0.5} />
              <Text style={styles.webEmptyText}>
                Vous n'avez pas encore de conversations.
                Consultez les propriétés et envoyez un message pour commencer.
              </Text>
            </View>
          ) : (
            conversations.map((item) => (
              <WebConversationItem 
                key={item.id} 
                item={item}
                onPress={() => navigateToChat(item)}
                styles={styles}
              />
            ))
          )}
        </ScrollView>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.emptyText}>
              Chargement des conversations...
            </Text>
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="chat-bubble-outline" size={48} color="#CCCCCC" />
            <Text style={styles.emptyText}>
              Vous n'avez pas encore de conversations.
              Consultez les propriétés et envoyez un message pour commencer.
            </Text>
          </View>
        ) : (
          conversations.map((item) => (
            <ConversationItem
              key={item.id}
              item={item}
              onPress={() => handlePress(item)}
              styles={styles}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default MessagesScreen;
