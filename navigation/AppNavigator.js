import React, { useState, useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { eventEmitter } from '../lib/EventEmitterModule';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';
import { navigationRef } from './NavigationService';
import { Platform } from 'react-native';

import SignInScreen from '../screens/SignInScreen';
import SignUpScreen from '../screens/SignUpScreen';
import TabNavigator from './TabNavigator';
import PropertyDetailsScreen from '../screens/PropertyDetailsScreen';
import SellerReviewScreen from '../screens/SellerReviewScreen';
import AdminReportsScreen from '../screens/AdminReportsScreen';
import EditPropertyScreen from '../screens/EditPropertyScreen';
import AdminScreen from '../screens/AdminScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SearchHistoryScreen from '../screens/SearchHistoryScreen';
import ManageCardsScreen from '../screens/ManageCardsScreen';
import AddCardScreen from '../screens/AddCardScreen';
import EditCardScreen from '../screens/EditCardScreen';
import PaymentInfoScreen from '../screens/PaymentInfoScreen';
import PaymentScreen from '../screens/PaymentScreen';
import TransactionDetailsScreen from '../screens/TransactionDetailsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ReceiptScreen from '../screens/ReceiptScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const [session, setSession] = useState(null);
  const { isDark, colors } = useTheme();
  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Écouteur d'événements pour la navigation vers PaymentScreen
    const paymentScreenListener = eventEmitter.addListener('navigateToPaymentScreen', (params) => {
      console.log('[AppNavigator] Événement navigateToPaymentScreen reçu avec params:', params);
      if (navigationRef.isReady()) {
        navigationRef.navigate('PaymentScreen', params);
      } else {
        console.error('[AppNavigator] Navigation non prête pour naviguer vers PaymentScreen');
      }
    });

    return () => {
      subscription.unsubscribe();
      paymentScreenListener.remove();
    };
  }, []);

  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  if (!session) {
    return (
      <NavigationContainer
        theme={isDark ? customDarkTheme : customLightTheme}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  const screenOptions = {
    headerTitleAlign: 'center',
    headerStyle: {
      backgroundColor: colors.card,
    },
    headerTintColor: colors.text,
    // Configuration spécifique pour Android pour assurer que les boutons de retour fonctionnent
    ...(isAndroid && {
      headerBackVisible: true, // Activer le bouton de retour sur Android
      headerBackTitleVisible: false,
      headerLeftContainerStyle: {
        paddingLeft: 10,
      }
    }),
    // Configuration spécifique pour iOS pour assurer que les boutons de retour fonctionnent
    ...(Platform.OS === 'ios' && {
      headerBackVisible: true, // Activer le bouton de retour sur iOS
      headerBackTitleVisible: true,
      headerBackTitle: 'Retour'
    })
  };

  return (
    <NavigationContainer
      theme={isDark ? customDarkTheme : customLightTheme}
      ref={navigationRef}
    >
      <Stack.Navigator
        screenOptions={screenOptions}
      >
        <Stack.Screen
          name="MainApp"
          component={TabNavigator}
          options={{ headerShown: false }}
        />

        {/* Écrans modaux pour la gestion des propriétés */}
        <Stack.Group screenOptions={{ presentation: 'modal' }}>
          <Stack.Screen 
            name="PropertyDetails" 
            component={PropertyDetailsScreen}
            options={{ title: 'Détails de la propriété' }}
          />
          <Stack.Screen 
            name="SellerReview" 
            component={SellerReviewScreen}
            options={{ title: 'Avis vendeur' }}
          />
          <Stack.Screen 
            name="AdminReports" 
            component={AdminReportsScreen}
            options={{ title: 'Rapports' }}
          />
          <Stack.Screen 
            name="EditProperty" 
            component={EditPropertyScreen}
            options={{ title: 'Modifier l\'annonce' }}
          />
        </Stack.Group>

        <Stack.Screen 
          name="PaymentInfo" 
          component={PaymentInfoScreen}
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Informations de paiement'
          }}
        />

        <Stack.Screen 
          name="PaymentScreen"
          component={PaymentScreen}
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Paiement'
          }}
        />

        <Stack.Screen 
          name="Receipt"
          component={ReceiptScreen}
          options={{
            presentation: 'modal',
            headerShown: true,
            headerTitle: 'Récépissé de paiement'
          }}
        />

        {/* Écrans modaux pour les paramètres */}
        <Stack.Group screenOptions={{ presentation: 'modal' }}>
          <Stack.Screen 
            name="Admin" 
            component={AdminScreen}
            options={{ title: 'Administration' }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{
              title: 'Paramètres',
            }}
          />
          <Stack.Screen 
            name="SearchHistory" 
            component={SearchHistoryScreen}
          />
          <Stack.Screen 
            name="ManageCards" 
            component={ManageCardsScreen}
            options={{
              title: 'Gérer vos cartes',
              headerBackTitle: 'Retour'
            }}
          />
          <Stack.Screen 
            name="AddCard" 
            component={AddCardScreen}
            options={{
              title: 'Ajouter une carte',
              headerBackTitle: 'Retour'
            }}
          />
          <Stack.Screen 
            name="EditCard" 
            component={EditCardScreen}
            options={{
              title: 'Modifier la carte',
              headerBackTitle: 'Retour'
            }}
          />
          <Stack.Screen 
            name="Reports" 
            component={ReportsScreen}
            options={{ title: 'Signalements' }}
          />
          <Stack.Screen 
            name="Notifications" 
            component={NotificationsScreen}
            options={{
              title: 'Notifications',
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
            }}
          />
        </Stack.Group>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function TabNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Accueil') {
            iconName = 'home';
          } else if (route.name === 'Messages') {
            iconName = 'message';
          } else if (route.name === 'Profil') {
            iconName = 'person';
          }
          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      })}
    >
      <Tab.Screen
        name="Accueil"
        component={HomeStack}
        options={{ headerShown: false }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
      />
      <Tab.Screen
        name="Profil"
        component={NewProfileScreen}
      />
    </Tab.Navigator>
  );
}
