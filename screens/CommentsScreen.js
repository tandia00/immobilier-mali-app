import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Text } from 'react-native-elements';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';

export default function CommentsScreen({ route, navigation }) {
  const { propertyId, propertyTitle } = route.params;
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [user, setUser] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Définir le titre de l'écran
    navigation.setOptions({
      title: 'Commentaires',
      headerStyle: {
        backgroundColor: colors.card,
      },
      headerTintColor: colors.text,
    });

    // Charger l'utilisateur actuel
    fetchCurrentUser();
    
    // Charger les commentaires
    fetchComments();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user: currentUser }, error } = await supabase.auth.getUser();
      if (error) throw error;
      setUser(currentUser);
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    }
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('property_comments')
        .select(`
          id,
          created_at,
          user_id,
          property_id,
          content,
          profiles (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setComments(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires:', error);
      Alert.alert('Erreur', 'Impossible de charger les commentaires');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchComments();
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un commentaire');
      return;
    }

    if (!user) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour commenter');
      return;
    }

    try {
      setSending(true);

      const { error } = await supabase
        .from('property_comments')
        .insert({
          user_id: user.id,
          property_id: propertyId,
          content: newComment.trim()
        });

      if (error) throw error;

      // Réinitialiser le champ de commentaire et rafraîchir la liste
      setNewComment('');
      fetchComments();
      Alert.alert('Succès', 'Votre commentaire a été publié');
    } catch (error) {
      console.error('Erreur lors de l\'envoi du commentaire:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer votre commentaire');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('fr-FR', options);
  };

  const renderComment = ({ item }) => (
    <View style={[styles.commentItem, { backgroundColor: colors.card }]}>
      <View style={styles.commentHeader}>
        <Text style={[styles.commentAuthor, { color: colors.text }]}>
          {item.profiles?.full_name || 'Utilisateur'}
        </Text>
        <Text style={[styles.commentDate, { color: colors.text }]}>
          {formatDate(item.created_at)}
        </Text>
      </View>
      <Text style={[styles.commentContent, { color: colors.text }]}>
        {item.content}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : null}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <View style={styles.propertyInfoContainer}>
        <Text style={[styles.propertyTitle, { color: colors.text }]}>
          {propertyTitle}
        </Text>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.commentsContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="comment" size={48} color={colors.text} />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                Aucun commentaire pour le moment
              </Text>
            </View>
          }
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}

      <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.background, color: colors.text }]}
          placeholder="Ajouter un commentaire..."
          placeholderTextColor={colors.text + '80'}
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.primary }]}
          onPress={handleSubmitComment}
          disabled={sending || !newComment.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="send" size={24} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  propertyInfoContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsContainer: {
    padding: 15,
  },
  commentItem: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  commentAuthor: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  commentDate: {
    fontSize: 12,
    opacity: 0.7,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
