import React, { useEffect, useState } from 'react';
import { View, Platform, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { notificationService } from '../services/NotificationService';

import HomeScreen from '../screens/HomeScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatScreen from '../screens/ChatScreen';
import NewProfileScreen from '../screens/NewProfileScreen';
import SettingsScreen from '../screens/SettingsScreen'; // Importation de l'écran Settings
import ManageCardsScreen from '../screens/ManageCardsScreen'; // Importation de l'écran ManageCards
import EditCardScreen from '../screens/EditCardScreen'; // Importation de l'écran EditCard
import PaymentInfoScreen from '../screens/PaymentInfoScreen';
import NotificationsScreen from '../screens/NotificationsScreen'; // Importation de l'écran Notifications
import AdminScreen from '../screens/AdminScreen'; // Importer l'écran Admin
import AdminUsersScreen from '../screens/AdminUsersScreen';
import TabBarBadge from '../components/TabBarBadge';
import { useUnreadMessages } from '../context/UnreadMessagesContext';
import { eventEmitter } from '../lib/EventEmitterModule';
import { useTheme } from '../context/ThemeContext';
import * as NavigationService from './NavigationService';
import { supabase } from '../config/supabase';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="HomeScreen"
      component={HomeScreen}
      options={{
        title: 'Accueil',
        headerShown: true
      }}
    />
  </Stack.Navigator>
);

const MessagesStack = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const isWeb = Platform.OS === 'web';
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', (e) => {
      // Récupérer l'état actuel de la navigation
      const state = navigation.getState();
      const currentRoute = state.routes[state.index];
      
      // Si nous sommes déjà dans MessagesList, ne rien faire
      if (currentRoute.name === 'MessagesList') {
        return;
      }
      
      // Sinon, réinitialiser la navigation vers MessagesList
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MessagesList'
          }
        ]
      });
    });

    return unsubscribe;
  }, [navigation]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="MessagesList"
        component={MessagesScreen}
        options={{
          headerShown: false,
          title: 'Messages',
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: true,
          title: 'Chat',
        }}
      />
    </Stack.Navigator>
  );
};

const ProfileStack = () => {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={NewProfileScreen}
        options={{
          title: 'Profil',
          headerShown: true
        }}
      />
      <Stack.Screen
        name="PaymentInfoScreen"
        component={PaymentInfoScreen}
        options={{
          title: 'Moyen de paiement',
          headerShown: true
        }}
      />
      <Stack.Screen
        name="ManageCards"
        component={ManageCardsScreen}
        options={{
          title: 'Gérer vos cartes',
          headerShown: true
        }}
      />
      <Stack.Screen
        name="EditCard"
        component={EditCardScreen}
        options={{
          title: 'Modifier la carte',
          headerShown: true
        }}
      />
      <Stack.Screen
        name="Admin"
        component={AdminScreen}
        options={{
          title: 'Administration',
          headerShown: true
        }}
      />
      <Stack.Screen
        name="SettingsScreen"
        component={SettingsScreen}
        options={{
          title: 'Paramètres',
          headerShown: true
        }}
      />
    </Stack.Navigator>
  );
};

const SettingsStack = () => {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="SettingsScreen"
        component={SettingsScreen}
        options={{
          title: 'Paramètres',
          headerShown: true,
          headerRight: () => null // Supprimer le badge de notification
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          headerShown: true
        }}
      />
      <Stack.Screen
        name="PaymentInfo"
        component={PaymentInfoScreen}
        options={{
          title: 'Informations de paiement',
          headerShown: true
        }}
      />
    </Stack.Navigator>
  );
};

const NotificationsStack = () => {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
      }}
    >
      <Stack.Screen
        name="NotificationsScreen"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
        }}
      />
    </Stack.Navigator>
  );
};

function TabNavigator() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const isWeb = Platform.OS === 'web';
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';
  const unreadMessagesCount = useUnreadMessages();
  const [isAdmin, setIsAdmin] = useState(true);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  
  // Variable pour suivre le dernier moment où les notifications ont été récupérées
  const [lastFetchTime, setLastFetchTime] = useState(0);
  
  // Récupérer le nombre de notifications non lues
  const fetchUnreadNotificationsCount = async (force = false) => {
    try {
      const now = Date.now();
      // Ne récupérer les notifications que si 5 secondes se sont écoulées depuis la dernière récupération
      // ou si force est true
      if (force || now - lastFetchTime > 5000) {
        console.log('[TabNavigator] Récupération des notifications non lues');
        const notifications = await notificationService.getAllNotifications();
        const unreadCount = notifications.filter(notification => !notification.read).length;
        setUnreadNotificationsCount(unreadCount);
        setLastFetchTime(now);
      } else {
        console.log('[TabNavigator] Récupération des notifications ignorée (trop fréquente)');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications non lues:', error);
    }
  };

  useEffect(() => {
    checkAdminStatus();
    fetchUnreadNotificationsCount();
    
    // Créer plusieurs écouteurs d'événements pour actualiser le compteur de notifications
    const subscriptions = [
      // Mettre à jour le compteur lorsque l'application est au premier plan
      eventEmitter.addListener('appFocused', () => fetchUnreadNotificationsCount(true)),
      
      // Mettre à jour le compteur lorsqu'une nouvelle notification est créée
      eventEmitter.addListener('notificationCreated', () => fetchUnreadNotificationsCount(true)),
      
      // Mettre à jour le compteur lorsqu'une notification est marquée comme lue
      eventEmitter.addListener('notificationRead', () => fetchUnreadNotificationsCount(true)),
      
      // Mettre à jour le compteur lorsqu'une notification est supprimée
      eventEmitter.addListener('notificationDeleted', () => fetchUnreadNotificationsCount(true)),
      
      // Mettre à jour le compteur lorsque toutes les notifications sont supprimées
      eventEmitter.addListener('allNotificationsDeleted', () => {
        console.log('[TabNavigator] Toutes les notifications ont été supprimées');
        setUnreadNotificationsCount(0);
        setLastFetchTime(Date.now());
      }),
      
      // Mettre à jour le compteur toutes les 60 secondes (réduit la fréquence)
      setInterval(() => fetchUnreadNotificationsCount(false), 60000)
    ];
    
    // Mettre à jour le compteur lorsque l'utilisateur navigue vers l'onglet Notifications
    const unsubscribeNavigation = navigation.addListener('tabPress', (e) => {
      if (e.target?.includes('Notifications')) {
        // Attendre un court instant pour que les notifications soient marquées comme lues
        setTimeout(() => fetchUnreadNotificationsCount(true), 500);
      }
    });
    
    return () => {
      // Nettoyer tous les écouteurs d'événements
      subscriptions.forEach(subscription => {
        if (typeof subscription === 'object' && subscription?.remove) {
          subscription.remove();
        } else if (typeof subscription === 'number') {
          clearInterval(subscription);
        }
      });
      unsubscribeNavigation();
    };
  }, [navigation]);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }

      // Vérifier si l'utilisateur a le rôle d'administrateur
      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (error) {
        // Si l'utilisateur n'a pas de rôle admin, c'est normal
        setIsAdmin(false);
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error('Erreur lors de la vérification des droits:', error);
      setIsAdmin(false);
    }
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingBottom: isIOS ? 0 : 8,
          paddingTop: isIOS ? 8 : 0,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: 'relative' }}>
              <MaterialIcons name="chat" size={size} color={color} />
              <TabBarBadge count={unreadMessagesCount} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
      {/* L'onglet Settings a été supprimé comme demandé */}
      <Tab.Screen
        name="Notifications"
        component={NotificationsStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: 'relative' }}>
              <MaterialIcons name="notifications" size={size} color={color} />
              <TabBarBadge count={unreadNotificationsCount} />
            </View>
          ),
        }}
      />
      {isAdmin && (
        <Tab.Screen
          name="AdminUsers"
          component={AdminUsersScreen}
          options={{
            title: 'Utilisateurs',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="people" size={size} color={color} />
            ),
            tabBarBadge: '!',
          }}
        />
      )}
    </Tab.Navigator>
  );
}

export default TabNavigator;
