import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Text } from 'react-native-elements';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import NotificationBadge from '../components/NotificationBadge';
import NotificationsScreen from '../screens/NotificationsScreen';

export default function NewProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasProperties, setHasProperties] = useState(false);
  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: 35,
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 10,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    logoutButtonTop: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 8,
    },
    logoutTextTop: {
      color: '#FF3B30',
      fontSize: 14,
      marginLeft: 4,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    menuItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    menuItemIcon: {
      marginRight: 16,
    },
    menuItemTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    menuItemSubtitle: {
      fontSize: 14,
      opacity: 0.7,
      marginTop: 2,
      color: colors.text,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      marginTop: 20,
      marginBottom: 30,
      marginHorizontal: 20,
      backgroundColor: '#f8f8f8',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#FF3B30',
    },
    logoutText: {
      color: '#FF3B30',
      fontSize: 16,
      fontWeight: '500',
      marginLeft: 16,
    },
    scrollView: {
      flex: 1,
      paddingTop: 20,
    },
    scrollViewContent: {
      paddingBottom: 100, // Espace supplémentaire en bas
    },
    bottomSpacer: {
      height: 60, // Espace supplémentaire après le bouton de déconnexion
    }
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Récupérer le profil
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Vérifier si l'utilisateur est admin via la table user_roles
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .single();

        // Si on trouve un rôle admin, l'utilisateur est admin
        setIsAdmin(!roleError);

        // Vérifier si l'utilisateur a des annonces
        const { data: propertiesData, error: propertiesError } = await supabase
          .from('properties')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (propertiesError) throw propertiesError;
        setHasProperties(propertiesData && propertiesData.length > 0);
        
      } catch (error) {
        console.error('Error fetching profile:', error);
        setIsAdmin(false); // En cas d'erreur, on considère que l'utilisateur n'est pas admin
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    console.log('[NewProfileScreen] isAdmin:', isAdmin);
  }, [isAdmin]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    }
  };

  const handleAdminPress = () => {
    navigation.navigate('Admin');
  };

  const navigateToNotifications = () => {
    navigation.navigate('Notifications', {
      screen: 'NotificationsScreen'
    });
  };

  const menuOptions = [
    {
      title: 'Informations personnelles',
      subtitle: profile?.full_name || 'Non renseigné',
      icon: 'person',
      onPress: () => navigation.navigate('PersonalInfo')
    },
    {
      title: 'Moyen de paiement',
      subtitle: 'Gérer vos moyens de paiement',
      icon: 'payment',
      onPress: () => navigation.navigate('ManageCards')
    },
    ...(isAdmin ? [
      {
        title: 'Administration',
        subtitle: 'Gérer les annonces et les utilisateurs',
        icon: 'admin-panel-settings',
        onPress: handleAdminPress
      }
    ] : []),
    {
      title: 'Paramètres',
      subtitle: 'Préférences de l\'application',
      icon: 'settings',
      onPress: () => {
        console.log('[NewProfileScreen] Navigation vers les paramètres');
        // Naviguer vers l'écran SettingsScreen dans le ProfileStack
        navigation.navigate('SettingsScreen');
      }
    },
    {
      title: 'Ajouter une annonce',
      subtitle: 'Publier un nouveau bien',
      icon: 'add-circle-outline',
      onPress: () => navigation.navigate('AddPropertyScreen')
    },
    {
      title: 'Mes favoris',
      subtitle: 'Biens sauvegardés',
      icon: 'favorite-border',
      onPress: () => navigation.navigate('Favorites')
    },
    ...(hasProperties ? [{
      title: 'Mes annonces',
      subtitle: 'Gérer mes biens',
      icon: 'home',

      onPress: () => navigation.navigate('MyListings')
    }] : []),
    {
      title: 'Historique de recherche',
      subtitle: 'Vos recherches récentes',
      icon: 'history',
      onPress: () => navigation.navigate('SearchHistory')
    }
  ];

  return (
    <View style={styles.container}>
      {/* L'en-tête est géré par la navigation, pas besoin de duplication */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        {menuOptions.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <View style={styles.menuItemLeft}>
              <MaterialIcons name={item.icon} size={24} color={colors.text} style={styles.menuItemIcon} />
              <View>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
                <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={colors.text} />
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.card }]}
          onPress={handleSignOut}
        >
          <MaterialIcons name="logout" size={24} color="#FF3B30" />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
        
        {/* Espace supplémentaire en bas pour éviter que le bouton soit caché */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}
