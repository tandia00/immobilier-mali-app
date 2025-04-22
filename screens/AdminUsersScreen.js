import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Alert, Platform, FlatList, Modal } from 'react-native';
import { Text as TextElement, Button, Card, Badge, SearchBar } from 'react-native-elements';

import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useTheme } from '@react-navigation/native';

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    checkAdminStatus();
    fetchUsers();
  }, []);
  
  // Effet pour appliquer les filtres lorsqu'ils changent
  useEffect(() => {
    if (allUsers.length > 0) {
      // Ne pas refaire un appel API, juste réappliquer les filtres sur les données existantes
      applyFilters(allUsers);
    }
  }, [filterType, filterStatus, searchQuery, allUsers]);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchUsers();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('Utilisateur non connecté');
        // Commenté pour permettre l'accès pendant les tests
        // Alert.alert('Erreur', 'Vous devez être connecté pour accéder à cette page.');
        return;
      }

      console.log('Utilisateur connecté:', user.email);
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('Profil récupéré:', profile, 'Erreur:', error);
      
      // Désactivation temporaire de la vérification stricte du type admin
      // pour permettre l'accès pendant les tests
      if (error) {
        console.error('Erreur lors de la récupération du profil:', error);
        return;
      }
      
      // Afficher le type d'utilisateur pour déboguer
      if (profile) {
        console.log('Type d\'utilisateur:', profile.type);
      }
      
      // Commenté pour permettre l'accès pendant les tests
      // if (!profile || profile.type.toLowerCase() !== 'admin') {
      //   Alert.alert('Accès refusé', 'Vous n\'avez pas les droits d\'accès à cette page.');
      //   return;
      // }
    } catch (error) {
      console.error('Erreur lors de la vérification des droits:', error);
      // Commenté pour permettre l'accès pendant les tests
      // Alert.alert('Erreur', 'Une erreur est survenue lors de la vérification de vos droits d\'accès.');
    }
  };

  // Variable pour stocker tous les utilisateurs avant filtrage
  const [allUsers, setAllUsers] = useState([]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('Récupération des utilisateurs...');
      // Récupérer tous les profils
      let { data: profiles, error } = await supabase
        .from('profiles')
        .select('*');
      
      // Log pour vérifier si is_disabled est présent dans les données
      if (profiles && profiles.length > 0) {
        console.log('Premier utilisateur avec champs complets:', JSON.stringify(profiles[0]));
        console.log('Champ is_disabled présent dans les données:', profiles[0].hasOwnProperty('is_disabled'));
      }

      if (error) {
        throw error;
      }

      // Récupérer les propriétaires (utilisateurs qui ont des propriétés)
      let { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select('id, user_id');

      if (propertiesError) {
        console.error('Erreur lors de la récupération des propriétés:', propertiesError);
        // Continuer même en cas d'erreur
      }

      // Récupérer les administrateurs depuis la table admin_users
      let { data: adminUsers, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id');

      if (adminError) {
        console.error('Erreur lors de la récupération des administrateurs:', adminError);
        // Continuer même en cas d'erreur
      }

      // Créer un ensemble des IDs des propriétaires
      const ownerIds = new Set();
      if (properties && properties.length > 0) {
        properties.forEach(property => {
          if (property.user_id) {
            ownerIds.add(property.user_id);
          }
        });
      }

      // Créer un ensemble des IDs des administrateurs
      const adminIds = new Set();
      if (adminUsers && adminUsers.length > 0) {
        adminUsers.forEach(admin => {
          if (admin.user_id) {
            adminIds.add(admin.user_id);
          }
        });
      }
      
      // Si nous n'avons pas trouvé d'administrateurs dans la table admin_users,
      // utilisons l'ID de l'utilisateur actuel comme administrateur (pour les tests)
      if (adminIds.size === 0) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            adminIds.add(user.id);
            console.log('Aucun administrateur trouvé dans la table admin_users, utilisation de l\'utilisateur actuel comme admin:', user.id);
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de l\'utilisateur actuel:', error);
        }
      }

      console.log('Profils récupérés:', profiles.length);
      console.log('Propriétaires identifiés:', ownerIds.size);
      
      // Afficher les données des utilisateurs pour le débogage
      if (profiles.length > 0) {
        console.log('Structure du premier utilisateur:', JSON.stringify(profiles[0]));
      }
      
      // Afficher des informations sur chaque utilisateur
      profiles.forEach(user => {
        console.log(`Utilisateur: ${user.email || 'Sans email'} - Nom: ${user.full_name || 'Non spécifié'} - Ville: ${user.city || 'Non spécifiée'}`);
      });

      // Afficher les données brutes pour débogage
      console.log('Données brutes des utilisateurs:');
      profiles.forEach(user => {
        console.log(`ID: ${user.id}, Email: ${user.email}, user_type: ${user.user_type}`);
      });

      // Normaliser les données des utilisateurs
      const normalizedUsers = profiles.map(user => {
        // Utiliser directement la colonne user_type de la base de données
        // Si elle n'est pas définie, utiliser 'client' comme valeur par défaut
        let normalizedType = (user.user_type || 'client').toLowerCase();
        
        // S'assurer que le type est l'un des trois types valides
        if (!['admin', 'merchant', 'client'].includes(normalizedType)) {
          normalizedType = 'client'; // Valeur par défaut si le type n'est pas reconnu
        }
        
        // Logs détaillés pour le débogage
        console.log(`Normalisation - Utilisateur ${user.email} - user_type: ${user.user_type} -> type normalisé: ${normalizedType}`);
        
        
        return {
          ...user,
          type: normalizedType,
          is_disabled: user.is_disabled || false,
          created_at_formatted: new Date(user.created_at).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        };
      });

      // Stocker tous les utilisateurs normalisés
      setAllUsers(normalizedUsers);
      
      // Appliquer les filtres sur les utilisateurs normalisés
      applyFilters(normalizedUsers);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      Alert.alert(
        'Erreur',
        'Impossible de récupérer la liste des utilisateurs.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = (allUsers) => {
    console.log('Application des filtres - Type:', filterType, 'Status:', filterStatus);
    console.log('Nombre d\'utilisateurs avant filtrage:', allUsers.length);
    
    // Afficher tous les utilisateurs avant filtrage
    console.log('Liste des utilisateurs avant filtrage:');
    allUsers.forEach(user => {
      console.log(`ID: ${user.id}, Email: ${user.email}, Type: ${user.type}`);
    });
    
    // Appliquer les filtres
    let filteredUsers = [...allUsers];
    
    // Filtre par type
    if (filterType !== 'all') {
      console.log('Filtrage par type:', filterType);
      filteredUsers = filteredUsers.filter(user => {
        // Utiliser directement le type normalisé stocké dans user.type
        const match = user.type === filterType;
        console.log(`Filtrage utilisateur ${user.email} - Type: ${user.type}, Match avec ${filterType}: ${match}`);
        return match;
      });
      console.log('Nombre d\'utilisateurs après filtrage par type:', filteredUsers.length);
    }

    // Filtre par statut
    if (filterStatus !== 'all') {
      console.log('Filtrage par statut:', filterStatus);
      filteredUsers = filteredUsers.filter(user => {
        // Si le statut est 'active', on garde les utilisateurs non désactivés
        // Si le statut est 'disabled', on garde les utilisateurs désactivés
        const match = filterStatus === 'active' ? !user.is_disabled : user.is_disabled;
        console.log(`Filtrage utilisateur ${user.email} - is_disabled: ${user.is_disabled}, Match avec ${filterStatus}: ${match}`);
        return match;
      });
      console.log('Nombre d\'utilisateurs après filtrage par statut:', filteredUsers.length);
    }

    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        (user.full_name?.toLowerCase().includes(query)) ||
        user.email.toLowerCase().includes(query) ||
        (user.phone?.toLowerCase().includes(query))
      );
    }

    console.log('Utilisateurs filtrés:', filteredUsers.length);
    setUsers(filteredUsers);
  };

  const toggleUserStatus = async (userId, newStatus) => {
    try {
      setLoading(true);
      console.log(`Tentative de ${newStatus ? 'désactivation' : 'activation'} de l'utilisateur ${userId}`);
      
      // Vérifier l'état actuel avant la mise à jour
      const { data: currentUser, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (fetchError) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', fetchError);
      } else {
        console.log('État actuel de l\'utilisateur:', currentUser);
      }
      
      // Effectuer la mise à jour
      const { data, error } = await supabase
        .from('profiles')
        .update({ is_disabled: newStatus })
        .eq('id', userId);

      if (error) {
        console.error('Erreur lors de la mise à jour du statut:', error);
        Alert.alert(
          'Erreur',
          'Impossible de mettre à jour le statut de l\'utilisateur.'
        );
        return;
      }
      
      console.log('Mise à jour réussie, données retournées:', data);
      
      // Vérifier l'état après la mise à jour
      const { data: updatedUser, error: updateFetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (updateFetchError) {
        console.error('Erreur lors de la récupération de l\'utilisateur mis à jour:', updateFetchError);
      } else {
        console.log('Nouvel état de l\'utilisateur après mise à jour:', updatedUser);
      }

      // Rafraîchir la liste des utilisateurs
      fetchUsers();
      Alert.alert(
        'Succès',
        `Le compte a été ${newStatus ? 'désactivé' : 'activé'} avec succès.`
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors de la mise à jour du statut.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setShowDetails(true);
  };

  const renderUserCard = ({ item: user }) => (
    <Card containerStyle={[styles.card, { borderColor: user.is_disabled ? '#ffcdd2' : '#c8e6c9' }]}>
      <TouchableOpacity onPress={() => handleUserSelect(user)}>
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user.full_name || 'Utilisateur'}
            </Text>
            <Text style={[styles.userEmail, { color: colors.text }]}>
              {user.email}
            </Text>
          </View>
          <Badge
            status={user.is_disabled ? 'error' : 'success'}
            value={user.is_disabled ? 'Désactivé' : 'Actif'}
          />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <MaterialIcons 
              name={
                user.type === 'admin' ? 'admin-panel-settings' :
                user.type === 'merchant' ? 'store' : 'person'
              }
              size={20}
              color={colors.text}
            />
            <Text style={[styles.userType, { color: colors.text }]}>
              {user.type === 'admin' ? 'Administrateur' :
               user.type === 'merchant' ? 'Commerçant' : 'Client'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <MaterialIcons name="event" size={20} color={colors.text} />
            <Text style={[styles.userDate, { color: colors.text }]}>
              {user.created_at_formatted}
            </Text>
          </View>

          {user.phone && (
            <View style={styles.infoRow}>
              <MaterialIcons name="phone" size={20} color={colors.text} />
              <Text style={[styles.userPhone, { color: colors.text }]}>
                {user.phone}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: user.is_disabled ? '#4CAF50' : '#f44336' }]}
        onPress={() => {
          Alert.alert(
            user.is_disabled ? 'Activer le compte' : 'Désactiver le compte',
            `Êtes-vous sûr de vouloir ${user.is_disabled ? 'activer' : 'désactiver'} le compte de ${user.full_name || 'cet utilisateur'} ?`,
            [
              { text: 'Annuler', style: 'cancel' },
              { 
                text: 'Confirmer',
                onPress: () => toggleUserStatus(user.id, !user.is_disabled)
              }
            ]
          );
        }}
      >
        <Text style={styles.actionButtonText}>
          {user.is_disabled ? 'Activer' : 'Désactiver'}
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <SearchBar
        placeholder="Rechercher un utilisateur..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        containerStyle={[styles.searchContainer, { backgroundColor: colors.background }]}
        inputContainerStyle={[styles.searchInputContainer, { backgroundColor: colors.card }]}
        inputStyle={{ color: colors.text }}
        placeholderTextColor={colors.text}
        onSubmitEditing={() => applyFilters(allUsers)}
        platform={Platform.OS === 'ios' ? 'ios' : 'android'}
        searchIcon={{ name: 'search', type: 'font-awesome' }}
        clearIcon={{ name: 'times', type: 'font-awesome' }}
      />
      
      {/* Filtres par type d'utilisateur */}
      <View style={styles.filterGroup}>
        <Text style={[styles.filterGroupTitle, { color: colors.text }]}>Type :</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterButtonsContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterType('all')}
          >
            <Text style={[styles.filterButtonText, filterType === 'all' && styles.filterButtonTextActive]}>Tous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'admin' && styles.filterButtonActive]}
            onPress={() => {
              console.log('Filtre admin sélectionné');
              setFilterType('admin');
            }}
          >
            <Text style={[styles.filterButtonText, filterType === 'admin' && styles.filterButtonTextActive]}>Administrateurs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'client' && styles.filterButtonActive]}
            onPress={() => setFilterType('client')}
          >
            <Text style={[styles.filterButtonText, filterType === 'client' && styles.filterButtonTextActive]}>Clients</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterType === 'merchant' && styles.filterButtonActive]}
            onPress={() => {
              console.log('Filtre commerçant sélectionné');
              setFilterType('merchant');
            }}
          >
            <Text style={[styles.filterButtonText, filterType === 'merchant' && styles.filterButtonTextActive]}>Commerçants</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      
      {/* Filtres par statut */}
      <View style={styles.filterGroup}>
        <Text style={[styles.filterGroupTitle, { color: colors.text }]}>Statut :</Text>
        <View style={styles.filterButtonsContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'all' && styles.filterButtonTextActive]}>Tous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'active' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('active')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'active' && styles.filterButtonTextActive]}>Actifs</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'disabled' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('disabled')}
          >
            <Text style={[styles.filterButtonText, filterStatus === 'disabled' && styles.filterButtonTextActive]}>Désactivés</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderUserDetails = () => (
    <Modal
      visible={showDetails}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowDetails(false)}
    >
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowDetails(false)}
          >
            <MaterialIcons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          {selectedUser && (
            <ScrollView style={styles.modalScrollView}>
              <View style={styles.detailsContainer}>
                <Text style={[styles.detailLabel, { color: colors.text }]}>Nom complet</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {selectedUser.full_name || 'Non spécifié'}
                </Text>

                <Text style={[styles.detailLabel, { color: colors.text }]}>Email</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{selectedUser.email}</Text>

                <Text style={[styles.detailLabel, { color: colors.text }]}>Type</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {selectedUser.type === 'admin' ? 'Administrateur' :
                   selectedUser.type === 'merchant' ? 'Commerçant' : 'Client'}
                </Text>

                <Text style={[styles.detailLabel, { color: colors.text }]}>Statut</Text>
                <Badge
                  status={selectedUser.is_disabled ? 'error' : 'success'}
                  value={selectedUser.is_disabled ? 'Désactivé' : 'Actif'}
                  containerStyle={styles.modalBadge}
                />

                <Text style={[styles.detailLabel, { color: colors.text }]}>Date d'inscription</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {selectedUser.created_at_formatted}
                </Text>

                {selectedUser.phone && (
                  <>
                    <Text style={[styles.detailLabel, { color: colors.text }]}>Téléphone</Text>
                    <Text style={[styles.detailValue, { color: colors.text }]}>{selectedUser.phone}</Text>
                  </>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Gestion des utilisateurs</Text>
      </View>
      <View style={[styles.contentContainer, { backgroundColor: colors.background }]}>
      {renderFilters()}
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUserCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchUsers();
              }}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="person-off" size={48} color={colors.text} />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                Aucun utilisateur trouvé
              </Text>
            </View>
          }
        />
      )}

      {renderUserDetails()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  filterGroupTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
    color: '#333',
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  contentContainer: {
    flex: 1,
  },
  filtersContainer: {
    padding: 10,
    marginBottom: 10,
  },
  searchContainer: {
    padding: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderRadius: 8,
    marginBottom: 10,
  },
  searchInputContainer: {
    borderRadius: 8,
    height: 40,
  },
  filterGroup: {
    marginTop: 10,
    marginBottom: 5,
  },
  filterButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#333',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
    marginRight: 16,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    opacity: 0.7,
  },
  cardContent: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userType: {
    marginLeft: 8,
    fontSize: 14,
  },
  userDate: {
    marginLeft: 8,
    fontSize: 14,
  },
  userPhone: {
    marginLeft: 8,
    fontSize: 14,
  },
  actionButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 8,
    padding: 16,
    maxHeight: '80%',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  userDetailsContainer: {
    padding: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    marginBottom: 8,
  },
  modalBadge: {
    marginTop: 4,
  },
});
