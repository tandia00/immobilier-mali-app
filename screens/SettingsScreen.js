import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  Modal,
  Pressable
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { useNavigation } from '@react-navigation/native';

export default function SettingsScreen() {
  const { theme, setThemeMode, colors, isDark } = useTheme();
  const navigation = useNavigation();
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [hasProperties, setHasProperties] = useState(false);
  const [loading, setLoading] = useState(true);

  // Vérifier si l'utilisateur a des annonces
  useEffect(() => {
    const checkUserProperties = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('properties')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (error) {
          console.error('Erreur lors de la vérification des annonces:', error);
          return;
        }

        setHasProperties(data && data.length > 0);
      } catch (error) {
        console.error('Erreur inattendue:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUserProperties();
  }, []);

  const getCurrentThemeText = () => {
    switch (theme) {
      case 'light':
        return 'Clair';
      case 'dark':
        return 'Sombre';
      default:
        return 'Système';
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Supprimer le compte',
      'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action supprimera définitivement toutes vos données (annonces, messages, avis, etc.).',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) throw new Error('Utilisateur non connecté');

              // Supprimer les annonces de l'utilisateur
              const { error: propertiesError } = await supabase
                .from('properties')
                .delete()
                .eq('user_id', user.id);

              if (propertiesError) throw propertiesError;

              // Supprimer les messages de l'utilisateur
              const { error: messagesError } = await supabase
                .from('messages')
                .delete()
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

              if (messagesError) throw messagesError;

              // Supprimer les avis de l'utilisateur
              const { error: reviewsError } = await supabase
                .from('seller_reviews')
                .delete()
                .or(`reviewer_id.eq.${user.id},seller_id.eq.${user.id}`);

              if (reviewsError) throw reviewsError;

              // Supprimer les favoris de l'utilisateur
              const { error: favoritesError } = await supabase
                .from('favorites')
                .delete()
                .eq('user_id', user.id);

              if (favoritesError) throw favoritesError;

              // Supprimer le profil de l'utilisateur
              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', user.id);

              if (profileError) throw profileError;

              // Déconnexion et suppression du compte
              await supabase.auth.signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });

              Alert.alert(
                'Compte supprimé',
                'Votre compte et toutes vos données ont été supprimés avec succès.'
              );
            } catch (error) {
              console.error('Erreur lors de la suppression du compte:', error);
              Alert.alert(
                'Erreur',
                'Une erreur est survenue lors de la suppression du compte. Veuillez réessayer.'
              );
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleThemeChange = () => {
    Alert.alert(
      'Choisir le thème',
      'Sélectionnez le mode d\'affichage',
      [
        {
          text: 'Clair',
          onPress: () => setThemeMode('light'),
        },
        {
          text: 'Sombre',
          onPress: () => setThemeMode('dark'),
        },
        {
          text: 'Système',
          onPress: () => setThemeMode('system'),
        },
        {
          text: 'Annuler',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      Alert.alert('Erreur', 'Une erreur est survenue lors de la déconnexion');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Apparence</Text>
        <TouchableOpacity
          style={[styles.settingItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          onPress={() => setThemeModalVisible(true)}
        >
          <View style={styles.settingLeft}>
            <MaterialIcons name="palette" size={24} color={colors.text} />
            <View style={styles.settingTexts}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Thème</Text>
              <Text style={[styles.settingValue, { color: colors.text }]}>{getCurrentThemeText()}</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Notifications</Text>
        <View style={[styles.settingItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.settingLeft}>
            <MaterialIcons name="notifications" size={24} color={colors.text} />
            <View style={styles.settingTexts}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Notifications push</Text>
              <Text style={[styles.settingValue, { color: colors.text }]}>Activées</Text>
            </View>
          </View>
          <Switch
            value={true}
            onValueChange={() => {}}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.background}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Compte</Text>
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: colors.border }]}
          onPress={() => navigation.navigate('PaymentInfo')}
        >
          <View style={styles.settingLeft}>
            <MaterialIcons name="account-balance-wallet" size={24} color={colors.primary} />
            <Text style={[styles.settingTitle, { color: colors.text }]}>
              Informations de paiement
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.settingItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          onPress={handleDeleteAccount}
        >
          <View style={styles.settingLeft}>
            <MaterialIcons name="delete-forever" size={24} color="#FF3B30" />
            <View style={styles.settingTexts}>
              <Text style={[styles.settingTitle, { color: '#FF3B30' }]}>Supprimer le compte</Text>
              <Text style={[styles.settingValue, { color: colors.text }]}>Supprimer définitivement votre compte</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          onPress={handleSignOut}
        >
          <View style={styles.settingLeft}>
            <MaterialIcons name="logout" size={24} color="#FF3B30" />
            <View style={styles.settingTexts}>
              <Text style={[styles.settingTitle, { color: '#FF3B30' }]}>Se déconnecter</Text>
              <Text style={[styles.settingValue, { color: colors.text }]}>Déconnexion de votre compte</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>À propos</Text>
        <View style={[styles.settingItem, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.settingLeft}>
            <MaterialIcons name="info" size={24} color={colors.text} />
            <View style={styles.settingTexts}>
              <Text style={[styles.settingTitle, { color: colors.text }]}>Version de l'application</Text>
              <Text style={[styles.settingValue, { color: colors.text }]}>1.0.0</Text>
            </View>
          </View>
        </View>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={themeModalVisible}
        onRequestClose={() => setThemeModalVisible(false)}
      >
        <View style={styles.centeredView}>
          <View style={[styles.modalView, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalText, { color: colors.text }]}>Choisir le thème</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setThemeMode('light');
                setThemeModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>Clair</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setThemeMode('dark');
                setThemeModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>Sombre</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setThemeMode('system');
                setThemeModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>Système</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: colors.border }]}
              onPress={() => setThemeModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 16,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTexts: {
    marginLeft: 16,
    flex: 1,
  },
  settingTitle: {
    fontSize: 17,
    fontWeight: '400',
  },
  settingValue: {
    fontSize: 15,
    marginTop: 2,
    opacity: 0.7,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%',
    maxWidth: 400,
  },
  modalText: {
    marginBottom: 15,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});
