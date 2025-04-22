import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { eventEmitter } from '../lib/EventEmitterModule';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Les imports liés à la navigation seront dynamiques si besoin

// Clé pour stocker les IDs des messages lus dans AsyncStorage
const VIEWED_MESSAGES_STORAGE_KEY = 'viewedMessageIds';

/**
 * Hook personnalisé pour suivre le nombre total de messages non lus
 * @returns {number} Le nombre total de messages non lus
 */
export default function useUnreadMessagesCount(withNavigation = false) {
  // Hooks liés à la navigation (dynamiques)
  let navigation, isFocused;
  if (withNavigation) {
    // Import dynamique pour éviter l'erreur hors NavigationContainer
    // eslint-disable-next-line global-require
    const nav = require('@react-navigation/native');
    navigation = nav.useNavigation();
    isFocused = nav.useIsFocused();
  }
  const [unreadCount, setUnreadCount] = useState(0);
  const viewedMessageIdsRef = useRef(new Set());
  const lastFetchTimeRef = useRef(0);
  const isInitializedRef = useRef(false);

  const fetchUnreadCountRef = useRef(null);

  // Fonction pour charger les IDs des messages lus depuis AsyncStorage
  const loadViewedMessageIds = async () => {
    try {
      const storedIds = await AsyncStorage.getItem(VIEWED_MESSAGES_STORAGE_KEY);
      if (storedIds) {
        const parsedIds = JSON.parse(storedIds);
        
        // Mettre à jour notre référence locale
        viewedMessageIdsRef.current = new Set(parsedIds);
      }
    } catch (error) {
      console.error('[useUnreadMessagesCount] Erreur chargement IDs messages lus:', error);
    }
  };

  // Fonction pour sauvegarder les IDs des messages lus dans AsyncStorage
  const saveViewedMessageIds = async () => {
    try {
      const idsArray = Array.from(viewedMessageIdsRef.current);
      await AsyncStorage.setItem(VIEWED_MESSAGES_STORAGE_KEY, JSON.stringify(idsArray));
    } catch (error) {
      console.error('[useUnreadMessagesCount] Erreur sauvegarde IDs messages lus:', error);
    }
  };

  // Logs désactivés pour réduire le bruit dans la console
  // useEffect(() => {
  //   console.log('[useUnreadMessagesCount] Compteur actuel:', unreadCount);
  // }, [unreadCount]);

  // Effet pour mettre à jour le compteur lorsque l'écran est focalisé
  useEffect(() => {
    if (withNavigation && isFocused) {
      console.log('[useUnreadMessagesCount] Écran focalisé, mise à jour du compteur');
      if (fetchUnreadCountRef.current) {
        fetchUnreadCountRef.current(true);
      }
    }
  }, [withNavigation, isFocused]);

  // Effet pour surveiller les changements de route et mettre à jour le compteur
  useEffect(() => {
    if (!withNavigation || !navigation) return;
    // Utiliser l'événement 'state' pour détecter les changements de route
    const unsubscribe = navigation.addListener('state', (e) => {
      // Utiliser le paramètre e pour obtenir l'information sur la route actuelle si disponible
      console.log('[useUnreadMessagesCount] Changement de route détecté');
      
      // Mettre à jour le compteur après un court délai pour s'assurer que les mises à jour de la BDD sont prises en compte
      if (fetchUnreadCountRef.current) {
        setTimeout(() => fetchUnreadCountRef.current(true), 500);
      }
    });

    return unsubscribe;
  }, [withNavigation, navigation]);

  // Fonction pour récupérer le nombre total de messages non lus
  const fetchUnreadCount = async (forceRefresh = false) => {
    try {
      // Si nous n'avons pas encore chargé les IDs depuis AsyncStorage, attendre
      if (!isInitializedRef.current) {
        console.log('[useUnreadMessagesCount] Non initialisé, attente...');
        return;
      }

      // Limiter les requêtes trop fréquentes (pas plus d'une fois toutes les 500ms)
      // Sauf si forceRefresh est true
      const now = Date.now();
      if (!forceRefresh && now - lastFetchTimeRef.current < 500) {
        console.log('[useUnreadMessagesCount] Requête trop fréquente, ignorée');
        return;
      }
      lastFetchTimeRef.current = now;

      // Vérifier si l'utilisateur est connecté
      let user;
      try {
        const { data, error: userError } = await supabase.auth.getUser();
        user = data?.user;
        
        if (userError || !user) {
          // Utiliser un log moins visible pour éviter de polluer la console
          console.debug('[useUnreadMessagesCount] Utilisateur non connecté ou erreur:', userError);
          return;
        }
      } catch (authError) {
        // Capturer spécifiquement les erreurs AuthSessionMissingError
        if (authError.message && authError.message.includes('Auth session missing')) {
          console.debug('[useUnreadMessagesCount] Session d\'authentification manquante');
        } else {
          console.error('[useUnreadMessagesCount] Erreur d\'authentification:', authError);
        }
        return;
      }

      // Récupérer tous les messages non lus pour l'utilisateur actuel
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, read, receiver_id')
        .eq('receiver_id', user.id)
        .eq('read', false);

      if (error) {
        console.error('[useUnreadMessagesCount] Erreur récupération messages:', error);
        return;
      }

      // Filtrer les messages déjà vus localement
      const unreadMessages = messages.filter(msg => !viewedMessageIdsRef.current.has(msg.id));
      const newCount = unreadMessages.length;

      // Mettre à jour le compteur si nécessaire
      setUnreadCount(newCount);
      console.log(`[useUnreadMessagesCount] Compteur mis à jour: ${newCount} messages non lus`);
    } catch (error) {
      console.error('[useUnreadMessagesCount] Erreur lors du comptage des messages non lus:', error);
    }
  };

  // Stocker la référence à la fonction pour qu'elle soit accessible partout
  fetchUnreadCountRef.current = fetchUnreadCount;
  
  // Exposer la fonction pour permettre son appel depuis d'autres composants
  if (typeof window !== 'undefined') {
    window.refreshUnreadMessagesCount = () => fetchUnreadCount(true);
  }

  useEffect(() => {
    // Initialiser en chargeant les IDs depuis AsyncStorage
    const initialize = async () => {
      await loadViewedMessageIds();
      isInitializedRef.current = true;
      if (fetchUnreadCountRef.current) {
        fetchUnreadCountRef.current();
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    // Abonnement aux changements dans la table des messages
    const subscription = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('[useUnreadMessagesCount] Changement détecté dans les messages:', payload.eventType);
          // Forcer le rafraîchissement pour les nouveaux messages
          if (payload.eventType === 'INSERT') {
            if (fetchUnreadCountRef.current) {
              fetchUnreadCountRef.current(true);
            }
          } else {
            if (fetchUnreadCountRef.current) {
              fetchUnreadCountRef.current();
            }
          }
        }
      )
      .subscribe();

    // Rafraîchir le compteur quand l'application revient au premier plan
    const focusListener = eventEmitter.addListener('appFocused', () => {
      console.log('[useUnreadMessagesCount] Application focalisée, mise à jour du compteur');
      if (fetchUnreadCountRef.current) {
        fetchUnreadCountRef.current(true);
      }
    });

    return () => {
      subscription.unsubscribe();
      focusListener.remove();
    };
  }, []);

  useEffect(() => {
    // Écouter les événements de messages lus
    const handleMessagesRead = (data) => {
      console.log('[useUnreadMessagesCount] Événement messagesRead reçu:', data);
      
      if (!data || !data.messageIds || data.messageIds.length === 0) {
        console.log('[useUnreadMessagesCount] Aucun ID de message trouvé dans l\'événement messagesRead');
        return;
      }
      
      // Mettre à jour notre ensemble local de messages lus
      data.messageIds.forEach(id => viewedMessageIdsRef.current.add(id));
      
      // Sauvegarder les IDs mis à jour dans AsyncStorage
      saveViewedMessageIds();
      
      // Mettre à jour le compteur immédiatement
      if (fetchUnreadCountRef.current) {
        fetchUnreadCountRef.current(true);
        
        // Mettre à jour le compteur après un court délai pour s'assurer que les mises à jour de la BDD sont prises en compte
        setTimeout(() => {
          if (fetchUnreadCountRef.current) {
            fetchUnreadCountRef.current(true);
          }
        }, 1000);
      }
    };
      
    const handleChatOpened = (data) => {
      console.log('[useUnreadMessagesCount] Événement chatOpened reçu:', data);
      // Forcer une mise à jour du compteur
      if (fetchUnreadCountRef.current) {
        fetchUnreadCountRef.current(true);
      }
    };
    
    const handleGlobalRefresh = () => {
      console.log('[useUnreadMessagesCount] Événement globalUnreadCountRefresh reçu');
      if (fetchUnreadCountRef.current) {
        fetchUnreadCountRef.current(true);
      }
    };

    const messagesReadListener = eventEmitter.addListener('messagesRead', handleMessagesRead);
    const chatOpenedListener = eventEmitter.addListener('chatOpened', handleChatOpened);
    const globalRefreshListener = eventEmitter.addListener('globalUnreadCountRefresh', handleGlobalRefresh);
    const newMessageListener = eventEmitter.addListener('newMessage', () => {
      if (fetchUnreadCountRef.current) {
        fetchUnreadCountRef.current(true);
      }
    });

    return () => {
      messagesReadListener.remove();
      chatOpenedListener.remove();
      globalRefreshListener.remove();
      newMessageListener.remove();
    };
  }, []);

  return unreadCount;
}
