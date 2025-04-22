import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Dimensions,
  TextInput,
  StyleSheet,
  Alert,
  TouchableWithoutFeedback,
  Linking,
} from 'react-native';
import { Text, Input, Button } from 'react-native-elements';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
// Utiliser directement l'objet navigation fourni par les props
import { useTheme } from '../context/ThemeContext';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Picker } from '@react-native-picker/picker';
import { decode } from 'base64-arraybuffer';
import { Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function AddPropertyScreen({ navigation }) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [fullScreenDoc, setFullScreenDoc] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    type: 'Maison',  // Valeur par défaut
    city: '',
    phone: '',
    transaction_type: 'vente',
    rooms: '',
    bathrooms: '',
    surface: '',
    images: []
  });
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [citySearch, setCitySearch] = useState('');
  const [showCityInput, setShowCityInput] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(true);
  const translateYAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showScrollIndicator) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(translateYAnim, {
            toValue: 5,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(translateYAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          })
        ])
      );
      
      animation.start();

      return () => {
        animation.stop();
      };
    }
  }, [showScrollIndicator]);

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isEndReached = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isEndReached && showScrollIndicator) {
      setShowScrollIndicator(false);
    } else if (!isEndReached && !showScrollIndicator) {
      setShowScrollIndicator(true);
    }
  };

  const toggleDropdown = (dropdown) => {
    if (activeDropdown === dropdown) {
      setActiveDropdown(null);
    } else {
      setActiveDropdown(dropdown);
    }
  };

  // Fonction pour télécharger les images vers Supabase Storage
  const uploadImages = async (userId) => {
    const uploadedUrls = [];
    
    // Upload des nouvelles images
    for (const image of selectedImages) {
      try {
        // Extraire l'extension du fichier
        const uri = image.uri;
        const fileExt = uri.substring(uri.lastIndexOf('.') + 1);
        
        // Créer un chemin unique pour l'image
        const filePath = `${userId}/${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        
        // Récupérer les données binaires de l'image
        let fileData;
        if (Platform.OS === 'web') {
          fileData = image;
        } else {
          const response = await fetch(uri);
          const blob = await response.blob();
          fileData = blob;
        }

        // Télécharger l'image vers Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from('property-images')
          .upload(filePath, fileData, {
            contentType: image.type || 'image/jpeg'
          });

        if (uploadError) {
          console.error('Erreur lors du téléchargement de l\'image:', uploadError);
          throw uploadError;
        }
        
        // Récupérer l'URL publique de l'image
        const { data: { publicUrl } } = supabase.storage
          .from('property-images')
          .getPublicUrl(filePath);
        
        console.log('Image téléchargée avec succès:', publicUrl);
        uploadedUrls.push(publicUrl);
      } catch (error) {
        console.error('Erreur lors de l\'upload de l\'image:', error);
        throw error;
      }
    }

    return uploadedUrls;
  };

  // Fonction pour soumettre le formulaire et naviguer vers l'écran de paiement
  const handleSubmit = async () => {
    try {
      setLoading(true);

      // Validation des champs requis
      if (!formData.title || !formData.description || !formData.price || !formData.city || !formData.phone) {
        Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
        setLoading(false);
        return;
      }

      // Vérifier qu'au moins une image a été sélectionnée
      if (selectedImages.length === 0) {
        Alert.alert('Erreur', 'Veuillez ajouter au moins une image de votre bien');
        setLoading(false);
        return;
      }

      // Récupération de l'utilisateur connecté
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Erreur d\'authentification:', userError);
        Alert.alert('Erreur', 'Veuillez vous connecter pour publier une annonce');
        setLoading(false);
        return;
      }

      // Télécharger les images vers Supabase Storage
      console.log('Téléchargement des images...');
      const imageUrls = await uploadImages(user.id);
      console.log('Images téléchargées:', imageUrls);

      // Créer un nouvel objet propriété avec les données du formulaire
      const newProperty = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        type: formData.type,
        city: formData.city,
        phone: formData.phone,
        transaction_type: formData.transaction_type,
        rooms: formData.rooms ? parseInt(formData.rooms) : null,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
        surface: formData.surface ? parseFloat(formData.surface) : null,
        images: imageUrls,
        owner_id: user.id,
        status: 'pending', // En attente de validation après paiement
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Insérer la propriété dans la base de données
      const { data: property, error: insertError } = await supabase
        .from('properties')
        .insert(newProperty)
        .select()
        .single();

      if (insertError) {
        console.error('Erreur lors de l\'insertion de la propriété:', insertError);
        Alert.alert('Erreur', 'Impossible de créer l\'annonce. Veuillez réessayer.');
        setLoading(false);
        return;
      }

      console.log('Propriété créée avec succès:', property);
      
      // Créer une intention de paiement directement dans la base de données
      // Cette étape est cruciale pour résoudre le problème d'intention de paiement manquante
      const paymentIntentId = `pi_${Math.random().toString(36).substring(2, 15)}`;
      const clientSecret = `seti_${Math.random().toString(36).substring(2, 15)}_secret_${Math.random().toString(36).substring(2, 15)}`;
      
      console.log('Création d\'une intention de paiement simulée:', {
        payment_intent_id: paymentIntentId,
        property_id: property.id,
        user_id: user.id
      });
      
      const { data: paymentIntent, error: paymentIntentError } = await supabase
        .from('payment_intents')
        .insert({
          payment_intent_id: paymentIntentId,
          client_secret: clientSecret,
          amount: 5000, // Montant fixe pour les frais de publication (5000 FCFA)
          currency: 'xof',
          status: 'requires_capture',
          user_id: user.id,
          property_id: property.id,
          captured: false,
          created_at: new Date().toISOString()
        })
        .select();

      if (paymentIntentError) {
        console.error('Erreur lors de la création de l\'intention de paiement:', paymentIntentError);
        console.error('Code:', paymentIntentError.code);
        console.error('Message:', paymentIntentError.message);
        console.error('Détails:', paymentIntentError.details);
      } else {
        console.log('Intention de paiement créée avec succès:', paymentIntent);
      }

      // Naviguer vers l'écran de paiement avec les détails nécessaires
      navigation.navigate('PaymentScreen', {
        propertyId: property.id,
        userId: user.id,
        amount: 5000, // Montant fixe pour les frais de publication (5000 FCFA)
        paymentType: 'listing_fee',
        formData: JSON.stringify(newProperty),
        returnScreen: 'Home',
        paymentIntentId: paymentIntentId // Ajouter l'ID de l'intention de paiement
      });
    } catch (error) {
      console.error('Erreur lors de la soumission du formulaire:', error);
      Alert.alert('Erreur', 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const closeAllDropdowns = () => {
    setActiveDropdown(null);
  };

  // Liste des villes principales du Mali
  const cities = [
    'Bamako',
    'Sikasso',
    'Ségou',
    'Mopti',
    'Koutiala',
    'Kayes',
    'Gao',
    'Kati',
    'Kolokani',
    'Koulikoro',
    'Dioïla',
    'San',
    'Bougouni',
    'Kita',
    'Tombouctou',
    'Bandiagara',
    'Niono',
    'Markala',
    'Fana',
    'Nioro du Sahel',
    'Macina',
    'Kolondiéba',
    'Yorosso',
    'Yanfolila',
    'Diéma',
    'Bafoulabé',
    'Banamba',
    'Nara',
    'Djenné',
    'Douentza'
  ].sort();

  const filteredCities = cities.filter(city =>
    city.toLowerCase().includes(citySearch.toLowerCase())
  );

  const selectCity = (city) => {
    setFormData({ ...formData, city });
    setCitySearch(city);
    setActiveDropdown(null);
  };

  const handleCityInputChange = (text) => {
    setCitySearch(text);
    setFormData({ ...formData, city: text });
    if (!activeDropdown) {
      setActiveDropdown('city');
    }
  };

  const handleCityInputSubmit = () => {
    if (citySearch.trim()) {
      selectCity(citySearch.trim());
    }
  };

  const transactionOptions = [
    { label: 'À vendre', value: 'vente' },
    { label: 'À louer', value: 'location' },
  ];

  // Types de biens immobiliers
  const propertyTypes = [
    'Maison',
    'Appartement',
    'Terrain',
    'Bureau',
    'Commerce',
    'Autre'
  ].sort();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    input: {
      paddingHorizontal: 0,
      marginBottom: 16,
    },
    inputContainer: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    inputText: {
      color: colors.text,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 8,
      color: colors.text,
    },
    imageSection: {
      marginBottom: 20,
    },
    imageRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 10,
      marginHorizontal: -5,
    },
    imagePreviewContainer: {
      position: 'relative',
      width: 140,
      height: 140,
      margin: 5,
    },
    imagePreview: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    addImageButton: {
      width: 140,
      height: 140,
      borderRadius: 8,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      margin: 5,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
    },
    removeImageButton: {
      position: 'absolute',
      top: -10,
      right: -10,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: 15,
      width: 30,
      height: 30,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      marginTop: 20,
      marginBottom: 40,
    },
    submitButtonText: {
      color: 'white',
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '600',
    },
    dropdownContainer: {
      position: 'relative',
      marginTop: 8,
      marginBottom: 20,
      zIndex: 3,
    },
    dropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dropdownButtonActive: {
      borderColor: colors.primary,
    },
    dropdownButtonText: {
      fontSize: 16,
      color: colors.text,
    },
    dropdownMenu: {
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      maxHeight: 300,
      width: '100%',
    },
    dropdownMenuItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    dropdownMenuItemSelected: {
      backgroundColor: colors.primary + '20',
    },
    dropdownMenuItemText: {
      fontSize: 16,
      color: colors.text,
    },
    dropdownMenuItemTextSelected: {
      color: colors.primary,
      fontWeight: '500',
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: colors.text,
      paddingHorizontal: 8,
      height: 40,
    },
    searchInputText: {
      fontSize: 16,
      color: colors.grey3,
    },
    dropdownMenuScroll: {
      maxHeight: 200,
    },
    section: {
      marginVertical: 10,
      padding: 15,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 5,
      color: colors.text,
    },
    subtitle: {
      fontSize: 14,
      color: colors.grey,
      marginBottom: 10,
    },
    documentRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 10,
    },
    documentContainer: {
      width: 100,
      height: 100,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: '#2C2C2E',
      position: 'relative',
    },
    documentThumbnail: {
      width: '100%',
      height: '100%',
      backgroundColor: '#2C2C2E',
    },
    pdfThumbnail: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#2C2C2E',
      padding: 5,
    },
    documentName: {
      fontSize: 10,
      textAlign: 'center',
      marginTop: 5,
      color: colors.text,
    },
    addDocumentButton: {
      width: 100,
      height: 100,
      borderRadius: 8,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#2C2C2E',
    },
    addDocumentText: {
      marginTop: 8,
      fontSize: 12,
      color: colors.text,
    },
    removeDocumentButton: {
      position: 'absolute',
      top: 5,
      right: 5,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeButton: {
      position: 'absolute',
      top: 40,
      right: 20,
      zIndex: 2,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 25,
      padding: 10,
    },
    fullScreenImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    fullScreenPdf: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f5f5f5',
      width: '100%',
      padding: 20,
    },
    pdfName: {
      color: colors.text,
      fontSize: 18,
      marginTop: 20,
      textAlign: 'center',
    },
    documentPreview: {
      width: '100%',
      height: '100%',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.2)',
      paddingHorizontal: 16,
    },
    modalOverlayPropertyType: {
      paddingTop: 120,
    },
    modalOverlayTransactionType: {
      paddingTop: 150,
    },
    modalOverlayCity: {
      paddingTop: 180,
    },
    scrollIndicator: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
      justifyContent: 'center',
      alignItems: 'center',
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      overflow: 'hidden',
    },
    scrollIndicatorGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 60,
    },
    scrollIndicatorIcon: {
      color: colors.text,
      opacity: 0.7,
    },
  });

  const pickImage = async () => {
    if (selectedImages.length >= 5) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez pas ajouter plus de 5 images.');
      return;
    }

    try {
      // Vérifier les permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin de votre permission pour accéder à vos photos.');
        return;
      }

      // Lancer le sélecteur d'images avec des options plus simples
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,  // Réduire légèrement la qualité pour éviter les problèmes de taille
        allowsMultipleSelection: false
      });

      // Vérifier si l'utilisateur a sélectionné une image
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (!asset.uri) {
          throw new Error('URI de l\'image non disponible');
        }

        // Créer un objet image simplifié sans dépendre du base64
        const imageObject = {
          uri: asset.uri,
          width: asset.width || 0,
          height: asset.height || 0,
          type: asset.mimeType || 'image/jpeg',
          fileName: asset.fileName || `image_${Date.now()}.jpg`
        };

        console.log('Image sélectionnée avec succès:', {
          uri: imageObject.uri,
          type: imageObject.type,
          width: imageObject.width,
          height: imageObject.height
        });

        // Convertir l'image en base64
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onload = () => {
          const base64data = reader.result;
          
          // Ajouter l'image à la liste des images sélectionnées
          const updatedImages = [...selectedImages, imageObject];
          setSelectedImages(updatedImages);
          
          // Mettre à jour formData avec l'image en base64
          setFormData(prevFormData => ({
            ...prevFormData,
            images: [...(prevFormData.images || []), base64data]
          }));
          
          console.log('formData mis à jour avec l\'image en base64');
        };
        
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Erreur détaillée lors de la sélection de l\'image:', error);
      Alert.alert(
        'Erreur',
        'Impossible de charger l\'image. Veuillez réessayer avec une autre image.'
      );
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin de votre permission pour accéder à la caméra');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const photo = result.assets[0];
        const processedDoc = {
          uri: photo.uri,
          type: 'image/jpeg',
          name: `Photo_${Date.now()}.jpg`,
          size: photo.fileSize || 0,
        };
        setSelectedDocuments(prev => [...prev, processedDoc]);
      }
    } catch (error) {
      console.error('Erreur lors de la prise de photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo.');
    }
  };

  const processDocument = (document) => {
    if (selectedDocuments.length >= 3) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez pas ajouter plus de 3 documents.');
      return;
    }

    // Créer un objet document uniforme quelle que soit la source
    const processedDoc = {
      uri: document.uri,
      type: document.type || document.mimeType || 'image/jpeg',
      name: document.name || `Document_${Date.now()}`,
      size: document.size || 0,
    };

    setSelectedDocuments(prev => [...prev, processedDoc]);
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const photo = result.assets[0];
        const processedDoc = {
          uri: photo.uri,
          type: 'image/jpeg',
          name: `Photo_${Date.now()}.jpg`,
          size: photo.fileSize || 0,
        };
        setSelectedDocuments(prev => [...prev, processedDoc]);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection de la photo:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner la photo.');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const document = result.assets[0];
        if (document.size > 5 * 1024 * 1024) {
          Alert.alert('Fichier trop volumineux', 'La taille du document ne doit pas dépasser 5MB.');
          return;
        }
        processDocument(document);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection du document:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner le document.');
    }
  };

  const showDocumentOptions = () => {
    if (selectedDocuments.length >= 3) {
      Alert.alert('Limite atteinte', 'Vous ne pouvez pas ajouter plus de 3 documents.');
      return;
    }

    Alert.alert(
      'Ajouter un document',
      'Choisissez une option',
      [
        {
          text: 'Prendre une photo',
          onPress: takePhoto
        },
        {
          text: 'Choisir depuis la galerie',
          onPress: pickFromGallery
        },
        {
          text: 'Choisir un document',
          onPress: pickDocument
        },
        {
          text: 'Annuler',
          style: 'cancel'
        }
      ]
    );
  };

  const uploadFiles = async () => {
    try {
      console.log('Début du processus d\'upload des fichiers');
      const uploadedDocuments = [];
      const uploadedImages = [];

      // Upload des documents
      if (selectedDocuments.length > 0) {
        console.log('Début upload des documents');
        for (const document of selectedDocuments) {
          console.log('Traitement du document:', document);

          // Si le document est déjà sur Supabase, utiliser directement son URL
          if (document.uri && document.uri.includes('supabase.co')) {
            console.log('Document déjà sur Supabase, réutilisation de l\'URL:', document.uri);
            uploadedDocuments.push(document.uri);
            continue;
          }

          // Déterminer l'extension et le type de contenu en fonction du type MIME
          let extension = '.pdf';
          let contentType = 'application/pdf';
          
          if (document.type) {
            if (document.type.startsWith('image/')) {
              extension = document.type === 'image/png' ? '.png' : '.jpg';
              contentType = document.type;
            }
          }

          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}${extension}`;
          console.log('Nom du fichier à uploader:', fileName);

          try {
            console.log('Lecture du fichier...');
            const fileContent = await FileSystem.readAsStringAsync(document.uri, {
              encoding: FileSystem.EncodingType.Base64
            });
            console.log('Fichier lu avec succès, conversion en base64 OK');

            console.log('Début upload vers Supabase...');
            const { data, error } = await supabase.storage
              .from('property-documents')
              .upload(fileName, decode(fileContent), {
                contentType: contentType,
                cacheControl: '3600',
                upsert: false
              });

            if (error) {
              throw error;
            }

            console.log('Upload réussi:', data);

            const { data: urlData } = supabase.storage
              .from('property-documents')
              .getPublicUrl(fileName);

            if (!urlData || !urlData.publicUrl) {
              throw new Error('Impossible d\'obtenir l\'URL publique');
            }

            console.log('URL publique générée:', urlData.publicUrl);
            uploadedDocuments.push(urlData.publicUrl);

          } catch (error) {
            console.error('Erreur détaillée lors de l\'upload du document:', error);
            throw new Error('Erreur lors de l\'upload du document: ' + error.message);
          }
        }
      }

      // Upload des images
      if (selectedImages.length > 0) {
        console.log('Début upload des images');
        for (const image of selectedImages) {
          console.log('Contenu de l\'image:', JSON.stringify({
            uri: image.uri,
            type: image.type,
            hasBase64: !!image.base64,
            width: image.width,
            height: image.height
          }));

          // Si l'image est déjà sur Supabase, utiliser directement son URL
          if (image.uri && image.uri.includes('supabase.co')) {
            console.log('Image déjà sur Supabase, réutilisation de l\'URL:', image.uri);
            uploadedImages.push(image.uri);
            continue;
          }

          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
          console.log('Nom du fichier à uploader:', fileName);

          try {
            // Essayer de lire le fichier si base64 n'est pas disponible
            let fileContent;
            if (!image.base64) {
              console.log('Base64 non disponible, tentative de lecture du fichier...');
              fileContent = await FileSystem.readAsStringAsync(image.uri, {
                encoding: FileSystem.EncodingType.Base64
              });
            } else {
              fileContent = image.base64;
            }

            console.log('Upload de l\'image vers Supabase...');
            const { data, error } = await supabase.storage
              .from('property-images')
              .upload(fileName, decode(fileContent), {
                contentType: 'image/jpeg',
                cacheControl: '3600',
                upsert: false
              });

            if (error) {
              throw error;
            }

            console.log('Upload réussi:', data);

            const { data: urlData } = supabase.storage
              .from('property-images')
              .getPublicUrl(fileName);

            if (!urlData || !urlData.publicUrl) {
              throw new Error('Impossible d\'obtenir l\'URL publique');
            }

            console.log('URL publique générée:', urlData.publicUrl);
            uploadedImages.push(urlData.publicUrl);

          } catch (error) {
            console.error('Erreur détaillée lors de l\'upload de l\'image:', error);
            throw new Error('Erreur lors de l\'upload de l\'image: ' + error.message);
          }
        }
      }

      return { documents: uploadedDocuments, images: uploadedImages };
    } catch (error) {
      console.error('Erreur lors de l\'upload des fichiers:', error);
      throw error;
    }
  };



  const renderImage = (image, index) => (
    <View key={index} style={styles.imagePreviewContainer}>
      <TouchableOpacity
        style={styles.imagePreview}
        onPress={() => setSelectedImage(image)}
      >
        <Image 
          source={{ uri: image.uri }} 
          style={styles.imagePreview}
          resizeMode="cover"
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.removeImageButton}
        onPress={() => {
          const newImages = [...selectedImages];
          newImages.splice(index, 1);
          setSelectedImages(newImages);
        }}
      >
        <MaterialIcons name="close" size={16} color="white" />
      </TouchableOpacity>
    </View>
  );

  const renderFullScreenModal = () => (
    <Modal
      visible={fullScreenDoc !== null}
      transparent={true}
      onRequestClose={() => setFullScreenDoc(null)}
    >
      <View style={styles.modalContainer}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => setFullScreenDoc(null)}
        >
          <MaterialIcons name="close" size={30} color="white" />
        </TouchableOpacity>
        
        {fullScreenDoc && (
          fullScreenDoc.type.startsWith('image/') ? (
            <Image
              source={{ uri: fullScreenDoc.uri }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.fullScreenPdf}>
              <MaterialIcons name="description" size={100} color="white" />
              <Text style={styles.pdfName}>{fullScreenDoc.name}</Text>
            </View>
          )
        )}
      </View>
    </Modal>
  );

  const renderDocuments = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Documents justificatifs</Text>
      <Text style={styles.subtitle}>Ajoutez des photos de vos documents (titre de propriété, etc.)</Text>
      
      <View style={styles.documentRow}>
        {selectedDocuments.map((doc, index) => (
          <View key={index} style={styles.documentContainer}>
            <TouchableOpacity
              style={styles.documentThumbnail}
              onPress={() => setFullScreenDoc(doc)}
            >
              {doc.type.startsWith('image/') ? (
                <Image 
                  source={{ uri: doc.uri }} 
                  style={styles.documentThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.pdfThumbnail}>
                  <MaterialIcons name="description" size={40} color={colors.text} />
                  <Text style={styles.documentName} numberOfLines={1}>
                    {doc.name}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeDocumentButton}
              onPress={() => {
                const newDocs = [...selectedDocuments];
                newDocs.splice(index, 1);
                setSelectedDocuments(newDocs);
              }}
            >
              <MaterialIcons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>
        ))}
        
        {selectedDocuments.length < 3 && (
          <TouchableOpacity 
            style={styles.addDocumentButton}
            onPress={showDocumentOptions}
          >
            <MaterialIcons name="add-photo-alternate" size={24} color={colors.text} />
            <Text style={styles.addDocumentText}>{selectedDocuments.length}/3</Text>
          </TouchableOpacity>
        )}
      </View>
      {renderFullScreenModal()}
    </View>
  );

  return (
    <ScrollView 
      style={styles.container}
      onScrollBeginDrag={closeAllDropdowns}
      keyboardShouldPersistTaps="handled"
    >
      {/* Modal pour la prévisualisation des photos */}
      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setSelectedImage(null)}
          >
            <MaterialIcons name="close" size={30} color="white" />
          </TouchableOpacity>
          
          {selectedImage && (
            <Image
              source={{ uri: selectedImage.uri }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      <View style={styles.imageSection}>
        <Text style={styles.sectionTitle}>Photos du bien (max 5)</Text>
        <View style={styles.imageRow}>
          {selectedImages.map((image, index) => renderImage(image, index))}
          {selectedImages.length < 5 && (
            <TouchableOpacity 
              style={styles.addImageButton} 
              onPress={pickImage}
            >
              <MaterialIcons name="add-photo-alternate" size={24} color={colors.text} />
              <Text style={{marginTop: 4, fontSize: 10, color: colors.text, textAlign: 'center'}}>
                {selectedImages.length}/5
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Input
        placeholder="Titre de l'annonce"
        value={formData.title}
        onChangeText={(text) => setFormData({ ...formData, title: text })}
        containerStyle={styles.input}
        inputContainerStyle={styles.inputContainer}
        inputStyle={styles.inputText}
      />

      <Input
        placeholder="Description"
        value={formData.description}
        onChangeText={(text) => setFormData({ ...formData, description: text })}
        multiline
        numberOfLines={4}
        containerStyle={styles.input}
        inputContainerStyle={[styles.inputContainer, { height: 100 }]}
        inputStyle={styles.inputText}
      />

      <Input
        placeholder="Prix (FCFA)"
        value={formData.price}
        onChangeText={(text) => setFormData({ ...formData, price: text })}
        keyboardType="numeric"
        containerStyle={styles.input}
        inputContainerStyle={styles.inputContainer}
        inputStyle={styles.inputText}
      />

      <View style={[styles.section, { zIndex: 5 }]}>
        <Text style={styles.sectionTitle}>Type de bien</Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={[
              styles.dropdownButton,
              activeDropdown === 'propertyType' && styles.dropdownButtonActive
            ]}
            onPress={() => toggleDropdown('propertyType')}
          >
            <Text style={styles.dropdownButtonText}>
              {formData.type || 'Sélectionnez un type de bien'}
            </Text>
            <MaterialIcons
              name={activeDropdown === 'propertyType' ? "arrow-drop-up" : "arrow-drop-down"}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          {activeDropdown === 'propertyType' && (
            <Modal
              visible={true}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setActiveDropdown(null)}
            >
              <TouchableWithoutFeedback onPress={() => setActiveDropdown(null)}>
                <View style={[styles.modalOverlay, styles.modalOverlayPropertyType]}>
                  <View style={styles.dropdownMenu}>
                    <ScrollView 
                      style={styles.dropdownMenuScroll}
                      showsVerticalScrollIndicator={false}
                      onScroll={handleScroll}
                      scrollEventThrottle={16}
                    >
                      {propertyTypes.map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.dropdownMenuItem,
                            formData.type === type && styles.dropdownMenuItemSelected
                          ]}
                          onPress={() => {
                            setFormData({ 
                              ...formData, 
                              type,
                              ...(type === 'Terrain' ? { rooms: '', bathrooms: '' } : {})
                            });
                            setActiveDropdown(null);
                          }}
                        >
                          <Text style={[
                            styles.dropdownMenuItemText,
                            formData.type === type && styles.dropdownMenuItemTextSelected
                          ]}>
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {showScrollIndicator && (
                      <View style={styles.scrollIndicator}>
                        <LinearGradient
                          colors={['transparent', 'rgba(0, 0, 0, 0.1)']}
                          style={styles.scrollIndicatorGradient}
                        />
                        <Animated.View 
                          style={{ transform: [{ translateY: translateYAnim }] }}
                        >
                          <MaterialIcons name="keyboard-arrow-down" size={24} style={styles.scrollIndicatorIcon} />
                        </Animated.View>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}
        </View>
      </View>

      <View style={[styles.section, { zIndex: 4 }]}>
        <Text style={styles.sectionTitle}>Type de transaction</Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={[
              styles.dropdownButton,
              activeDropdown === 'transactionType' && styles.dropdownButtonActive
            ]}
            onPress={() => toggleDropdown('transactionType')}
          >
            <Text style={styles.dropdownButtonText}>
              {transactionOptions.find(opt => opt.value === formData.transaction_type)?.label}
            </Text>
            <MaterialIcons
              name={activeDropdown === 'transactionType' ? "arrow-drop-up" : "arrow-drop-down"}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          {activeDropdown === 'transactionType' && (
            <Modal
              visible={true}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setActiveDropdown(null)}
            >
              <TouchableWithoutFeedback onPress={() => setActiveDropdown(null)}>
                <View style={[styles.modalOverlay, styles.modalOverlayTransactionType]}>
                  <View style={styles.dropdownMenu}>
                    {transactionOptions.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.dropdownMenuItem,
                          formData.transaction_type === option.value && styles.dropdownMenuItemSelected
                        ]}
                        onPress={() => {
                          setFormData({ ...formData, transaction_type: option.value });
                          setActiveDropdown(null);
                        }}
                      >
                        <Text style={[
                          styles.dropdownMenuItemText,
                          formData.transaction_type === option.value && styles.dropdownMenuItemTextSelected
                        ]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}
        </View>
      </View>

      <View style={[styles.section, { zIndex: 3 }]}>
        <Text style={styles.sectionTitle}>Ville</Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={[
              styles.dropdownButton,
              activeDropdown === 'city' && styles.dropdownButtonActive
            ]}
            onPress={() => toggleDropdown('city')}
          >
            <Text style={styles.dropdownButtonText}>
              {formData.city || 'Sélectionnez une ville'}
            </Text>
            <MaterialIcons
              name={activeDropdown === 'city' ? "arrow-drop-up" : "arrow-drop-down"}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          {activeDropdown === 'city' && (
            <Modal
              visible={true}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setActiveDropdown(null)}
            >
              <TouchableWithoutFeedback onPress={() => setActiveDropdown(null)}>
                <View style={[styles.modalOverlay, styles.modalOverlayCity]}>
                  <View style={styles.dropdownMenu}>
                    <View style={styles.searchInputContainer}>
                      <MaterialIcons name="search" size={20} color={colors.text} />
                      <TouchableOpacity 
                        style={[styles.searchInput, { justifyContent: 'center' }]}
                        onPress={() => {
                          setShowCityInput(true);
                        }}
                      >
                        {!showCityInput ? (
                          <Text style={[
                            styles.searchInputText,
                            citySearch && { color: colors.text }
                          ]}>
                            {citySearch || "Rechercher ou saisir une ville"}
                          </Text>
                        ) : (
                          <TextInput
                            style={[styles.searchInput, { padding: 0 }]}
                            value={citySearch}
                            onChangeText={handleCityInputChange}
                            onSubmitEditing={handleCityInputSubmit}
                            placeholder="Rechercher ou saisir une ville"
                            placeholderTextColor={colors.grey3}
                            autoFocus={true}
                            returnKeyType="done"
                            onBlur={() => {
                              setShowCityInput(false);
                              if (!citySearch.trim()) {
                                setActiveDropdown(null);
                              }
                            }}
                          />
                        )}
                      </TouchableOpacity>
                      {citySearch ? (
                        <TouchableOpacity
                          onPress={() => {
                            setCitySearch('');
                            setFormData({ ...formData, city: '' });
                            setShowCityInput(false);
                            setActiveDropdown(null);
                          }}
                        >
                          <MaterialIcons name="close" size={20} color={colors.text} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    <ScrollView 
                      style={styles.dropdownMenuScroll}
                      showsVerticalScrollIndicator={false}
                      onScroll={handleScroll}
                      scrollEventThrottle={16}
                    >
                      {filteredCities.map((city) => (
                        <TouchableOpacity
                          key={city}
                          style={[
                            styles.dropdownMenuItem,
                            formData.city === city && styles.dropdownMenuItemSelected
                          ]}
                          onPress={() => selectCity(city)}
                        >
                          <Text style={[
                            styles.dropdownMenuItemText,
                            formData.city === city && styles.dropdownMenuItemTextSelected
                          ]}>
                            {city}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    {showScrollIndicator && (
                      <View style={styles.scrollIndicator}>
                        <LinearGradient
                          colors={['transparent', 'rgba(0, 0, 0, 0.1)']}
                          style={styles.scrollIndicatorGradient}
                        />
                        <Animated.View 
                          style={{ transform: [{ translateY: translateYAnim }] }}
                        >
                          <MaterialIcons name="keyboard-arrow-down" size={24} style={styles.scrollIndicatorIcon} />
                        </Animated.View>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>
          )}
        </View>
      </View>

      <Input
        placeholder="Numéro de téléphone"
        value={formData.phone}
        onChangeText={(text) => setFormData({ ...formData, phone: text })}
        keyboardType="phone-pad"
        containerStyle={styles.input}
        inputContainerStyle={styles.inputContainer}
        inputStyle={styles.inputText}
      />

      {formData.type !== 'Terrain' && (
        <>
          <Input
            placeholder="Nombre de pièces"
            value={formData.rooms}
            onChangeText={(text) => setFormData({ ...formData, rooms: text })}
            keyboardType="numeric"
            containerStyle={styles.input}
            inputContainerStyle={styles.inputContainer}
            inputStyle={styles.inputText}
          />

          <Input
            placeholder="Nombre de salles de bain"
            value={formData.bathrooms}
            onChangeText={(text) => setFormData({ ...formData, bathrooms: text })}
            keyboardType="numeric"
            containerStyle={styles.input}
            inputContainerStyle={styles.inputContainer}
            inputStyle={styles.inputText}
          />
        </>
      )}

      <Input
        placeholder="Surface (m²)"
        value={formData.surface}
        onChangeText={(text) => setFormData({ ...formData, surface: text })}
        keyboardType="numeric"
        containerStyle={styles.input}
        inputContainerStyle={styles.inputContainer}
        inputStyle={styles.inputText}
      />

      {formData.type === 'Terrain' && renderDocuments()}

      {/* Affichage du montant à payer */}
      <View style={{ alignItems: 'center', marginVertical: 16 }}>
        <Text style={{ fontSize: 18, color: colors.text }}>
          Montant à payer : <Text style={{ fontWeight: 'bold' }}>2500 FCFA</Text>
        </Text>
      </View>

      {/* Bouton de paiement obligatoire */}
      {(() => {
        // Champs requis
        const requiredFields = ['title', 'description', 'price', 'city', 'type', 'phone'];
        const allFieldsFilled = requiredFields.every(key => formData[key]);
        const imagesOk = selectedImages.length > 0;
        // Pour terrain, documents obligatoires
        const docsOk = formData.type === 'Terrain' ? selectedDocuments.length > 0 : true;
        const canPay = allFieldsFilled && imagesOk && docsOk && !loading;
        return canPay ? (
          <Button
            title="Payer maintenant"
            buttonStyle={{ backgroundColor: colors.primary, marginBottom: 12 }}
            onPress={() => {
              // Afficher d'abord un message pour informer l'utilisateur
              Alert.alert(
                'Redirection',
                'Vous allez être redirigé vers l\'écran de paiement.',
                [{ 
                  text: 'OK',
                  onPress: async () => {
                    // Fermer l'écran actuel et revenir à l'écran précédent
                    navigation.goBack();
                    
                    // Utiliser setTimeout pour s'assurer que la navigation précédente est terminée
                    setTimeout(async () => {
                      // Essayer de naviguer vers PaymentScreen depuis l'écran principal
                      console.log('Tentative de navigation vers PaymentScreen depuis l\'\u00e9cran principal...');
                      
                      // Créer un objet avec les paramètres pour PaymentScreen
                      const paymentParams = {
                        propertyId: null, // pas encore créé
                        sellerId: null,   // à adapter selon le contexte
                        amount: 2500,
                        transactionType: formData.transaction_type || 'vente',
                      };
                      
                      // Stocker temporairement les paramètres dans localStorage pour iOS/Android
                      // ou sessionStorage pour le web
                      if (Platform.OS === 'web') {
                        sessionStorage.setItem('paymentParams', JSON.stringify(paymentParams));
                      } else {
                        // Pour les plateformes mobiles, nous utiliserons les paramètres directement
                        global.paymentParams = paymentParams;
                      }
                      
                      // Récupérer l'ID de l'utilisateur actuel (le propriétaire qui publie l'annonce)
                      const { data: { user } } = await supabase.auth.getUser();
                      
                      if (!user) {
                        Alert.alert('Erreur', 'Vous devez être connecté pour effectuer cette action.');
                        return;
                      }
                      
                      // Naviguer vers l'écran de paiement avec le bon nom d'écran
                      navigation.navigate('Payment', {
                        amount: 2500,
                        userId: user.id,
                        paymentType: 'listing_fee', // Indiquer qu'il s'agit d'un paiement pour publier une annonce
                        transactionType: formData.transaction_type || 'vente',
                        formData: JSON.stringify(formData), // Stocker les données du formulaire pour les utiliser après le paiement
                        returnScreen: 'AddPropertyScreen' // Écran à retourner après le paiement
                      });
                    }, 300);
                  }
                }]
              );
            }}
            disabled={loading}
          />
        ) : null;
      })()}

      {/* Bouton de soumission désactivé tant que le paiement n'est pas fait */}
      <TouchableOpacity
        style={[styles.submitButton, { opacity: 0.5 }]}
        disabled={true}
      >
        <Text style={styles.submitButtonText}>Soumettre pour vérification (Paiement requis)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
