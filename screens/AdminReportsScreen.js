import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../config/supabase';
import { Button } from 'react-native-elements';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Badge } from 'react-native-elements';

export default function AdminReportsScreen({ navigation }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      // Vérifier si l'utilisateur est admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!roleData || roleData.role !== 'admin') {
        Alert.alert('Erreur', 'Accès non autorisé');
        navigation.goBack();
        return;
      }

      // Récupérer les signalements
      const { data, error } = await supabase
        .from('user_reports')
        .select(`
          *,
          reporter:profiles!user_reports_reporter_id_fkey (
            id,
            email,
            name
          ),
          reported:profiles!user_reports_reported_user_id_fkey (
            id,
            email,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur de requête:', error);
        throw error;
      }

      console.log('Signalements récupérés:', data);
      setReports(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des signalements:', error);
      Alert.alert('Erreur', 'Impossible de charger les signalements');
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (reportId, newStatus) => {
    try {
      const { error } = await supabase
        .from('user_reports')
        .update({ status: newStatus })
        .eq('id', reportId);

      if (error) throw error;

      await fetchReports();
      Alert.alert('Succès', 'Statut mis à jour');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    }
  };

  const renderReport = ({ item }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <Badge
          value={item.status}
          status={
            item.status === 'resolved' ? 'success' :
            item.status === 'reviewed' ? 'warning' : 'error'
          }
          containerStyle={styles.badge}
        />
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.label}>Signalé par:</Text>
        <Text style={styles.value}>{item.reporter?.name || item.reporter?.email || 'Inconnu'}</Text>
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.label}>Utilisateur signalé:</Text>
        <Text style={styles.value}>{item.reported?.name || item.reported?.email || 'Inconnu'}</Text>
      </View>

      <Text style={styles.reasonTitle}>Motif du signalement:</Text>
      <Text style={styles.reasonText}>{item.reason}</Text>

      {item.admin_notes && (
        <>
          <Text style={styles.notesTitle}>Notes admin:</Text>
          <Text style={styles.notesText}>{item.admin_notes}</Text>
        </>
      )}

      <View style={styles.buttonContainer}>
        {item.status === 'pending' && (
          <>
            <Button
              title="Marquer comme revu"
              onPress={() => updateReportStatus(item.id, 'reviewed')}
              buttonStyle={[styles.button, styles.reviewButton]}
            />
            <Button
              title="Résoudre"
              onPress={() => updateReportStatus(item.id, 'resolved')}
              buttonStyle={[styles.button, styles.resolveButton]}
            />
          </>
        )}
        {item.status === 'reviewed' && (
          <Button
            title="Résoudre"
            onPress={() => updateReportStatus(item.id, 'resolved')}
            buttonStyle={[styles.button, styles.resolveButton]}
          />
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gestion des Signalements</Text>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Chargement des signalements...</Text>
        </View>
      ) : reports.length > 0 ? (
        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={(item) => item.id.toString()}
          refreshing={loading}
          onRefresh={fetchReports}
        />
      ) : (
        <Text style={styles.emptyText}>Aucun signalement à traiter</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666'
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  reportDate: {
    color: '#666',
    fontSize: 14
  },
  userInfo: {
    flexDirection: 'row',
    marginBottom: 8
  },
  label: {
    fontWeight: '600',
    marginRight: 8,
    color: '#444'
  },
  value: {
    color: '#666'
  },
  reasonTitle: {
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
    color: '#444'
  },
  reasonText: {
    color: '#666',
    marginBottom: 10
  },
  notesTitle: {
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 5,
    color: '#444'
  },
  notesText: {
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 10
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10
  },
  button: {
    minWidth: 120,
    borderRadius: 5
  },
  reviewButton: {
    backgroundColor: '#FFA000'
  },
  resolveButton: {
    backgroundColor: '#4CAF50'
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    marginTop: 20,
    fontStyle: 'italic'
  }
});
