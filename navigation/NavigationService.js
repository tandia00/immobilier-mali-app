import { createNavigationContainerRef } from '@react-navigation/native';
import { Platform, CommonActions } from 'react-native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  console.log('[NavigationService] Appel de la fonction navigate avec', name, 'et params:', params);
  
  // Si on tente de naviguer vers PropertyDetails et que la navigation est bloquée, ne rien faire
  if (name === 'PropertyDetails' && params?.blockPropertyNavigation) {
    console.log('[NavigationService] Navigation vers PropertyDetails bloquée par flag');
    return;
  }

  if (navigationRef.isReady()) {
    try {
      if (name === 'PaymentInfoScreen') {
        // Pour PaymentInfoScreen, nous naviguons vers le profil car c'est là que se trouve la configuration de paiement
        console.log('[NavigationService] Navigation vers PaymentInfoScreen via Profile');
        navigationRef.navigate('MainApp', {
          screen: 'Profile',
          params: {
            screen: 'PaymentInfoScreen',
            initial: false
          }
        });
      } else if (name === 'PaymentScreen') {
        // Pour PaymentScreen, nous naviguons directement car il est défini dans AppNavigator
        console.log('[NavigationService] Navigation directe vers PaymentScreen');
        if (navigationRef.isReady()) {
          try {
            navigationRef.dispatch(
              CommonActions.navigate({
                name: 'PaymentScreen',
                params: params
              })
            );
            console.log('[NavigationService] Navigation vers PaymentScreen effectuée');
          } catch (error) {
            console.error('[NavigationService] Erreur lors de la navigation vers PaymentScreen:', error);
          }
        } else {
          console.log('[NavigationService] Navigation non prête pour PaymentScreen');
        }
      } else if (name === 'PaymentInfo') {
        // Ancienne méthode - maintenir pour la compatibilité
        console.log('[NavigationService] Navigation vers PaymentInfo (méthode dépréciée)');
        navigationRef.navigate(name, params);
      } else {
        navigationRef.navigate(name, params);
      }
      
      console.log('[NavigationService] Navigation effectuée');
      console.log('[NavigationService] État après navigation:', navigationRef.getState());
    } catch (error) {
      console.error('[NavigationService] Erreur lors de la navigation:', error);
    }
  } else {
    console.log('[NavigationService] Navigation non prête');
  }
}

export function reset(routes = [], index = 0) {
  console.log('[NavigationService] Appel de la fonction reset avec routes:', routes);
  if (navigationRef.isReady()) {
    console.log('[NavigationService] Réinitialisation de la navigation avec routes:', routes);
    navigationRef.reset({
      index,
      routes,
    });
    console.log('[NavigationService] État après réinitialisation:', navigationRef.getState());
  } else {
    console.log('[NavigationService] Réinitialisation non prête');
  }
}

export function navigateToMessagesList(params = {}) {
  console.log('[NavigationService] ====== DÉBUT NAVIGATION VERS MESSAGES ======');
  
  if (navigationRef.isReady()) {
    try {
      // Récupérer l'état actuel de la navigation
      const currentState = navigationRef.getState();
      console.log('[NavigationService] État actuel:', currentState);

      // Si nous sommes déjà dans MessagesList, ne rien faire
      if (currentState.routes[currentState.index].name === 'MessagesList') {
        console.log('[NavigationService] Déjà dans MessagesList, pas de navigation nécessaire');
        return;
      }

      // Sinon, réinitialiser la navigation vers MessagesList
      navigationRef.reset({
        index: 0,
        routes: [
          {
            name: 'MainApp',
            params: {
              screen: 'Messages',
              params: {
                screen: 'MessagesList',
                params: {
                  ...params,
                  forceClearStates: true,
                  timestamp: Date.now(),
                  // Ajouter un flag pour indiquer que nous venons de la réinitialisation
                  fromReset: true
                }
              }
            }
          }
        ]
      });
      
      console.log('[NavigationService] Navigation vers MessagesList effectuée avec succès');
    } catch (error) {
      console.error('[NavigationService] Erreur lors de la navigation vers MessagesList:', error);
    }
  } else {
    console.log('[NavigationService] Navigation non prête');
  }
  
  console.log('[NavigationService] ====== FIN NAVIGATION VERS MESSAGES ======');
}

export function navigateToChat(params) {
  console.log('[NavigationService] ====== DÉBUT NAVIGATION VERS CHAT ======');
  
  // Si le blocage de navigation est actif, ne rien faire
  if (params.blockPropertyNavigation) {
    console.log('[NavigationService] Navigation vers Chat bloquée par flag');
    return;
  }

  // Enrichir les paramètres avec les informations de navigation
  const enhancedParams = {
    ...params,
    timestamp: Date.now(),
    navigationSource: 'navigateToChat'
  };
  
  // Si la navigation vient de PropertyDetails, utiliser une approche standard
  if (params.fromPropertyDetails) {
    try {
      console.log('[NavigationService] Navigation depuis PropertyDetails vers Chat');
      
      if (navigationRef.isReady()) {
        // Utiliser une navigation standard pour préserver les paramètres
        navigationRef.navigate('MainApp', {
          screen: 'Messages',
          params: {
            screen: 'Chat',
            params: enhancedParams
          }
        });
      }
      
      return;
    } catch (error) {
      console.error('[NavigationService] Erreur lors de la navigation depuis PropertyDetails:', error);
    }
  }
  
  // Pour les autres cas, utiliser une navigation directe
  if (navigationRef.isReady()) {
    try {
      navigationRef.navigate('MainApp', {
        screen: 'Messages',
        params: {
          screen: 'Chat',
          params: enhancedParams
        }
      });
      console.log('[NavigationService] Navigation vers Chat effectuée avec succès');
    } catch (error) {
      console.error('[NavigationService] Erreur lors de la navigation vers Chat:', error);
      
      // Approche simplifiée en cas d'erreur
      try {
        navigationRef.navigate('MainApp');
        setTimeout(() => {
          navigationRef.navigate('Messages');
          setTimeout(() => {
            navigationRef.navigate('Chat', enhancedParams);
          }, 100);
        }, 100);
      } catch (e) {
        console.error('[NavigationService] Erreur fallback navigation:', e);
      }
    }
  } else {
    console.log('[NavigationService] Navigation non prête');
  }
  
  console.log('[NavigationService] ====== FIN NAVIGATION VERS CHAT ======');
}

export function navigateToPropertyDetails(params = {}) {
  console.log('[NavigationService] ====== DÉBUT NAVIGATION VERS PROPERTY DETAILS ======');
  
  // Si le blocage de navigation est actif, ne rien faire
  if (params.blockPropertyNavigation) {
    console.log('[NavigationService] Navigation vers PropertyDetails bloquée par flag');
    return;
  }

  // Enrichir les paramètres avec les informations de navigation
  const enhancedParams = {
    ...params,
    timestamp: Date.now(),
    navigationSource: 'navigateToPropertyDetails'
  };
  
  if (navigationRef.isReady()) {
    try {
      console.log('[NavigationService] Navigation vers PropertyDetails');
      
      // Utiliser une approche standard pour la navigation
      navigationRef.navigate('MainApp', {
        screen: 'PropertyDetails',
        params: enhancedParams
      });
      
    } catch (error) {
      console.error('[NavigationService] Erreur lors de la navigation vers PropertyDetails:', error);
    }
  } else {
    console.log('[NavigationService] Navigation non prête');
  }
}

export function isInChatScreen() {
  console.log('[NavigationService] Appel de la fonction isInChatScreen');
  if (navigationRef.isReady()) {
    const currentRoute = navigationRef.getCurrentRoute();
    console.log('[NavigationService] État actuel de la navigation:', currentRoute);
    console.log('[NavigationService] État actuel de la navigation après vérification:', navigationRef.getState());
    return currentRoute?.name === 'Chat';
  }
  console.log('[NavigationService] Navigation non prête pour vérification');
  return false;
}

export function getCurrentRoute() {
  console.log('[NavigationService] Appel de la fonction getCurrentRoute');
  if (navigationRef.isReady()) {
    const currentRoute = navigationRef.getCurrentRoute();
    console.log('[NavigationService] Route actuelle:', currentRoute);
    console.log('[NavigationService] État actuel de la navigation après récupération de la route:', navigationRef.getState());
    return currentRoute;
  }
  console.log('[NavigationService] Navigation non prête pour récupération de la route');
  return null;
}

export function getState() {
  console.log('[NavigationService] Appel de la fonction getState');
  if (navigationRef.isReady()) {
    const state = navigationRef.getState();
    console.log('[NavigationService] État actuel de la navigation:', state);
    console.log('[NavigationService] État actuel de la navigation après récupération de l\'état:', navigationRef.getState());
    return state;
  }
  console.log('[NavigationService] Navigation non prête pour récupération de l\'état');
  return null;
}

export function goBack() {
  console.log('[NavigationService] Appel de la fonction goBack');
  
  if (Platform.OS === 'web') {
    console.log('[NavigationService] Exécution de goBack sur le web');
    
    if (navigationRef.isReady()) {
      // Vérifier si nous sommes dans un écran de chat
      const currentRoute = getCurrentRoute();
      console.log('[NavigationService] Route actuelle sur le web:', currentRoute?.name);
      
      if (currentRoute?.name === 'Chat') {
        console.log('[NavigationService] Web: Retour depuis Chat vers Messages');
        // Forcer la navigation vers Messages depuis le chat
        navigateToMessagesList();
        return;
      }
      
      navigationRef.goBack();
      console.log('[NavigationService] État après aller en arrière (web):', navigationRef.getState());
    } else {
      console.log('[NavigationService] Navigation non prête pour aller en arrière (web)');
    }
    return;
  }
  
  if (navigationRef.isReady()) {
    navigationRef.goBack();
    console.log('[NavigationService] État après aller en arrière:', navigationRef.getState());
  } else {
    console.log('[NavigationService] Navigation non prête pour aller en arrière');
  }
}

export function resetToMain() {
  console.log('[NavigationService] Réinitialisation vers l\'écran principal');
  if (navigationRef.isReady()) {
    try {
      // Utiliser une approche radicale pour réinitialiser la navigation
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'MainApp' }],
        })
      );
      console.log('[NavigationService] Navigation réinitialisée vers MainApp');
    } catch (error) {
      console.error('[NavigationService] Erreur lors de la réinitialisation:', error);
    }
  } else {
    console.log('[NavigationService] Navigation non prête pour la réinitialisation');
  }
}
