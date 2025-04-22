import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  SafeAreaView,
  Keyboard,
  ScrollView,
  BackHandler,
  CommonActions
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import * as NavigationService from '../navigation/NavigationService';
import { useTheme } from '../context/ThemeContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { eventEmitter } from '../lib/EventEmitterModule';
import { MaterialIcons } from '@expo/vector-icons';
import { notificationService } from '../services/NotificationService';

// Détection de la plateforme
const isWeb = Platform.OS === 'web';

// Définition des styles
const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    ...(isWeb && {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    backgroundColor: colors.card,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    marginLeft: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 15,
  },
  messageList: {
    padding: 15,
    flexGrow: 1,
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
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#333333',
    color: '#FFFFFF',
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 50,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  messageContainer: {
    maxWidth: '70%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#4CAF50',
    borderTopRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    color: '#333333',
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 10,
    color: '#999999',
    marginTop: 5,
    textAlign: 'right',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  webScrollView: {
    flex: 1,
  },
});

// Composant de message
const Message = ({ item, currentUser, styles }) => {
  const isMyMessage = item.sender_id === currentUser?.id;
  
  return (
    <View
      style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessage : styles.otherMessage
      ]}
    >
      <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>{item.content}</Text>
      <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
};

// Composant principal
const ChatScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const route = useRoute();
  const navigation = useNavigation();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [property, setProperty] = useState(null);
  const [receiverId, setReceiverId] = useState(null);
  const [fromMessages, setFromMessages] = useState(false);
  const [fromPropertyDetails, setFromPropertyDetails] = useState(false);
  
  const scrollViewRef = useRef();
  const messagesSubscription = useRef(null);
  
  // Gestion du bouton retour
  const handleBackNavigation = useCallback(() => {
    console.log('[ChatScreen] Bouton retour visuel pressé');
    console.log('[ChatScreen] Retour avec contexte');
    console.log('[ChatScreen] fromMessages:', fromMessages);
    console.log('[ChatScreen] fromPropertyDetails:', fromPropertyDetails);

    try {
      if (fromPropertyDetails) {
        console.log('[ChatScreen] Retour vers PropertyDetailsScreen');
        navigation.navigate('MainApp', {
          screen: 'PropertyDetails',
          params: { id: property?.id }
        });
      } else {
        console.log('[ChatScreen] Retour vers MessagesList');
        // Utiliser CommonActions.reset pour éviter les erreurs de navigation
        navigation.dispatch(
          CommonActions.navigate({
            name: 'MainApp',
            params: {
              screen: 'Messages',
              params: {
                screen: 'MessagesList'
              }
            }
          })
        );
      }
    } catch (error) {
      console.error('[ChatScreen] Erreur lors de la navigation:', error);
      // Fallback en cas d'erreur: tenter une navigation simple
      try {
        navigation.navigate('MainApp');
      } catch (e) {
        console.error('[ChatScreen] Erreur fallback navigation:', e);
      }
    }
  }, [navigation, fromMessages, fromPropertyDetails, property?.id]);

  // Configuration du bouton retour pour iOS
  useEffect(() => {
    if (Platform.OS === 'ios') {
      navigation.setOptions({
        headerLeft: () => (
          <TouchableOpacity 
            onPress={handleBackNavigation}
            style={{ marginLeft: 10 }}
          >
            <MaterialIcons name="arrow-back-ios" size={24} color={colors.text} />
          </TouchableOpacity>
        ),
      });
    }
  }, [navigation, handleBackNavigation, colors.text]);

  // Fonction pour charger les messages
  const loadMessages = useCallback(async () => {
    if (!property?.id || !receiverId || !currentUser?.id) {
      console.log('[ChatScreen] Données manquantes pour charger les messages');
      return;
    }
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUser.id})`)
        .eq('property_id', property.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      console.log(`[ChatScreen] ${data.length} messages chargés`);
      setMessages(data || []);
    } catch (error) {
      console.error('[ChatScreen] Erreur lors du chargement des messages:', error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, receiverId, property, supabase]);
  
  // Récupérer les paramètres de la route
  useEffect(() => {
    console.log('[ChatScreen] Paramètres de route:', route.params);
    
    if (route.params) {
      const { 
        propertyId, 
        property_id, // Pour les notifications
        property: routeProperty, 
        recipientId, 
        receiver_id, // Pour les notifications
        sender_id, // Pour les notifications
        propertyTitle,
        property_name, // Pour les notifications
        fromNotification // Flag pour indiquer que l'on vient d'une notification
      } = route.params;
      
      // Définir l'ID de la propriété
      const finalPropertyId = propertyId || property_id;
      
      // Si nous avons un ID de propriété mais pas d'objet property, créer un objet minimal
      if (finalPropertyId && !routeProperty) {
        setProperty({
          id: finalPropertyId,
          title: propertyTitle || property_name || 'Conversation'
        });
      } else if (routeProperty) {
        setProperty(routeProperty);
      }
      
      // Déterminer le receiverId en fonction du contexte
      if (fromNotification) {
        // Si on vient d'une notification, déterminer le receiverId en fonction de l'utilisateur actuel
        const getUser = async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              // Si l'utilisateur actuel est le destinataire de la notification,
              // alors l'expéditeur du message est le destinataire de notre réponse
              if (user.id === receiver_id) {
                setReceiverId(sender_id);
                console.log('[ChatScreen] Notification: ReceiverID défini comme sender_id:', sender_id);
              } else {
                // Sinon, nous sommes l'expéditeur et le destinataire est le destinataire de notre message
                setReceiverId(receiver_id);
                console.log('[ChatScreen] Notification: ReceiverID défini comme receiver_id:', receiver_id);
              }
            }
          } catch (error) {
            console.error('[ChatScreen] Erreur lors de la récupération de l\'utilisateur:', error);
          }
        };
        getUser();
      } else if (recipientId) {
        // Cas standard: utiliser recipientId comme receiverId
        setReceiverId(recipientId);
        console.log('[ChatScreen] RecipientId défini:', recipientId);
      } else if (receiver_id) {
        // Fallback: utiliser receiver_id si disponible
        setReceiverId(receiver_id);
        console.log('[ChatScreen] Fallback: ReceiverID défini comme receiver_id:', receiver_id);
      }
      
      // Détecter la source de navigation
      if (fromNotification) {
        console.log('[ChatScreen] Navigation depuis une notification');
        setFromMessages(true); // Traiter comme si on venait de Messages pour le comportement du bouton retour
      } else if (route.params.fromPropertyDetails) {
        setFromPropertyDetails(true);
      } else {
        setFromMessages(true);
      }
    }
  }, [route.params]);
  
  // Récupérer l'utilisateur actuel
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('[ChatScreen] Utilisateur actuel:', user);
      setCurrentUser(user);
    };
    
    getUser();
  }, []);
  
  // Charger les messages
  useEffect(() => {
    // Vérifier et loguer l'état des données nécessaires
    console.log('[ChatScreen] État des données:', {
      propertyId: property?.id,
      receiverId,
      currentUserId: currentUser?.id
    });

    if (!property?.id || !receiverId || !currentUser?.id) {
      console.log('[ChatScreen] Données manquantes pour charger les messages');
      // Ne pas retourner immédiatement, attendre un peu
      setTimeout(() => {
        if (!property?.id || !receiverId || !currentUser?.id) {
          setLoading(false); // Désactiver le chargement si les données sont toujours manquantes
        }
      }, 2000);
      return;
    }
    
    // Appeler la fonction loadMessages définie en dehors de cet effet
    loadMessages();
    
    // Abonnement aux nouveaux messages
    const setupSubscription = async () => {
      if (messagesSubscription.current) {
        messagesSubscription.current.unsubscribe();
      }
      
      messagesSubscription.current = supabase
        .channel('messages-channel')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `property_id=eq.${property.id}`,
        }, (payload) => {
          console.log('[ChatScreen] Nouveau message reçu:', payload);
          
          // Vérifier si le message concerne notre conversation
          const newMessage = payload.new;
          if (
            (newMessage.sender_id === currentUser.id && newMessage.receiver_id === receiverId) ||
            (newMessage.sender_id === receiverId && newMessage.receiver_id === currentUser.id)
          ) {
            setMessages((prev) => [...prev, newMessage]);
          }
        })
        .subscribe();
    };
    
    setupSubscription();
    
    return () => {
      if (messagesSubscription.current) {
        messagesSubscription.current.unsubscribe();
      }
    };
  }, [property?.id, receiverId, currentUser?.id]);
  
  // Faire défiler vers le bas lorsque de nouveaux messages arrivent
  useEffect(() => {
    if (messages.length > 0 && scrollViewRef.current) {
      setTimeout(() => {
        if (isWeb) {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        } else {
          scrollViewRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    }
  }, [messages]);
  
  // Charger les messages au montage du composant
  useEffect(() => {
    if (currentUser?.id && receiverId && property?.id) {
      loadMessages();
      
      // Émettre un événement pour indiquer que le chat a été ouvert
      console.log('[ChatScreen] Émission de l\'événement chatOpened');
      eventEmitter.emit('chatOpened', { 
        propertyId: property.id, 
        senderId: receiverId,
        receiverId: currentUser.id
      });
      
      // Forcer la mise à jour du compteur global
      setTimeout(() => {
        eventEmitter.emit('globalUnreadCountRefresh');
      }, 300);
    }
  }, [currentUser, receiverId, property, loadMessages]);
  
  // Marquer les messages comme lus
  useEffect(() => {
    const markMessagesAsRead = async () => {
      if (!currentUser?.id || !receiverId || !property?.id || messages.length === 0) {
        console.log('[ChatScreen] Données manquantes pour marquer les messages comme lus');
        return;
      }
      
      try {
        const unreadMessages = messages.filter(
          (msg) => msg.receiver_id === currentUser.id && !msg.read
        );
        
        if (unreadMessages.length === 0) {
          console.log('[ChatScreen] Aucun message non lu à marquer');
          return;
        }
        
        console.log(`[ChatScreen] Marquage de ${unreadMessages.length} messages comme lus`);
        console.log('[ChatScreen] IDs des messages à marquer comme lus:', unreadMessages.map(msg => msg.id));
        
        // Utiliser la fonction RPC pour marquer les messages comme lus
        const { error, data } = await supabase.rpc('mark_messages_as_read', {
          message_ids: unreadMessages.map(msg => msg.id)
        });
        
        if (error) {
          console.error('[ChatScreen] Erreur lors du marquage des messages:', error.message);
          
          // Fallback à la méthode traditionnelle si la RPC échoue
          console.log('[ChatScreen] Tentative de fallback avec la méthode traditionnelle');
          const { error: updateError } = await supabase
            .from('messages')
            .update({ read: true, updated_at: new Date().toISOString() })
            .in('id', unreadMessages.map((msg) => msg.id));
            
          if (updateError) {
            console.error('[ChatScreen] Erreur lors de la mise à jour fallback:', updateError.message);
            return;
          }
        }
        
        console.log('[ChatScreen] Messages marqués comme lus avec succès');
        
        // Récupérer les IDs des messages marqués comme lus
        const messageIds = unreadMessages.map(msg => msg.id);
        
        console.log('[ChatScreen] Émission de l\'événement messagesRead avec:', { 
          propertyId: property.id, 
          senderId: receiverId,
          messageIds: messageIds
        });
        
        // Émettre un événement pour mettre à jour les compteurs
        eventEmitter.emit('messagesRead', { 
          propertyId: property.id, 
          senderId: receiverId,
          messageIds: messageIds 
        });
        
        console.log('[ChatScreen] Événement messagesRead émis');
        
        // Forcer le rafraîchissement des conversations dans MessagesScreen
        eventEmitter.emit('conversationsRefresh', { forceClearStates: true });
        
        // Émettre un événement pour rafraîchir le compteur global
        eventEmitter.emit('globalUnreadCountRefresh');
        
        // Appeler la fonction globale de rafraîchissement du compteur si elle existe
        if (window.refreshUnreadMessagesCount) {
          console.log('[ChatScreen] Appel direct de la fonction de rafraîchissement du compteur');
          window.refreshUnreadMessagesCount();
        }
        
        // Forcer une mise à jour directe dans la base de données après un court délai
        setTimeout(() => {
          eventEmitter.emit('globalUnreadCountRefresh');
        }, 1000);
      } catch (err) {
        console.error('[ChatScreen] Erreur inattendue lors du marquage des messages:', err);
      }
    };

    markMessagesAsRead();
  }, [currentUser, receiverId, property, messages]);
  
  // Configurer le bouton de retour et le titre
  useEffect(() => {
    console.log('[ChatScreen] Configuration des options de navigation');
    console.log('[ChatScreen] fromMessages:', fromMessages);
    console.log('[ChatScreen] fromPropertyDetails:', fromPropertyDetails);
    
    // Fonction de navigation commune
    const handleBackNavigation = () => {
      console.log('[ChatScreen] Retour avec contexte');
      console.log('[ChatScreen] fromMessages:', fromMessages);
      console.log('[ChatScreen] fromPropertyDetails:', fromPropertyDetails);
      
      if (fromPropertyDetails) {
        // Si on vient de PropertyDetailsScreen, on y retourne explicitement
        console.log('[ChatScreen] Retour vers PropertyDetailsScreen');
        if (property && property.id) {
          navigation.navigate('PropertyDetails', { 
            propertyId: property.id,
            property: property
          });
        } else {
          navigation.goBack();
        }
      } else {
        // Comportement par défaut
        console.log('[ChatScreen] Retour standard (goBack)');
        navigation.goBack();
      }
    };

    // Gestionnaire du bouton retour physique Android
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('[ChatScreen] Bouton retour physique pressé');
      handleBackNavigation();
      return true;
    });

    console.log('[ChatScreen] BackHandler configuré');

    // Configurer les options de l'écran pour personnaliser le comportement du bouton de retour et le titre
    navigation.setOptions({
      title: property?.title || 'Conversation',
      headerTitleAlign: 'center',
      // Sur Android, nous ne définissons pas de headerLeft personnalisé
      // car le bouton de retour standard de React Navigation fonctionne déjà
      ...(Platform.OS !== 'android' && {
        headerLeft: () => (
          <Pressable
            onPress={() => {
              console.log('[ChatScreen] Bouton retour visuel pressé');
              handleBackNavigation();
            }}
            style={{ 
              marginLeft: 15, 
              padding: 10,
              flexDirection: 'row', 
              alignItems: 'center' 
            }}
            android_ripple={{ color: colors.primary }}
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
        ),
      }),
    });

    // Nettoyage du gestionnaire lors du démontage du composant
    return () => backHandler.remove();
    
  }, [navigation, colors, property]);
  
  // Envoyer un message
  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      
      console.log('[ChatScreen] Tentative d\'envoi du message:', newMessage);
      
      // Informer que nous envoyons un nouveau message
      eventEmitter.emit('newMessage', {
        propertyId: property?.id,
        senderId: currentUser?.id,
        receiverId: receiverId
      });
      
      // Vérifier si l'utilisateur est authentifié
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[ChatScreen] Utilisateur non authentifié');
        Alert.alert('Erreur', 'Vous devez être connecté pour envoyer un message.');
        setSending(false);
        return;
      }
      
      // Préparer les données du message
      const messageData = {
        content: newMessage,
        sender_id: currentUser?.id,
        receiver_id: receiverId,
        property_id: property?.id,
        created_at: new Date().toISOString()
      };
      
      console.log('[ChatScreen] Envoi du message avec les données:', messageData);
      
      // Essayer d'abord d'utiliser la fonction RPC si elle existe
      let result;
      try {
        // Appeler une fonction RPC pour insérer le message avec les bonnes permissions
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('insert_message', messageData);

        if (!rpcError) {
          result = { data: [rpcData], error: null };
          console.log('[ChatScreen] Message envoyé via RPC avec succès');
        } else {
          console.log('[ChatScreen] Erreur RPC, fallback à l\'insertion directe:', rpcError);
          // Si la fonction RPC n'existe pas ou échoue, essayer l'insertion directe
          const { data, error } = await supabase
            .from('messages')
            .insert([messageData])
            .select();
            
          result = { data, error };
        }
      } catch (error) {
        console.error('[ChatScreen] Erreur lors de l\'envoi du message via RPC:', error);
        // Fallback à l'insertion directe
        const { data, error: insertError } = await supabase
          .from('messages')
          .insert([messageData])
          .select();
          
        result = { data, error: insertError };
      }
      
      // Vérifier s'il y a eu une erreur
      if (result && result.error) {
        throw result.error;
      }
      
      // Message envoyé avec succès, créer la notification pour le destinataire
      try {
        await notificationService.createNotification({
          id: Date.now().toString(),
          type: 'new_message',
          title: 'Nouveau message',
          message: `Vous avez reçu un nouveau message de ${currentUser?.full_name || 'un utilisateur'}`,
          timestamp: new Date().toISOString(),
          read: false,
          data: {
            sender_id: currentUser?.id,
            receiver_id: receiverId,
            property_id: property?.id,
            message_id: result?.data?.[0]?.id || Date.now().toString(),
            property_name: property?.title || 'Propriété'
          },
          user_id: receiverId
        });
    } catch (notifError) {
      console.error('[ChatScreen] Erreur lors de la création de la notification:', notifError);
      // Continuer même si la notification échoue
    }
    
    // Mettre à jour l'interface utilisateur
    setNewMessage('');
    
    // Informer les autres composants qu'un message a été envoyé
    eventEmitter.emit('messageSent', {
      message: result?.data?.[0] || { id: Date.now().toString(), content: newMessage },
      propertyId: property?.id,
      senderId: currentUser?.id,
      receiverId: receiverId
    });
    
    // Forcer le rafraîchissement des conversations dans MessagesScreen
    eventEmitter.emit('conversationsRefresh');
    
    // Rafraîchir les messages pour voir le nouveau message
    loadMessages();
  } catch (error) {
    console.error('[ChatScreen] Erreur lors de l\'envoi du message:', error);
    Alert.alert('Erreur', 'Impossible d\'envoyer le message. Veuillez réessayer.');
  } finally {
    setSending(false);
  }
  };
  
  // Fonction de rendu pour les éléments de la FlatList
  const renderItem = ({ item }) => (
    <Message item={item} currentUser={currentUser} styles={styles} />
  );
  
  return (
    <SafeAreaView style={styles.container}>
      {isWeb ? (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.webScrollView}
          contentContainerStyle={styles.messageList}
        >
          {loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Aucun message. Commencez la conversation !
              </Text>
            </View>
          ) : (
            messages.map((item) => (
              <Message 
                key={item.id} 
                item={item} 
                currentUser={currentUser} 
                styles={styles} 
              />
            ))
          )}
        </ScrollView>
      ) : (
        <FlatList
          ref={scrollViewRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={true}
          inverted={false}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          onContentSizeChange={() => {
            if (scrollViewRef.current && messages.length > 0) {
              scrollViewRef.current.scrollToEnd({ animated: true });
            }
          }}
          onLayout={() => {
            if (scrollViewRef.current && messages.length > 0) {
              scrollViewRef.current.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Aucun message. Commencez la conversation !
                </Text>
              </View>
            )
          }
        />
      )}
      
      {/* Zone de saisie */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Écrivez votre message..."
            placeholderTextColor="#AAAAAA"
            style={styles.input}
            multiline={!isWeb}
            onSubmitEditing={isWeb && newMessage.trim() ? sendMessage : undefined}
            returnKeyType={isWeb ? "send" : "default"}
          />
          <Pressable
            onPress={sendMessage}
            disabled={sending || !newMessage.trim()}
            style={[
              styles.sendButton,
              (sending || !newMessage.trim()) && styles.sendButtonDisabled
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>→</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ChatScreen;
