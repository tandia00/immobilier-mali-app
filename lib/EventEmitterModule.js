import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

/**
 * Événements disponibles:
 * - messagesSent: Émis lorsqu'un message est envoyé depuis ChatScreen
 *   Données: { messageId, propertyId, senderId, receiverId, timestamp }
 * 
 * - messagesRead: Émis lorsque des messages sont marqués comme lus
 *   Données: { messageIds }
 * 
 * - globalUnreadCountRefresh: Émis pour rafraîchir le compteur global de messages non lus
 *   Données: aucune
 * 
 * - conversationsRefresh: Émis pour forcer le rechargement des conversations
 *   Données: { userId, timestamp }
 */
class EventEmitterModule {
  constructor() {
    this.listeners = new Map();
    this.pendingEvents = new Map(); // Pour stocker les événements émis avant que les écouteurs ne soient enregistrés
    this.debugMode = true; // Activer les logs pour le débogage
  }

  addListener(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(callback);
    
    if (this.debugMode) {
      console.log(`[EventEmitter] Écouteur ajouté pour l'événement "${eventName}" (total: ${this.listeners.get(eventName).size})`);
    }
    
    // Vérifier s'il y a des événements en attente pour cet écouteur
    if (this.pendingEvents.has(eventName)) {
      const pendingEvents = this.pendingEvents.get(eventName);
      if (pendingEvents.length > 0) {
        console.log(`[EventEmitter] Traitement de ${pendingEvents.length} événements en attente pour "${eventName}"`);
        pendingEvents.forEach(args => {
          callback(...args);
        });
        this.pendingEvents.set(eventName, []); // Vider les événements en attente
      }
    }
    
    return {
      remove: () => {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
          callbacks.delete(callback);
          if (this.debugMode) {
            console.log(`[EventEmitter] Écouteur supprimé pour l'événement "${eventName}" (restants: ${callbacks.size})`);
          }
          if (callbacks.size === 0) {
            this.listeners.delete(eventName);
          }
        }
      }
    };
  }

  removeListener(eventName, callback) {
    if (this.debugMode) {
      console.log(`[EventEmitter] removeListener appelé pour l'événement "${eventName}"`);
    }
    
    if (!this.listeners.has(eventName)) {
      console.warn(`[EventEmitter] Tentative de supprimer un écouteur pour l'événement "${eventName}" qui n'existe pas`);
      return;
    }
    
    const callbacks = this.listeners.get(eventName);
    if (callbacks) {
      callbacks.delete(callback);
      if (this.debugMode) {
        console.log(`[EventEmitter] Écouteur supprimé pour l'événement "${eventName}" (restants: ${callbacks.size})`);
      }
    }
  }

  emit(eventName, ...args) {
    const callbacks = this.listeners.get(eventName);
    const callbackCount = callbacks?.size || 0;
    
    console.log(`[EventEmitter] Émission de l'événement "${eventName}" avec ${callbackCount} écouteurs (${Platform.OS})`);
    
    if (callbacks && callbacks.size > 0) {
      callbacks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[EventEmitter] Erreur lors de l'exécution du callback pour "${eventName}":`, error);
        }
      });
    } else {
      // Stocker l'événement pour une exécution ultérieure si aucun écouteur n'est enregistré
      if (!this.pendingEvents.has(eventName)) {
        this.pendingEvents.set(eventName, []);
      }
      this.pendingEvents.get(eventName).push(args);
      console.log(`[EventEmitter] Aucun écouteur pour "${eventName}", événement mis en attente`);
    }
    
    // Pour iOS et Web, émettre un événement global qui peut être capturé par d'autres composants
    if (Platform.OS === 'ios' || Platform.OS === 'web') {
      if (global.dispatchEvent) {
        try {
          const event = new CustomEvent(`app:${eventName}`, { detail: args });
          global.dispatchEvent(event);
          console.log(`[EventEmitter] Événement global dispatché pour "${eventName}" sur ${Platform.OS}`);
        } catch (error) {
          console.error(`[EventEmitter] Erreur lors de la dispatch d'événement global:`, error);
        }
      }
    }
  }

  removeAllListeners(eventName) {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
    }
    console.log(`[EventEmitter] Tous les écouteurs ${eventName ? `pour "${eventName}"` : ''} ont été supprimés`);
  }
}

const eventEmitterModule = new EventEmitterModule();

export { eventEmitterModule as eventEmitter };
