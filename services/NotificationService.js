import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { eventEmitter } from '../lib/EventEmitterModule';
import { logger } from '../config/logging';

// Fonction pour générer un ID unique basé sur le timestamp
function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export class NotificationService {
  constructor() {
    this.prefix = 'notification_';
    this.currentUserId = null;
    this.currentDeletedNotificationIds = [];
    this.initUser();
  }

  // Exporter le préfixe pour une utilisation dans d'autres composants
  static get prefix() {
    return 'notification_';
  }

  // Initialiser l'ID de l'utilisateur actuel
  async initUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        // Si l'erreur est liée au token de rafraîchissement, essayer de récupérer la session
        if (error.message && error.message.includes('Refresh Token')) {
          logger.warn('[NotificationService] Problème de token de rafraîchissement, tentative de récupération de session');
          
          // Récupérer la session depuis le stockage local
          const session = await this.getStoredSession();
          
          if (session) {
            // Essayer de définir manuellement la session
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token
            });
            
            if (sessionError) {
              logger.error('[NotificationService] Échec de la récupération de session:', sessionError);
              // Si la récupération échoue, effacer la session stockée
              await AsyncStorage.removeItem('supabase.auth.token');
              return;
            }
            
            if (sessionData.user) {
              this.currentUserId = sessionData.user.id;
              logger.info('[NotificationService] Session récupérée, utilisateur:', this.currentUserId);
              return;
            }
          }
        }
        
        logger.error('[NotificationService] Erreur d\'authentification:', error);
        return;
      }
      
      if (user) {
        this.currentUserId = user.id;
        logger.info('[NotificationService] Utilisateur initialisé:', this.currentUserId);
      }
    } catch (error) {
      logger.error('[NotificationService] Erreur lors de l\'initialisation de l\'utilisateur:', error);
    }
  }
  
  // Récupérer la session stockée localement
  async getStoredSession() {
    try {
      const sessionStr = await AsyncStorage.getItem('supabase.auth.token');
      if (sessionStr) {
        return JSON.parse(sessionStr);
      }
      return null;
    } catch (error) {
      logger.error('[NotificationService] Erreur lors de la récupération de la session stockée:', error);
      return null;
    }
  }

  // Obtenir l'ID de l'utilisateur actuel
  async getCurrentUserId() {
    if (!this.currentUserId) {
      await this.initUser();
    }
    return this.currentUserId;
  }

  /**
   * Crée une nouvelle notification
   * @param {Object} notification - Objet de notification
   * @returns {Promise<string>} - ID de la notification créée
   */
  async createNotification(notification) {
    try {
      logger.info('[NotificationService] Création de notification:', notification.type, 'pour user_id:', notification.user_id);
      
      // Vérifier si l'utilisateur est connecté
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.warn('[NotificationService] Aucun utilisateur connecté');
        return null;
      }
      
      const currentUserId = user.id;
      
      // Si user_id est spécifié dans la notification, l'utiliser
      // Sinon, utiliser l'ID de l'utilisateur actuel
      const userId = notification.user_id || currentUserId;
      
      logger.info('[NotificationService] Notification pour userId:', userId, 'currentUserId:', currentUserId);
      
      // Pour les notifications de message, vérifier si on doit créer la notification
      if (notification.type === 'new_message') {
        // Si c'est une notification de message et que l'expéditeur est l'utilisateur actuel,
        // ne pas créer de notification (on ne veut pas être notifié de nos propres messages)
        if (notification.data && notification.data.sender_id === currentUserId) {
          logger.info('[NotificationService] Notification de message ignorée (expéditeur = utilisateur actuel)');
          return null;
        }
        
        // Si le destinataire n'est pas l'utilisateur actuel et que l'ID utilisateur n'est pas explicitement défini,
        // ne pas créer de notification (évite les notifications pour les messages destinés à d'autres utilisateurs)
        if (!notification.user_id && notification.data && notification.data.receiver_id !== currentUserId) {
          logger.info('[NotificationService] Notification de message ignorée (destinataire ≠ utilisateur actuel)');
          return null;
        }
      }
      
      // Générer un ID unique pour la notification
      const notificationId = generateUniqueId();
      
      // Créer l'objet de notification
      const newNotification = {
        id: notificationId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data || {},
        created_at: new Date().toISOString(),
        read: notification.read !== undefined ? notification.read : false,
        user_id: userId
      };
      
      // Vérifier si une notification similaire existe déjà (pour éviter les doublons)
      if (notification.type === 'new_message' && notification.data && notification.data.message_id) {
        const { data: existingNotifications, error: fetchError } = await supabase
          .from('notifications')
          .select('*')
          .eq('type', notification.type)
          .eq('user_id', userId)
          .contains('data', { message_id: notification.data.message_id });
        
        if (!fetchError && existingNotifications && existingNotifications.length > 0) {
          logger.info('[NotificationService] Notification similaire déjà existante, ignorée');
          return existingNotifications[0];
        }
      }
      
      // Enregistrer la notification dans Supabase
      const { data, error } = await supabase
        .from('notifications')
        .insert(newNotification);
      
      if (error) {
        logger.error('[NotificationService] Erreur lors de l\'enregistrement de la notification:', error.message);
        return null;
      }
      
      logger.info('[NotificationService] Notification créée avec succès:', notificationId);
      
      // Émettre un événement pour informer l'application qu'une nouvelle notification a été créée
      eventEmitter.emit('notificationCreated', newNotification);
      
      return newNotification;
    } catch (error) {
      logger.error('[NotificationService] Erreur lors de la création de la notification:', error.message);
      return null;
    }
  }

  /**
   * Supprime une notification
   * @param {string} notificationId - ID de la notification
   * @returns {Promise<void>}
   */
  async removeNotification(notificationId) {
    try {
      logger.info(`[NotificationService] Suppression de la notification ${notificationId}`);
      
      // Ajouter l'ID à la liste des notifications supprimées
      await this.addToDeletedNotifications(notificationId);
      
      // Mettre à jour la liste locale des notifications supprimées
      if (this.currentDeletedNotificationIds && !this.currentDeletedNotificationIds.includes(notificationId)) {
        this.currentDeletedNotificationIds.push(notificationId);
      }
      
      // Supprimer la notification de Supabase
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);
      
      if (error) {
        logger.error('[NotificationService] Erreur lors de la suppression de la notification:', error.message);
      } else {
        logger.info(`[NotificationService] Notification ${notificationId} supprimée avec succès`);
      }
      
      // Émettre un événement pour informer l'application qu'une notification a été supprimée
      eventEmitter.emit('notificationDeleted', notificationId);
    } catch (error) {
      logger.error('[NotificationService] Erreur lors de la suppression de la notification:', error.message);
    }
  }

  /**
   * Récupère les IDs des notifications supprimées pour l'utilisateur actuel
   * @returns {Promise<Array>} - Tableau des IDs de notifications supprimées
   */
  async getDeletedNotificationIds() {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) return [];
      
      const deletedIdsKey = `deleted_notifications_${currentUserId}`;
      const deletedIdsStr = await AsyncStorage.getItem(deletedIdsKey);
      
      if (deletedIdsStr) {
        // Vérifier si la liste est trop longue (plus de 20 éléments)
        // Si c'est le cas, la réinitialiser car cela pourrait bloquer l'affichage des nouvelles notifications
        const parsedIds = JSON.parse(deletedIdsStr);
        if (parsedIds.length > 20) {
          logger.info(`[NotificationService] Réinitialisation de la liste des notifications supprimées (${parsedIds.length} éléments)`);
          await AsyncStorage.setItem(deletedIdsKey, JSON.stringify([]));
          return [];
        }
        return parsedIds;
      }
      return [];
    } catch (error) {
      logger.error('[NotificationService] Erreur lors de la récupération des notifications supprimées:', error);
      // En cas d'erreur, réinitialiser la liste
      try {
        const currentUserId = await this.getCurrentUserId();
        if (currentUserId) {
          const deletedIdsKey = `deleted_notifications_${currentUserId}`;
          await AsyncStorage.setItem(deletedIdsKey, JSON.stringify([]));
          logger.info('[NotificationService] Liste des notifications supprimées réinitialisée suite à une erreur');
        }
      } catch (e) {
        logger.error('[NotificationService] Erreur lors de la réinitialisation de la liste:', e);
      }
      return [];
    }
  }

  /**
   * Ajoute un ID de notification à la liste des notifications supprimées
   * @param {string} notificationId - ID de la notification supprimée
   * @returns {Promise<void>}
   */
  async addToDeletedNotifications(notificationId) {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) return;
      
      const deletedIdsKey = `deleted_notifications_${currentUserId}`;
      const deletedIds = await this.getDeletedNotificationIds();
      
      if (!deletedIds.includes(notificationId)) {
        deletedIds.push(notificationId);
        await AsyncStorage.setItem(deletedIdsKey, JSON.stringify(deletedIds));
        logger.info(`[NotificationService] ID ${notificationId} ajouté à la liste des notifications supprimées`);
      }
    } catch (error) {
      logger.error('[NotificationService] Erreur lors de l\'ajout à la liste des notifications supprimées:', error);
    }
  }

  /**
   * Réinitialise la liste des notifications supprimées pour l'utilisateur actuel
   * @returns {Promise<void>}
   */
  async resetDeletedNotifications() {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) return;
      
      const deletedIdsKey = `deleted_notifications_${currentUserId}`;
      await AsyncStorage.setItem(deletedIdsKey, JSON.stringify([]));
      
      // Réinitialiser également la liste en mémoire
      this.currentDeletedNotificationIds = [];
      
      logger.info('[NotificationService] Liste des notifications supprimées réinitialisée avec succès');
      
      // Émettre un événement pour informer l'application que toutes les notifications ont été réinitialisées
      eventEmitter.emit('notificationsReset');
    } catch (error) {
      logger.error('[NotificationService] Erreur lors de la réinitialisation des notifications supprimées:', error);
    }
  }

  /**
   * Récupère toutes les notifications
   * @returns {Promise<Array>} - Tableau des notifications
   */
  async getAllNotifications() {
    try {
      logger.info('[NotificationService] Récupération de toutes les notifications');
      
      // Vérifier si l'utilisateur est connecté
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        logger.warn('[NotificationService] Aucun utilisateur connecté');
        return [];
      }
      
      // Récupérer la liste des notifications supprimées
      const deletedNotificationIds = await this.getDeletedNotificationIds();
      logger.info(`[NotificationService] ${deletedNotificationIds.length} notifications supprimées trouvées`);
      
      // Récupérer les notifications de l'utilisateur depuis Supabase
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        logger.error('[NotificationService] Erreur lors de la récupération des notifications:', error.message);
        return [];
      }
      
      // Filtrer les notifications supprimées
      const filteredNotifications = notifications.filter(notification => 
        !deletedNotificationIds.includes(notification.id)
      );
      
      logger.info(`[NotificationService] ${notifications.length} notifications récupérées, ${notifications.length - filteredNotifications.length} filtrées`);
      
      // Remplacer les notifications par les notifications filtrées
      notifications.length = 0;
      notifications.push(...filteredNotifications);
      
      logger.info(`[NotificationService] ${notifications.length} notifications filtrées pour l'utilisateur ${user.id}`);
      
      // Vérifier s'il y a des messages non lus et créer des notifications pour ces messages
      // même s'il y a déjà des notifications existantes
      const { data: unreadMessages, error: unreadError } = await supabase
        .from('messages')
        .select('*')
        .eq('receiver_id', user.id)
        .eq('read', false);
      
      // Stocker la liste des notifications supprimées dans une variable globale pour y accéder facilement
      this.currentDeletedNotificationIds = deletedNotificationIds;
      
      if (!unreadError && unreadMessages && unreadMessages.length > 0) {
        logger.info(`[NotificationService] ${unreadMessages.length} messages non lus trouvés, vérification des notifications`);
        
        // Récupérer les propriétés associées aux messages
        const propertyIds = [...new Set(unreadMessages.map(msg => msg.property_id))];
        const { data: properties, error: propertiesError } = await supabase
          .from('properties')
          .select('id, title')
          .in('id', propertyIds);
        
        if (!propertiesError && properties) {
          // Créer un map des propriétés pour un accès rapide
          const propertiesMap = properties.reduce((map, property) => {
            map[property.id] = property;
            return map;
          }, {});
          
          // Récupérer les IDs des messages qui ont déjà des notifications
          const existingMessageIds = notifications
            .filter(n => n.type === 'new_message' && n.data && n.data.message_id)
            .map(n => n.data.message_id);
          
          logger.info(`[NotificationService] ${existingMessageIds.length} messages ont déjà des notifications`);
          
          // Créer des notifications uniquement pour les messages qui n'en ont pas encore
          let newNotificationsCount = 0;
          for (const message of unreadMessages) {
            // Vérifier si ce message a déjà une notification
            if (existingMessageIds.includes(message.id)) {
              continue;
            }
            
            const property = propertiesMap[message.property_id];
            if (!property) continue;
            
            await this.createNotification({
              type: 'new_message',
              title: 'Message non lu',
              message: `Vous avez un message non lu concernant "${property.title}"`,
              data: {
                sender_id: message.sender_id,
                receiver_id: message.receiver_id,
                property_id: message.property_id,
                message_id: message.id,
                property_name: property.title
              },
              user_id: user.id,
              read: false
            });
            
            newNotificationsCount++;
          }
          
          logger.info(`[NotificationService] ${newNotificationsCount} nouvelles notifications créées`);
          
          // Si de nouvelles notifications ont été créées, récupérer à nouveau toutes les notifications
          if (newNotificationsCount > 0) {
            const { data: updatedNotifications, error: updatedError } = await supabase
              .from('notifications')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });
            
            if (!updatedError) {
              logger.info(`[NotificationService] ${updatedNotifications.length} notifications après création`);
              return updatedNotifications;
            }
          }
        }
      }
      
      return notifications;
    } catch (error) {
      logger.error('[NotificationService] Erreur lors de la récupération des notifications:', error.message);
      return [];
    }
  }

  /**
   * Marque une notification comme lue
   * @param {string} notificationId - ID de la notification
   * @returns {Promise<void>}
   */
  async markAsRead(notificationId) {
    try {
      // Vérifier d'abord dans Supabase
      try {
        const { data, error } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId);
          
        if (!error) {
          logger.info('[NotificationService] Notification marquée comme lue dans Supabase:', notificationId);
          // Émettre un événement pour signaler qu'une notification a été marquée comme lue
          eventEmitter.emit('notificationRead', notificationId);
          return;
        }
      } catch (supabaseError) {
        logger.info('[NotificationService] Erreur Supabase, vérification dans AsyncStorage:', supabaseError);
      }
      
      // Si la notification n'est pas dans Supabase, vérifier dans AsyncStorage
      const key = `${this.prefix}${notificationId}`;
      const notification = await AsyncStorage.getItem(key);
      
      if (notification) {
        const parsedNotification = JSON.parse(notification);
        parsedNotification.read = true;
        await AsyncStorage.setItem(key, JSON.stringify(parsedNotification));
        logger.info('[NotificationService] Notification marquée comme lue dans AsyncStorage:', notificationId);
        // Émettre un événement pour signaler qu'une notification a été marquée comme lue
        eventEmitter.emit('notificationRead', notificationId);
      }
    } catch (error) {
      logger.error('Erreur lors de la mise à jour de la notification:', error);
      throw error;
    }
  }

  /**
   * Supprime une notification
   * @param {string} notificationId - ID de la notification
   * @returns {Promise<void>}
   */
  async removeNotification(notificationId) {
    try {
      // Ajouter l'ID à la liste des notifications supprimées pour éviter qu'elle ne réapparaisse
      await this.addToDeletedNotifications(notificationId);
      
      // Essayer de supprimer dans Supabase d'abord
      let supabaseDeleted = false;
      try {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);
          
        if (!error) {
          logger.info('[NotificationService] Notification supprimée de Supabase:', notificationId);
          supabaseDeleted = true;
        }
      } catch (supabaseError) {
        logger.info('[NotificationService] Erreur Supabase, tentative de suppression dans AsyncStorage:', supabaseError);
      }
      
      // Toujours essayer de supprimer d'AsyncStorage, même si la suppression Supabase a réussi
      // (pour assurer la cohérence entre les deux stockages)
      try {
        await AsyncStorage.removeItem(`${this.prefix}${notificationId}`);
        logger.info('[NotificationService] Notification supprimée d\'AsyncStorage:', notificationId);
      } catch (asyncError) {
        logger.error('[NotificationService] Erreur lors de la suppression d\'AsyncStorage:', asyncError);
      }
      
      // Émettre un événement pour signaler qu'une notification a été supprimée
      eventEmitter.emit('notificationDeleted', notificationId);
    } catch (error) {
      logger.error('Erreur lors de la suppression de la notification:', error);
      throw error;
    }
  }

  /**
   * Récupère les notifications depuis Supabase
   * @param {string} userId - ID de l'utilisateur
   * @returns {Promise<Array>} - Tableau des notifications
   */
  async getSupabaseNotifications(userId) {
    try {
      // Vérifier si l'ID utilisateur est valide
      if (!userId) {
        logger.error('[NotificationService] ID utilisateur non valide pour récupérer les notifications');
        return [];
      }

      // Log pour débogage
      logger.info(`[NotificationService] Récupération des notifications pour l'utilisateur: ${userId}`);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Log du résultat
      if (data) {
        logger.info(`[NotificationService] ${data.length} notifications trouvées dans Supabase pour l'utilisateur ${userId}`);
      }
      
      return data || [];
    } catch (error) {
      logger.error('[NotificationService] Erreur lors de la récupération des notifications depuis Supabase:', error);
      return [];
    }
  }

  /**
   * Supprime toutes les notifications
   * @returns {Promise<void>}
   */
  async clearAllNotifications() {
    try {
      const currentUserId = await this.getCurrentUserId();
      if (!currentUserId) return;
      
      // Réinitialiser la liste des notifications supprimées
      await this.resetDeletedNotifications();
      
      // Supprimer de Supabase
      try {
        const { error } = await supabase
          .from('notifications')
          .delete()
          .eq('user_id', currentUserId);
          
        if (error) {
          logger.error('[NotificationService] Erreur lors de la suppression des notifications de Supabase:', error);
        } else {
          logger.info('[NotificationService] Toutes les notifications supprimées de Supabase');
        }
      } catch (supabaseError) {
        logger.error('[NotificationService] Erreur lors de la suppression des notifications de Supabase:', supabaseError);
      }
      
      // Supprimer d'AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const notificationKeys = keys.filter(key => key.startsWith(this.prefix));
      await Promise.all(notificationKeys.map(key => AsyncStorage.removeItem(key)));
      
      // Émettre un événement pour signaler que toutes les notifications ont été supprimées
      eventEmitter.emit('allNotificationsDeleted');
    } catch (error) {
      logger.error('Erreur lors de la suppression des notifications:', error);
      throw error;
    }
  }
}

// Exporter une instance du service
export const notificationService = new NotificationService();
