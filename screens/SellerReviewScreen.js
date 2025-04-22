import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { Text } from 'react-native-elements';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';
import { CommonActions } from '@react-navigation/native';

const REPORT_REASONS = [
  { id: 'fake', label: 'Annonce frauduleuse' },
  { id: 'inappropriate', label: 'Contenu inapproprié' },
  { id: 'wrong_price', label: 'Prix incorrect' },
  { id: 'wrong_location', label: 'Localisation incorrecte' },
  { id: 'spam', label: 'Spam ou publicité' },
  { id: 'other', label: 'Autre raison' },
];

const StarRating = ({ rating, setRating, size = 40, readonly = false, emptyColor = '#CCCCCC' }) => {
  return (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => !readonly && setRating(star)}
          disabled={readonly}
          style={styles.starButton}
        >
          <MaterialIcons
            name={star <= rating ? 'star' : 'star-outline'}
            size={size}
            color={star <= rating ? '#FFD700' : emptyColor}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default function SellerReviewScreen({ route, navigation }) {
  const { sellerId, sellerName, mode, property } = route.params;
  const { colors } = useTheme();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(0);
  const [selectedReason, setSelectedReason] = useState(null);
  const [reports, setReports] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    console.log('Property from route:', property); // Debugging
    if (!property) {
      console.error('Property is undefined in route params');
      return;
    }
  }, [property]);

  useEffect(() => {
    navigation.setOptions({
      title: mode === 'reviews' ? 'Évaluer ' + (sellerName || 'le vendeur') : 'Signaler',
      headerBackVisible: false,
      headerStyle: {
        backgroundColor: colors.background,
      },
      headerTintColor: colors.text,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => {
            if (property?.id) {
              navigation.navigate('PropertyDetails', { 
                propertyId: property.id,
                scrollPosition: 0
              });
            } else {
              navigation.goBack();
            }
          }}
          style={{ 
            marginLeft: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8
          }}
        >
          <MaterialIcons 
            name="chevron-left" 
            size={28} 
            color={colors.text}
            style={{
              marginLeft: -4
            }}
          />
          <Text style={{ 
            color: colors.text,
            fontSize: 17,
            fontWeight: '400'
          }}>Retour</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors, mode, sellerName, property]);

  useEffect(() => {
    if (mode === 'reviews') {
      fetchReviews();
    }
  }, [mode]);

  useEffect(() => {
    fetchReports();
  }, [property]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_reviews')
        .select('*')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur détaillée:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const reviewerIds = data.map(review => review.reviewer_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', reviewerIds);

        if (profilesError) {
          console.error('Erreur lors de la récupération des profils:', profilesError);
        } else {
          const reviewsWithProfiles = data.map(review => ({
            ...review,
            reviewer: profiles.find(p => p.id === review.reviewer_id)
          }));
          setReviews(reviewsWithProfiles);
        }
      } else {
        setReviews([]);
      }
      
      if (data && data.length > 0) {
        const avg = data.reduce((acc, curr) => acc + curr.rating, 0) / data.length;
        setAverageRating(avg);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des avis:', error);
      Alert.alert('Erreur', 'Impossible de charger les avis');
    }
  };

  const fetchReports = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_reports')
        .select('*')
        .eq('reported_user_id', property.user_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const submitReview = async () => {
    if (rating === 0) {
      Alert.alert('Erreur', 'Veuillez donner une note');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Utilisateur non connecté');
      }

      if (!sellerId) {
        throw new Error('ID du vendeur manquant');
      }

      const { data: existingReview, error: checkError } = await supabase
        .from('seller_reviews')
        .select('id')
        .eq('reviewer_id', user.id)
        .eq('seller_id', sellerId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingReview) {
        const { error: updateError } = await supabase
          .from('seller_reviews')
          .update({
            rating,
            comment
          })
          .eq('id', existingReview.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('seller_reviews')
          .insert({
            seller_id: sellerId,
            reviewer_id: user.id,
            rating,
            comment
          });

        if (insertError) throw insertError;
      }

      Alert.alert('Succès', 'Votre avis a été enregistré');
      setRating(0);
      setComment('');
      await fetchReviews();
    } catch (error) {
      console.error('Erreur lors de la soumission de l\'avis:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer votre avis');
    } finally {
      setLoading(false);
    }
  };

  const submitReport = async () => {
    if (!comment) {
      Alert.alert('Erreur', 'Veuillez entrer une description du problème');
      return;
    }

    if (!property || !property.id) {
      Alert.alert('Erreur', 'Impossible d\'identifier la propriété');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Erreur', 'Vous devez être connecté pour signaler un problème');
        return;
      }

      const { error } = await supabase
        .from('user_reports')
        .insert({
          reported_user_id: property.user_id,
          reporter_id: user.id,
          reason: comment,
          status: 'pending'
        });

      if (error) throw error;

      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [
              {
                name: 'Home',
                state: {
                  routes: [
                    {
                      name: 'PropertyDetails',
                      params: {
                        property: property,
                        propertyId: property.id,
                        refresh: true
                      }
                    }
                  ]
                }
              }
            ]
          })
        );
      }, 2000);

    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de l\'envoi du signalement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {mode === 'reviews' ? (
          <>
            <View style={[styles.ratingOverview, { backgroundColor: colors.card }]}>
              <View style={styles.averageRatingContainer}>
                <StarRating
                  rating={averageRating}
                  setRating={() => {}}
                  readonly={true}
                  size={30}
                  emptyColor="#FFD700"
                />
                <Text style={[styles.ratingText, { color: colors.text }]}>
                  ({averageRating.toFixed(1)}/5 - {reviews.length} avis)
                </Text>
              </View>
            </View>

            <View style={[styles.newReviewContainer, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Donner un avis</Text>
              <Text style={[styles.ratingLabel, { color: colors.text }]}>Rating: {rating}/5</Text>
              
              <StarRating
                rating={rating}
                setRating={setRating}
                size={40}
                emptyColor="#CCCCCC"
              />

              <TextInput
                placeholder="Votre commentaire (optionnel)"
                value={comment}
                onChangeText={setComment}
                multiline
                style={[
                  styles.commentInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border
                  }
                ]}
                placeholderTextColor={colors.text + '80'}
              />

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: '#4CAF50' }]}
                onPress={submitReview}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="chevron-right" size={24} color="#FFF" />
                    <Text style={styles.submitButtonText}>Envoyer l'avis</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.previousReviews}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Avis précédents</Text>
              {reviews.map((review, index) => (
                <View key={index} style={[styles.reviewItem, { backgroundColor: colors.card }]}>
                  <View style={styles.reviewHeader}>
                    <StarRating
                      rating={review.rating}
                      setRating={() => {}}
                      readonly={true}
                      size={16}
                      emptyColor="#FFD700"
                    />
                    <Text style={[styles.reviewDate, { color: colors.text }]}>
                      {new Date(review.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={[styles.reviewComment, { color: colors.text }]}>
                    {review.comment}
                  </Text>
                  <Text style={[styles.reviewAuthor, { color: colors.text }]}>
                    Par {review.reviewer?.name || 'Anonyme'}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={[styles.reportContainer, { backgroundColor: colors.card }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Signaler un problème</Text>
              
              <TextInput
                placeholder="Description du problème"
                value={comment}
                onChangeText={setComment}
                multiline
                style={[
                  styles.commentInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border
                  }
                ]}
                placeholderTextColor={colors.text + '80'}
              />

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: '#4CAF50' }]}
                onPress={submitReport}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="flag" size={24} color="#FFF" />
                    <Text style={styles.submitButtonText}>Envoyer le signalement</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {reports.length > 0 && (
              <View style={styles.reportsHistoryContainer}>
                <Text style={[styles.historyTitle, { color: colors.text }]}>
                  Historique des signalements
                </Text>
                {reports.map((report, index) => (
                  <View 
                    key={report.id} 
                    style={[
                      styles.reportItem, 
                      { 
                        backgroundColor: colors.card,
                        borderColor: colors.border + '20'
                      }
                    ]}
                  >
                    <Text style={[styles.reportReason, { color: colors.text }]}>
                      {report.reason}
                    </Text>
                    <View style={styles.reportFooter}>
                      <Text style={[styles.reportDate, { color: colors.text + '80' }]}>
                        {new Date(report.created_at).toLocaleDateString()}
                      </Text>
                      <Text style={[styles.reportStatus, { color: colors.text + '80' }]}>
                        {report.status === 'pending' ? 'En attente' : 'Traité'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>

      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>Succès</Text>
            <Text style={styles.modalSubText}>Votre signalement a été envoyé</Text>
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
  content: {
    padding: 16,
  },
  ratingOverview: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  averageRatingContainer: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  starButton: {
    padding: 5,
  },
  ratingText: {
    fontSize: 16,
    marginTop: 8,
  },
  newReviewContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  ratingLabel: {
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
    fontSize: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  submitButtonText: {
    color: '#FFF',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  previousReviews: {
    marginTop: 24,
  },
  reviewItem: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
  },
  reviewComment: {
    fontSize: 14,
    marginBottom: 8,
  },
  reviewAuthor: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  reportContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  reportsHistoryContainer: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  historyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#000',
  },
  reportItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reportReason: {
    fontSize: 16,
    marginBottom: 8,
    color: '#000',
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportDate: {
    fontSize: 14,
    color: '#666',
  },
  reportStatus: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 5,
  },
  modalText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalSubText: {
    fontSize: 16,
    color: '#666',
  },
});
