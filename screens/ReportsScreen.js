import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { supabase } from '../config/supabase';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export default function ReportsScreen({ navigation }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchReports();
    }
  }, [isAdmin]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  async function checkAdminStatus() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigation.goBack();
        return false;
      }

      const { data: roleData, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Erreur lors de la vérification du rôle:', error);
        Alert.alert('Erreur', 'Impossible de vérifier vos droits d\'accès');
        navigation.goBack();
        return false;
      }

      const isAdminUser = roleData?.role === 'admin';
      setIsAdmin(isAdminUser);

      if (!isAdminUser) {
        Alert.alert('Erreur', 'Accès non autorisé');
        navigation.goBack();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Erreur lors de la vérification du statut admin:', error);
      Alert.alert('Erreur', 'Impossible de vérifier vos droits d\'accès');
      navigation.goBack();
      return false;
    }
  }

  async function fetchReports() {
    try {
      setLoading(true);
      
      const { data: reports, error } = await supabase
        .from('user_reports')
        .select(`
          id,
          created_at,
          reporter_id,
          reported_user_id,
          reason,
          status,
          admin_notes
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Une fois que nous avons les signalements, récupérons les détails des utilisateurs
      if (reports && reports.length > 0) {
        const userIds = [...new Set([
          ...reports.map(report => report.reporter_id),
          ...reports.map(report => report.reported_user_id)
        ])];
        
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        if (userError) {
          console.error('Erreur lors de la récupération des utilisateurs:', userError);
        } else {
          // Fusionner les données des utilisateurs avec les signalements
          const reportsWithUserInfo = reports.map(report => {
            const reporter = userData.find(u => u.id === report.reporter_id);
            const reportedUser = userData.find(u => u.id === report.reported_user_id);
            return {
              ...report,
              reporter: reporter || { full_name: 'Utilisateur inconnu' },
              reportedUser: reportedUser || { full_name: 'Utilisateur inconnu' }
            };
          });
          setReports(reportsWithUserInfo);
        }
      } else {
        setReports(reports || []);
      }

      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Erreur lors du chargement des signalements:', error);
      Alert.alert('Erreur', 'Impossible de charger les signalements');
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleReport(reportId, action) {
    try {
      setLoading(true);
      
      // Log pour le débogage
      console.log('ID du rapport reçu:', reportId, typeof reportId);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      // Utiliser uniquement le champ status pour éviter les problèmes
      const updateData = {
        status: action
      };
      
      console.log('Mise à jour du signalement avec les paramètres:', {
        id: reportId,
        ...updateData
      });
      
      // Effectuer la mise à jour
      const { error } = await supabase
        .from('user_reports')
        .update(updateData)
        .eq('id', reportId);

      if (error) {
        console.error('Erreur lors du traitement du signalement:', error);
        throw error;
      }

      Alert.alert('Succès', 'Signalement traité avec succès');
      fetchReports();
    } catch (error) {
      console.error('Erreur lors du traitement du signalement:', error);
      Alert.alert('Erreur', 'Impossible de traiter le signalement: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const renderReport = (report) => {
    // Extraire un numéro de signalement pour l'affichage
    const reportNumber = typeof report.id === 'string' && report.id.includes('-') 
      ? report.id.split('-')[0] 
      : report.id;
    
    return (
      <View style={styles.reportCard} key={report.id}>
        <View style={styles.reportHeader}>
          <Text style={styles.reportNumber}>Signalement #{reportNumber}</Text>
          <Text style={styles.reportDate}>
            {new Date(report.created_at).toLocaleDateString()}
          </Text>
        </View>

        <Text style={styles.reportField}>
          Signalé par: {report.reporter.full_name}
        </Text>
        <Text style={styles.reportField}>
          Utilisateur signalé: {report.reportedUser.full_name}
        </Text>
        <Text style={styles.reportField}>
          Raison: {report.reason}
        </Text>
        <Text style={styles.reportField}>
          Statut: <Text style={{ color: '#FFA500', fontWeight: '500' }}>{report.status}</Text>
        </Text>

        {report.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.resolveButton}
              onPress={() => handleReport(report.id, 'resolved')}
            >
              <MaterialIcons name="check" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Résoudre</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={() => handleReport(report.id, 'dismissed')}
            >
              <MaterialIcons name="close" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.buttonText}>Rejeter</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text>Accès non autorisé</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
        ) : reports.length === 0 ? (
          <Text style={styles.emptyText}>Aucun signalement</Text>
        ) : (
          reports.map(report => renderReport(report))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  reportDate: {
    fontSize: 14,
    color: '#666',
  },
  reportField: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  resolveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  dismissButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  loader: {
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
});
