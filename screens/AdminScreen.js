import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Modal, TextInput, Alert, Platform, Linking, ActivityIndicator, SafeAreaView, Image } from 'react-native';
import { Text as TextElement, Button, Card, Badge } from 'react-native-elements';
import { supabase } from '../config/supabase';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Icon from 'react-native-vector-icons/FontAwesome';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { stripeService } from '../services/StripeService';

export default function AdminScreen({ navigation }) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      console.log('Admin status changed to true, loading properties...');
      fetchPendingProperties();
    }
  }, [isAdmin]);

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

  async function fetchPendingProperties() {
    if (!isAdmin) {
      console.log('Pas admin, arrêt du chargement');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Début du chargement des propriétés...');

      // Vérifier l'utilisateur admin
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Erreur de récupération utilisateur:', userError);
        throw userError;
      }
      console.log('Utilisateur admin:', user.id);

      // Vérifier d'abord le rôle admin
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError) {
        console.error('Erreur vérification rôle:', roleError);
        throw roleError;
      }

      if (!roleData || roleData.role !== 'admin') {
        console.error('Utilisateur non admin:', roleData);
        throw new Error('Accès non autorisé');
      }

      console.log('Rôle utilisateur confirmé:', roleData);

      // Récupérer toutes les propriétés
      console.log('Requête Supabase pour toutes les propriétés...');
      
      // Faire un select count pour compter les propriétés
      const { data: countData, error: countError } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true });

      if (countError) {
        console.error('Erreur comptage propriétés:', countError);
      } else {
        console.log('Nombre total de propriétés dans la base:', countData?.length || 0);
      }

      // Ensuite, faire la requête principale avec les politiques RLS
      console.log('Récupération des propriétés avec politiques RLS...');
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          id,
          title,
          description,
          price,
          city,
          type,
          created_at,
          status,
          title_verified,
          description_verified,
          images_verified,
          documents_verified,
          images,
          documents,
          user_id,
          verified_by,
          verified_at,
          view_count
        `)
        .order('created_at', { ascending: false });

      if (propertiesError) {
        console.error('Erreur Supabase:', propertiesError);
        throw propertiesError;
      }

      console.log('Réponse Supabase brute:', {
        nombrePropriétés: properties?.length || 0,
        premièrePropriété: properties?.[0] ? {
          id: properties[0].id,
          title: properties[0].title,
          status: properties[0].status
        } : null
      });

      if (!properties || properties.length === 0) {
        console.log('Aucune propriété trouvée dans la base de données');
        setProperties([]);
        return;
      }

      console.log('Propriétés trouvées:', properties?.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        user_id: p.user_id,
        created_at: p.created_at
      })));

      // Récupérer les utilisateurs associés
      const userIds = properties.map(p => p.user_id);
      console.log('IDs des utilisateurs trouvés:', userIds);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      if (profilesError) {
        console.error('Erreur lors de la requête des profils:', profilesError);
        throw profilesError;
      }

      console.log('Profils récupérés:', profiles?.map(p => ({
        id: p.id,
        username: p.username
      })));

      // Combiner les données
      const propertiesWithProfiles = properties.map(property => ({
        ...property,
        id: property.id.toString(),
        profile: profiles.find(p => p.id === property.user_id)
      }));

      console.log('Propriétés avec profils:', propertiesWithProfiles?.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        user_id: p.user_id,
        profile: p.profile ? 'trouvé' : 'non trouvé'
      })));

      // Récupérer les URLs publiques
      console.log('Début du traitement des URLs des images et documents...');
      const propertiesWithPublicUrls = propertiesWithProfiles.map(property => {
        console.log(`Traitement de la propriété ${property.id}:`);
        console.log('- Images brutes:', property.images);
        console.log('- Documents bruts:', property.documents);

        // Fonction pour obtenir l'URL publique
        const getPublicUrl = (url, bucket) => {
          if (!url) return null;

          // Si c'est juste un nom de fichier
          if (!url.startsWith('http')) {
            console.log(`Conversion du nom de fichier ${url} en URL publique`);
            return supabase.storage
              .from(bucket)
              .getPublicUrl(url)
              .data.publicUrl;
          }

          // Si c'est une URL signée, extraire le chemin du fichier et générer une URL publique
          if (url.includes('/object/sign/')) {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            const bucketName = pathParts[pathParts.length - 2];
            const fileName = pathParts[pathParts.length - 1];
            console.log(`Conversion de l'URL signée en URL publique pour ${fileName}`);
            return supabase.storage
              .from(bucketName)
              .getPublicUrl(fileName)
              .data.publicUrl;
          }

          // Si c'est déjà une URL publique, la retourner telle quelle
          if (url.includes('/object/public/')) {
            console.log('URL déjà publique, pas de conversion nécessaire');
            return url;
          }

          console.log('Format d\'URL non reconnu, tentative de conversion en URL publique');
          return url;
        };

        const processedProperty = {
          ...property,
          image_urls: property.images ? property.images.map(url => {
            console.log('- Traitement URL image:', url);
            const public_url = getPublicUrl(url, 'property-images');
            console.log('- URL publique générée:', public_url);
            return {
              image_url: url,
              public_url: public_url
            };
          }) : [],
          document_urls: property.documents ? property.documents.map(url => {
            console.log('- Traitement URL document:', url);
            const public_url = getPublicUrl(url, 'property-documents');
            console.log('- URL publique générée:', public_url);
            return {
              document_url: url,
              public_url: public_url
            };
          }) : []
        };

        console.log(`Propriété ${property.id} traitée:`, {
          images: processedProperty.image_urls.length,
          documents: processedProperty.document_urls.length
        });

        return processedProperty;
      });

      console.log('Toutes les propriétés ont été traitées');
      setProperties(propertiesWithPublicUrls);
    } catch (error) {
      console.error('Erreur lors du chargement des propriétés:', {
        message: error.message,
        code: error.code,
        details: error.details,
        stack: error.stack
      });
      Alert.alert('Erreur', 'Impossible de charger les propriétés');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const viewImage = async (imageUrl) => {
    console.log('URL de l\'image à afficher:', imageUrl);
    if (!imageUrl) {
      Alert.alert('Erreur', 'Aucune image disponible');
      return;
    }

    // Afficher l'image dans une modal
    setSelectedImage(imageUrl);
    setImageModalVisible(true);
  };

  const viewDocument = async (documentUrl) => {
    try {
      console.log('URL d\'origine:', documentUrl);

      // Extraire le nom du fichier et l'extension de l'URL
      const fileName = documentUrl.split('/').pop();
      console.log('Nom du fichier:', fileName);
      
      // Obtenir une URL signée valide pendant 60 secondes
      const { data: { signedUrl }, error } = await supabase.storage
        .from('property-documents')
        .createSignedUrl(fileName, 60);

      if (error || !signedUrl) {
        console.error('Erreur lors de la création de l\'URL signée:', error);
        throw new Error('Impossible d\'accéder au document');
      }

      console.log('URL signée générée:', signedUrl);

      // Vérifier le type de fichier réel
      try {
        const response = await fetch(signedUrl, { method: 'HEAD' });
        const contentType = response.headers.get('content-type');
        console.log('Type de contenu:', contentType);

        // Si c'est une image, afficher dans le modal
        if (contentType && contentType.startsWith('image/')) {
          setSelectedImage(signedUrl);
          setImageModalVisible(true);
        } else {
          // Pour les PDF et autres documents, ouvrir dans le navigateur
          const result = await WebBrowser.openBrowserAsync(signedUrl);
          console.log('Résultat ouverture:', result);
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du type:', error);
        // En cas d'erreur, essayer d'ouvrir comme PDF par défaut
        const result = await WebBrowser.openBrowserAsync(signedUrl);
        console.log('Résultat ouverture (fallback):', result);
      }

    } catch (error) {
      console.error('Erreur détaillée:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir le document');
    }
  };

  // Fonction utilitaire pour convertir ArrayBuffer en Base64
  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Fonction pour mapper les champs aux noms de colonnes corrects
  const getVerificationField = (field) => {
    const fieldMap = {
      'image': 'images_verified',
      'title': 'title_verified',
      'description': 'description_verified',
      'document': 'documents_verified'
    };
    return fieldMap[field] || `${field}_verified`;
  };

  async function verifyProperty(propertyId, field) {
    try {
      if (!propertyId || typeof propertyId !== 'string') {
        console.error('ID de propriété invalide:', propertyId);
        Alert.alert('Erreur', 'ID de propriété invalide');
        return;
      }

      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const updateField = getVerificationField(field);
      
      console.log('Vérification de la propriété:', {
        propertyId,
        field,
        updateField,
        userId: user.id
      });

      const { error } = await supabase
        .from('properties')
        .update({ 
          [updateField]: true,
          verified_by: user.id,
          verified_at: new Date().toISOString()
        })
        .eq('id', propertyId);

      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }
      
      Alert.alert('Succès', `${field} vérifié avec succès`);
      fetchPendingProperties();
    } catch (error) {
      console.error(`Erreur lors de la vérification du ${field}:`, {
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      Alert.alert('Erreur', `Impossible de vérifier le ${field}`);
    } finally {
      setLoading(false);
    }
  }

  async function updatePropertyStatus(propertyId, status) {
    try {
      setLoading(true);
      
      // Récupérer d'abord les détails de la propriété
      const { data: property, error: fetchError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();
      
      if (fetchError) {
        console.error('Erreur lors de la récupération des détails de la propriété:', fetchError);
        throw fetchError;
      }
      
      // Préparer les données de mise à jour
      const updateData = { status };
      
      // Si le type n'est pas Terrain, marquer automatiquement documents_verified comme true
      // car les documents justificatifs ne sont pas requis pour ces types de biens
      if (property.type !== 'Terrain' && !property.documents_verified) {
        console.log('Type de bien non Terrain, validation automatique des documents');
        updateData.documents_verified = true;
      }
      
      // Vérifier si tous les champs requis sont validés
      const allFieldsVerified = 
        property.title_verified && 
        property.description_verified && 
        property.images_verified && 
        (property.documents_verified || updateData.documents_verified);
      
      if (status === 'approved' && !allFieldsVerified) {
        console.warn('Tentative d\'approbation sans validation complète des champs');
        Alert.alert(
          'Validation incomplète', 
          'Tous les champs doivent être vérifiés avant d\'approuver la propriété.\n\nChamps manquants:\n' + 
          (!property.title_verified ? '- Titre\n' : '') +
          (!property.description_verified ? '- Description\n' : '') +
          (!property.images_verified ? '- Images\n' : '') +
          (!(property.documents_verified || updateData.documents_verified) ? '- Documents' : '')
        );
        setLoading(false);
        return;
      }
      
      // Mettre à jour le statut et les champs vérifiés si nécessaire
      const { error } = await supabase
        .from('properties')
        .update(updateData)
        .eq('id', propertyId);

      if (error) {
        console.error('Erreur lors de la mise à jour:', error);
        throw error;
      }
      
      // Si l'annonce est approuvée, capturer le paiement
      if (status === 'approved') {
        try {
          console.log('Capture du paiement pour la propriété:', propertyId);
          const captureResult = await stripeService.capturePaymentForProperty(propertyId);
          
          if (captureResult.success) {
            console.log('Paiement capturé avec succès:', captureResult);
            Alert.alert(
              'Succès', 
              'Annonce approuvée et paiement débité avec succès.'
            );
          } else {
            console.error('Erreur lors de la capture du paiement:', captureResult.error);
            Alert.alert(
              'Attention', 
              'L\'annonce a été approuvée mais le paiement n\'a pas pu être débité. Veuillez vérifier dans le tableau de bord Stripe.'
            );
          }
        } catch (captureError) {
          console.error('Erreur lors de la capture du paiement:', captureError);
          Alert.alert(
            'Attention', 
            'L\'annonce a été approuvée mais le paiement n\'a pas pu être débité. Veuillez vérifier dans le tableau de bord Stripe.'
          );
        }
      } else if (status === 'rejected') {
        try {
          console.log('Annulation du paiement pour la propriété rejetée:', propertyId);
          const cancelResult = await stripeService.cancelPaymentForProperty(propertyId);
          
          if (cancelResult.success) {
            console.log('Paiement annulé avec succès:', cancelResult);
          } else {
            console.error('Erreur lors de l\'annulation du paiement:', cancelResult.error);
          }
        } catch (cancelError) {
          console.error('Erreur lors de l\'annulation du paiement:', cancelError);
        }
      }
      
      fetchPendingProperties();
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    } finally {
      setLoading(false);
    }
  }

  const handleReject = async (propertyId) => {
    try {
      if (!rejectReason.trim()) {
        Alert.alert('Erreur', 'Veuillez fournir une raison de rejet');
        return;
      }

      const { error } = await supabase
        .from('properties')
        .update({ 
          status: 'rejected',
          rejection_reason: rejectReason.trim()
        })
        .eq('id', propertyId);

      if (error) {
        console.error('Erreur Supabase:', error);
        throw error;
      }

      // Mettre à jour l'état local
      setProperties(properties.filter(p => p.id !== propertyId));
      setShowRejectModal(false);
      setRejectReason('');
      
      Alert.alert('Succès', 'La propriété a été rejetée avec succès');
    } catch (error) {
      console.error('Erreur lors du rejet:', error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue lors du rejet de la propriété. Veuillez réessayer.'
      );
    }
  };

  const validatePropertyData = (property) => {
    const issues = [];
    
    // Validation du titre
    if (!property.title || property.title.trim().length < 5) {
      issues.push('Le titre est trop court ou invalide');
    }
    
    // Validation de la description
    if (!property.description || property.description.trim().length < 20) {
      issues.push('La description est trop courte ou invalide');
    }
    
    // Validation du type de propriété
    if (property.title.toLowerCase().includes('appartement') && property.type === 'Maison') {
      issues.push('Incohérence entre le titre (Appartement) et le type de propriété (Maison)');
    }
    
    // Validation du prix
    if (!property.price || property.price <= 0) {
      issues.push('Le prix est invalide');
    }
    
    // Validation des images
    if (!property.images || property.images.length === 0) {
      issues.push('Aucune image fournie');
    }
    
    return issues;
  };

  const renderPropertyIssues = (property) => {
    const issues = validatePropertyData(property);
    if (issues.length === 0) return null;

    return (
      <View style={styles.issuesContainer}>
        <Text style={styles.issuesTitle}>Problèmes détectés :</Text>
        {issues.map((issue, index) => (
          <Text key={index} style={styles.issueText}>• {issue}</Text>
        ))}
      </View>
    );
  };

  const renderPropertyCard = (property) => {
    // Vérifier que l'ID est une chaîne
    const propertyId = property.id?.toString();
    
    return (
      <View key={propertyId} style={styles.propertyCard}>
        <Text style={styles.propertyTitle}>{property.title}</Text>
        
        {property.view_count > 0 && (
          <View style={styles.viewedBadge}>
            <Icon name="eye" size={12} color="#FFFFFF" />
            <Text style={styles.viewedBadgeText}>Déjà vu</Text>
            <Text style={styles.viewCount}>({property.view_count})</Text>
          </View>
        )}
        
        {property.title.toLowerCase().includes('appartement') && property.type === 'Maison' && (
          <View style={styles.warningContainer}>
            <Text style={styles.warningTitle}>Problèmes détectés :</Text>
            <Text style={styles.warningText}>• Incohérence entre le titre (Appartement) et le type de propriété (Maison)</Text>
          </View>
        )}

        <View style={styles.propertyInfo}>
          <Text style={styles.propertyInfoText}>Prix: {property.price.toLocaleString()} FCFA</Text>
          <Text style={styles.propertyInfoText}>Ville: {property.city}</Text>
          <Text style={styles.propertyInfoText}>Type: {property.type}</Text>
          <Text style={styles.propertyInfoText}>Date de création: {new Date(property.created_at).toLocaleDateString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Titre</Text>
          <Text style={styles.description}>{property.title}</Text>
          <View style={styles.verificationStatus}>
            <Text style={[
              styles.verificationText,
              property.title_verified && styles.verifiedText
            ]}>
              {property.title_verified ? 'Titre vérifié ✓' : 'Titre non vérifié'}
            </Text>
          </View>
          {!property.title_verified ? (
            <TouchableOpacity 
              style={[styles.actionButton, styles.verifyButton]}
              onPress={() => verifyProperty(propertyId, 'title')}>
              <Text style={styles.actionButtonText}>Vérifier le titre</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionButton, styles.verifiedButton]}>
              <Text style={styles.actionButtonText}>Vérifié ✓</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{property.description}</Text>
          <View style={styles.verificationStatus}>
            <Text style={[
              styles.verificationText,
              property.description_verified && styles.verifiedText
            ]}>
              {property.description_verified ? 'Description vérifiée ✓' : 'Description non vérifiée'}
            </Text>
          </View>
          {!property.description_verified ? (
            <TouchableOpacity 
              style={[styles.actionButton, styles.verifyButton]}
              onPress={() => verifyProperty(propertyId, 'description')}>
              <Text style={styles.actionButtonText}>Vérifier la description</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionButton, styles.verifiedButton]}>
              <Text style={styles.actionButtonText}>Vérifié ✓</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Image Principale</Text>
          <View style={styles.verificationStatus}>
            <Text style={[
              styles.verificationText,
              property.images_verified && styles.verifiedText
            ]}>
              {property.images_verified ? 'Image vérifiée ✓' : 'Image non vérifiée'}
            </Text>
          </View>
          {property.images && property.images.length > 0 ? (
            <>
              <TouchableOpacity 
                style={[styles.actionButton, styles.blueButton]}
                onPress={() => viewImage(property.images[0])}>
                <Text style={styles.actionButtonText}>Voir l'image</Text>
              </TouchableOpacity>
              {!property.images_verified ? (
                <TouchableOpacity 
                  style={[styles.actionButton, styles.verifyButton]}
                  onPress={() => verifyProperty(propertyId, 'image')}>
                  <Text style={styles.actionButtonText}>Vérifier l'image</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.actionButton, styles.verifiedButton]}>
                  <Text style={styles.actionButtonText}>Vérifié ✓</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.noImageText}>Aucune image disponible</Text>
          )}
        </View>

        {renderDocumentButton(property)}

        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            disabled={!property.description_verified || !property.images_verified}
            onPress={() => updatePropertyStatus(propertyId, 'approved')}>
            <Text style={styles.actionButtonText}>Approuver</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => {
              setSelectedPropertyId(propertyId);
              setShowRejectModal(true);
            }}>
            <Text style={styles.actionButtonText}>Rejeter</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderImageDocument = (imageUri) => {
    console.log('Affichage de l\'image:', imageUri);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <Image
          source={{ uri: imageUri }}
          style={{ width: '90%', height: '80%' }}
          resizeMode="contain"
        />
      </View>
    );
  };

  const renderDocumentButton = (property) => {
    if (property.documents && property.documents.length > 0) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents de propriété</Text>
          {property.documents.map((documentUrl, index) => {
            // Vérifier si l'URL contient le bucket des images ou si c'est un PDF
            const isImage = documentUrl.includes('/property-images/');
            const isPDF = documentUrl.toLowerCase().endsWith('.pdf');
            
            // Déterminer l'icône et la couleur en fonction du type de document
            const getIcon = () => {
              if (isImage) return 'photo';
              if (isPDF) return 'picture-as-pdf';
              return 'insert-drive-file';
            };

            const getButtonStyle = () => {
              if (isPDF) return '#FF6B6B';  // Rouge pour les PDFs
              return '#607D8B';  // Gris pour les autres documents
            };

            return (
              <View key={index} style={{ marginBottom: 10 }}>
                <TouchableOpacity 
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: getButtonStyle(),
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 8,
                      paddingVertical: 12
                    }
                  ]}
                  onPress={() => viewDocument(documentUrl)}>
                  <MaterialIcons 
                    name={getIcon()}
                    size={24}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[
                    styles.actionButtonText,
                    {
                      fontSize: 16,
                      fontWeight: '500',
                      color: '#fff'
                    }
                  ]}>
                    Voir le document {index + 1}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {!property.documents_verified ? (
            <TouchableOpacity 
              style={[
                styles.actionButton,
                {
                  backgroundColor: '#FFA500',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  paddingVertical: 12,
                  marginTop: 10
                }
              ]}
              onPress={() => verifyProperty(property.id, 'document')}>
              <MaterialIcons 
                name="verified"
                size={24}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={[
                styles.actionButtonText,
                {
                  fontSize: 16,
                  fontWeight: '500',
                  color: '#fff'
                }
              ]}>
                Vérifier les documents
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[
              styles.actionButton,
              {
                backgroundColor: '#4CAF50',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                paddingVertical: 12,
                marginTop: 10
              }
            ]}>
              <MaterialIcons 
                name="check-circle"
                size={24}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={[
                styles.actionButtonText,
                {
                  fontSize: 16,
                  fontWeight: '500',
                  color: '#fff'
                }
              ]}>
                Documents vérifiés
              </Text>
            </View>
          )}
        </View>
      );
    }
    return null;
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchPendingProperties();
  }, []);

  useEffect(() => {
    console.log('État actuel:', {
      nombrePropriétés: properties.length,
      estAdmin: isAdmin,
      chargement: loading
    });
  }, [properties, isAdmin, loading]);

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'pending':
        return { backgroundColor: '#FFA000' };
      case 'approved':
        return { backgroundColor: '#4CAF50' };
      case 'rejected':
        return { backgroundColor: '#F44336' };
      default:
        return { backgroundColor: '#999' };
    }
  };

  const filterButtonStyle = (active) => ({
    padding: 10,
    marginHorizontal: 5,
    backgroundColor: active ? '#4CAF50' : '#E8E8E8',
    borderRadius: 5,
  });

  const filterTextStyle = (active) => ({
    color: active ? 'white' : 'black',
    fontWeight: active ? 'bold' : 'normal',
  });

  const getFilteredProperties = () => {
    if (!properties) return [];
    return properties.filter(property => {
      if (statusFilter === 'all') return true;
      return property.status === statusFilter;
    });
  };

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Vérification des droits d'accès...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {!loading && (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FFFFFF"
            />
          }
        >
          {/* Boutons de filtre */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, statusFilter === 'all' && styles.activeTab]}
              onPress={() => setStatusFilter('all')}
            >
              <Text style={[styles.tabText, statusFilter === 'all' && styles.activeTabText]}>Tous</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, statusFilter === 'pending' && styles.activeTab]}
              onPress={() => setStatusFilter('pending')}
            >
              <Text style={[styles.tabText, statusFilter === 'pending' && styles.activeTabText]}>En attente</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, statusFilter === 'approved' && styles.activeTab]}
              onPress={() => setStatusFilter('approved')}
            >
              <Text style={[styles.tabText, statusFilter === 'approved' && styles.activeTabText]}>Approuvés</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, statusFilter === 'rejected' && styles.activeTab]}
              onPress={() => setStatusFilter('rejected')}
            >
              <Text style={[styles.tabText, statusFilter === 'rejected' && styles.activeTabText]}>Rejetés</Text>
            </TouchableOpacity>
          </View>

          {/* Liste des propriétés filtrées */}
          {getFilteredProperties().map((property) => (
            renderPropertyCard(property)
          ))}
        </ScrollView>
      )}

      <Modal
        visible={imageModalVisible}
        transparent={true}
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => {
              setImageModalVisible(false);
              setSelectedImage(null);
            }}
          >
            <MaterialIcons name="close" size={24} color="white" />
          </TouchableOpacity>
          {selectedImage && renderImageDocument(selectedImage)}
        </View>
      </Modal>

      <Modal
        visible={showRejectModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRejectModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Motif du rejet</Text>
            <TextInput
              style={styles.rejectInput}
              multiline
              numberOfLines={4}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Entrez le motif du rejet..."
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}>
                <Text style={styles.modalButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={() => handleReject(selectedPropertyId)}>
                <Text style={styles.modalButtonText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#2C2C2E',
    borderBottomWidth: 1,
    borderBottomColor: '#3C3C3E',
  },
  tab: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#3C3C3E',
    marginHorizontal: 5,
  },
  activeTab: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    color: '#E0E0E0',
    fontSize: 14,
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  propertyCard: {
    padding: 15,
    backgroundColor: '#2C2C2E',
    borderBottomWidth: 1,
    borderBottomColor: '#3C3C3E',
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#FFFFFF',
  },
  warningContainer: {
    backgroundColor: '#3C3C3E',
    padding: 15,
    borderRadius: 8,
    marginHorizontal: 10,
    marginTop: 10,
  },
  warningText: {
    color: '#FFD700',
    fontSize: 14,
  },
  propertyInfo: {
    marginBottom: 15,
  },
  propertyInfoText: {
    color: '#E0E0E0',
  },
  section: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
    color: '#FFFFFF',
  },
  description: {
    marginBottom: 10,
    color: '#E0E0E0',
  },
  verificationStatus: {
    marginBottom: 10,
  },
  verificationText: {
    color: '#E0E0E0',
    marginLeft: 5,
  },
  verifiedText: {
    color: '#4CAF50',
  },
  verifyButton: {
    backgroundColor: '#FFA726',
  },
  verifiedButton: {
    backgroundColor: '#4CAF50',
  },
  actionButton: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 5,
    alignItems: 'center',
    width: '100%',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#2C2C2E',
    borderTopWidth: 1,
    borderTopColor: '#3C3C3E',
  },
  approveButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    flex: 1,
    marginLeft: 8,
    backgroundColor: '#f44336',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 1,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20
  },
  modalContent: {
    backgroundColor: '#2C2C2E',
    padding: 20,
    borderRadius: 10,
    width: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#FFFFFF',
  },
  rejectInput: {
    borderWidth: 1,
    borderColor: '#3C3C3E',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    color: '#FFFFFF',
    backgroundColor: '#3C3C3E',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
  },
  confirmButton: {
    backgroundColor: '#F44336',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  blueButton: {
    backgroundColor: '#2196F3',
  },
  documentButton: {
    backgroundColor: '#FF9800',
    marginTop: 5,
  },
  issuesContainer: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  issuesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 5,
  },
  issueText: {
    color: '#856404',
  },
  noImageText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginVertical: 10,
  },
  noDocumentText: {
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
    marginVertical: 10,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 20,
  },
  viewedBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  viewCount: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 2,
    opacity: 0.9,
  },
});
