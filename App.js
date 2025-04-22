import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider as ElementsThemeProvider } from 'react-native-elements';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { UnreadMessagesProvider } from './context/UnreadMessagesContext';
import { logger } from './config/logging';
// Temporairement désactivé en raison de problèmes de compatibilité
// import { Provider as PaperProvider } from 'react-native-paper';
import { AppState, Platform, Alert, Text } from 'react-native';
import { eventEmitter } from './lib/EventEmitterModule';
import { navigationRef } from './navigation/NavigationService';
import * as Linking from 'expo-linking';

import TabNavigator from './navigation/TabNavigator';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import FavoritesScreen from './screens/FavoritesScreen';
import PropertyDetailsScreen from './screens/PropertyDetailsScreen';
import MyPropertiesScreen from './screens/MyPropertiesScreen';
import AddPropertyScreen from './screens/AddPropertyScreen';
import ChatScreen from './screens/ChatScreen';
import PersonalInfoScreen from './screens/PersonalInfoScreen';
import SellerReviewScreen from './screens/SellerReviewScreen';
import PaymentScreen from './screens/PaymentScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { isDarkMode, colors } = useTheme();

  useEffect(() => {
    // Désactiver les logs verbeux de React Native
    if (__DEV__) {
      // En mode développement, on peut conserver certains logs utiles
      const originalConsoleLog = console.log;
      console.log = (...args) => {
        // Filtrer les logs de Supabase et des notifications
        const logString = args.join(' ');
        if (logString.includes('GoTrueClient') || 
            (logString.includes('NotificationService') && !logString.includes('ERROR')) || 
            logString.includes('NOBRIDGE')) {
          return; // Ne pas afficher ces logs
        }
        originalConsoleLog(...args);
      };
    }
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        logger.info('[App] Application revenue au premier plan, rafraîchissement des compteurs');
        eventEmitter.emit('appFocused');
        eventEmitter.emit('globalUnreadCountRefresh');
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const screenOptions = Platform.select({
    web: {
      headerStyle: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
      },
      headerTintColor: '#000',
      headerShadowVisible: false,
    },
    default: {
      headerStyle: {
        backgroundColor: isDarkMode ? colors.background : '#FFFFFF',
      },
      headerTintColor: isDarkMode ? colors.text : '#000000',
      headerShadowVisible: false,
    }
  });

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MainApp"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ 
          title: 'Mes Favoris',
          headerBackTitle: 'Accueil'
        }}
      />
      <Stack.Screen
        name="PropertyDetails"
        component={PropertyDetailsScreen}
        options={{ 
          title: 'Détails du bien',
          headerBackTitle: 'Accueil'
        }}
      />
      <Stack.Screen
        name="MyListings"
        component={MyPropertiesScreen}
        options={{ 
          title: 'Mes Annonces',
          headerBackTitle: 'Accueil'
        }}
      />
      <Stack.Screen
        name="AddPropertyScreen"
        component={AddPropertyScreen}
        options={{ 
          title: 'Ajouter une annonce',
          headerBackTitle: 'Accueil'
        }}
      />
      <Stack.Screen
        name="ChatConversation"
        component={ChatScreen}
        options={{ 
          headerBackTitle: 'Accueil'
        }}
      />
      <Stack.Screen
        name="PersonalInfo"
        component={PersonalInfoScreen}
        options={{ 
          title: 'Informations personnelles',
          headerBackTitle: 'Profil'
        }}
      />
      <Stack.Screen
        name="SellerReview"
        component={SellerReviewScreen}
        options={({ route }) => ({ 
          title: route.params?.mode === 'report' ? 'Signaler' : 'Avis',
          headerBackTitle: 'Détails'
        })}
      />
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ 
          title: 'Paiement',
          headerBackTitle: 'Détails'
        }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  // Configuration du préfixe pour les liens profonds
  const prefix = Linking.createURL('/');
  const devPrefix = 'exp://172.20.10.5:19000/--/';
  
  // Configuration des liens pour la navigation
  const linking = {
    prefixes: [prefix, devPrefix, 'immobiliermali://'],
    config: {
      screens: {
        Login: 'login',
        Register: 'register',
        MainApp: {
          screens: {
            Home: 'home',
            Search: 'search',
            Messages: 'messages',
            Profile: 'profile',
          }
        },
        PropertyDetails: 'property/:id',
      },
    },
  };

  useEffect(() => {
    // Fonction pour gérer les liens entrants
    const handleDeepLink = (event) => {
      console.log('URL reçue:', event.url);
      
      // Vous pouvez ajouter ici une logique spécifique pour la confirmation d'email
      if (event.url.includes('confirm') || event.url.includes('verify')) {
        // Exemple : afficher une alerte pour confirmer la réception du lien
        Alert.alert(
          'Confirmation d\'email',
          'Votre email a été confirmé avec succès!',
          [{ text: 'OK' }]
        );
      }
    };

    // Configurer le gestionnaire pour les liens entrants
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Vérifier s'il y a une URL initiale (si l'app a été ouverte via un lien)
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('URL initiale:', url);
        // Traiter l'URL initiale
      }
    });

    // Nettoyage
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <UnreadMessagesProvider>
            <ElementsThemeProvider>
              {/* PaperProvider temporairement désactivé */}
                <NavigationContainer 
                  ref={navigationRef}
                  linking={linking}
                  fallback={<Text>Chargement...</Text>}
                >
                  <AppNavigator />
                </NavigationContainer>
            </ElementsThemeProvider>
          </UnreadMessagesProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
