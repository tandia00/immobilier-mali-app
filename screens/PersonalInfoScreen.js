import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  Modal, 
  TouchableOpacity, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform,
  Keyboard 
} from 'react-native';
import { Input, Button, Text } from 'react-native-elements';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useTheme } from '../context/ThemeContext';

export default function PersonalInfoScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [streetNumber, setStreetNumber] = useState('');
  const [streetName, setStreetName] = useState('');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const { colors } = useTheme();

  const africanCountries = [
    'Mali', 'Sénégal', 'Côte d\'Ivoire', 'Burkina Faso', 'Guinée', 'Niger', 'Mauritanie',
    'Algérie', 'Angola', 'Bénin', 'Botswana', 'Burundi', 'Cameroun', 'Cap-Vert', 
    'République centrafricaine', 'Comores', 'Congo', 'République démocratique du Congo',
    'Djibouti', 'Égypte', 'Érythrée', 'Éthiopie', 'Gabon', 'Gambie', 'Ghana', 'Guinée-Bissau',
    'Guinée équatoriale', 'Kenya', 'Lesotho', 'Liberia', 'Libye', 'Madagascar', 'Malawi',
    'Maroc', 'Maurice', 'Mozambique', 'Namibie', 'Nigeria', 'Ouganda', 'Rwanda',
    'Sao Tomé-et-Principe', 'Seychelles', 'Sierra Leone', 'Somalie', 'Soudan', 'Soudan du Sud',
    'Swaziland', 'Tanzanie', 'Tchad', 'Togo', 'Tunisie', 'Zambie', 'Zimbabwe'
  ];

  const westernCountries = [
    'France', 'Allemagne', 'Royaume-Uni', 'États-Unis', 'Canada', 'Espagne', 'Portugal',
    'Italie', 'Belgique', 'Pays-Bas', 'Suisse', 'Autriche', 'Irlande', 'Danemark', 'Norvège',
    'Suède', 'Finlande', 'Islande', 'Luxembourg', 'Australie', 'Nouvelle-Zélande'
  ];

  const otherCountries = [
    'Chine', 'Japon', 'Corée du Sud', 'Inde', 'Russie', 'Brésil', 'Argentine', 'Mexique',
    'Indonésie', 'Malaisie', 'Singapour', 'Thaïlande', 'Vietnam', 'Philippines', 'Pakistan',
    'Bangladesh', 'Sri Lanka', 'Népal', 'Iran', 'Irak', 'Arabie saoudite', 'Émirats arabes unis',
    'Qatar', 'Koweït', 'Oman', 'Bahreïn', 'Jordanie', 'Liban', 'Israël', 'Turquie'
  ];

  const countries = [
    ...africanCountries.map(country => ({ label: country, value: country, region: 'africa' })),
    ...westernCountries.map(country => ({ label: country, value: country, region: 'western' })),
    ...otherCountries.map(country => ({ label: country, value: country, region: 'other' }))
  ].sort((a, b) => a.label.localeCompare(b.label));

  const isWesternCountry = (country) => {
    return westernCountries.includes(country);
  };

  const cities = {
    'Mali': [
      { label: 'Bamako', value: 'Bamako' },
      { label: 'Sikasso', value: 'Sikasso' },
      { label: 'Ségou', value: 'Segou' },
      { label: 'Mopti', value: 'Mopti' },
      { label: 'Koutiala', value: 'Koutiala' },
      { label: 'Kayes', value: 'Kayes' },
      { label: 'Gao', value: 'Gao' },
      { label: 'Kidal', value: 'Kidal' },
      { label: 'Tombouctou', value: 'Tombouctou' },
      { label: 'San', value: 'San' },
      { label: 'Koulikoro', value: 'Koulikoro' },
      { label: 'Kati', value: 'Kati' },
      { label: 'Markala', value: 'Markala' },
      { label: 'Kolondiéba', value: 'Kolondieba' },
      { label: 'Banamba', value: 'Banamba' },
      { label: 'Niono', value: 'Niono' },
      { label: 'Bougouni', value: 'Bougouni' },
      { label: 'Nioro', value: 'Nioro' },
      { label: 'Yanfolila', value: 'Yanfolila' }
    ],
    'France': [
      { label: 'Paris', value: 'Paris' },
      { label: 'Marseille', value: 'Marseille' },
      { label: 'Lyon', value: 'Lyon' },
      { label: 'Toulouse', value: 'Toulouse' },
      { label: 'Nice', value: 'Nice' },
      { label: 'Nantes', value: 'Nantes' },
      { label: 'Strasbourg', value: 'Strasbourg' },
      { label: 'Montpellier', value: 'Montpellier' },
      { label: 'Bordeaux', value: 'Bordeaux' },
      { label: 'Lille', value: 'Lille' },
      { label: 'Rennes', value: 'Rennes' },
      { label: 'Reims', value: 'Reims' },
      { label: 'Le Havre', value: 'Le Havre' },
      { label: 'Saint-Étienne', value: 'Saint-Etienne' },
      { label: 'Toulon', value: 'Toulon' },
      { label: 'Grenoble', value: 'Grenoble' },
      { label: 'Dijon', value: 'Dijon' },
      { label: 'Angers', value: 'Angers' },
      { label: 'Nîmes', value: 'Nimes' },
      { label: 'Villeurbanne', value: 'Villeurbanne' },
      { label: 'Le Mans', value: 'Le Mans' },
      { label: 'Aix-en-Provence', value: 'Aix-en-Provence' },
      { label: 'Clermont-Ferrand', value: 'Clermont-Ferrand' },
      { label: 'Brest', value: 'Brest' },
      { label: 'Tours', value: 'Tours' },
      { label: 'Amiens', value: 'Amiens' },
      { label: 'Limoges', value: 'Limoges' },
      { label: 'Annecy', value: 'Annecy' },
      { label: 'Perpignan', value: 'Perpignan' },
      { label: 'Boulogne-Billancourt', value: 'Boulogne-Billancourt' },
      { label: 'Metz', value: 'Metz' },
      { label: 'Besançon', value: 'Besancon' },
      { label: 'Orléans', value: 'Orleans' },
      { label: 'Rouen', value: 'Rouen' },
      { label: 'Mulhouse', value: 'Mulhouse' },
      { label: 'Caen', value: 'Caen' },
      { label: 'Nancy', value: 'Nancy' },
      { label: 'Saint-Denis', value: 'Saint-Denis' },
      { label: 'Argenteuil', value: 'Argenteuil' },
      { label: 'Montreuil', value: 'Montreuil' }
    ],
    'Senegal': [
      { label: 'Dakar', value: 'Dakar' },
      { label: 'Thiès', value: 'Thies' },
      { label: 'Saint-Louis', value: 'Saint-Louis' },
    ],
    'Cote d\'Ivoire': [
      { label: 'Abidjan', value: 'Abidjan' },
      { label: 'Yamoussoukro', value: 'Yamoussoukro' },
      { label: 'Bouaké', value: 'Bouake' },
    ],
  };

  useEffect(() => {
    loadUserProfile();
  }, []);

  useEffect(() => {
    setCity('');
  }, [country]);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setEmail(data.email || '');
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setCountry(data.country || '');
        setCity(data.city || '');
        setStreetNumber(data.street_number || '');
        setStreetName(data.street_name || '');
      }
    } catch (error) {
      console.error('Erreur de chargement du profil:', error);
      Alert.alert('Erreur', error.message);
    }
  };

  const updateProfile = async () => {
    try {
      if (!country) {
        Alert.alert('Erreur', 'Veuillez sélectionner un pays');
        return;
      }
      if (!city) {
        Alert.alert('Erreur', 'Veuillez sélectionner une ville');
        return;
      }
      if (isWesternCountry(country) && (!streetNumber || !streetName)) {
        Alert.alert('Erreur', 'Veuillez remplir l\'adresse complète');
        return;
      }

      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non connecté');

      // Mise à jour de toutes les informations
      const updates = {
        id: user.id,
        email,
        full_name: fullName,
        phone,
        country,
        city,
        street_number: isWesternCountry(country) ? streetNumber : null,
        street_name: isWesternCountry(country) ? streetName : null,
        updated_at: new Date(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates);

      if (error) {
        console.error('Erreur de mise à jour:', error);
        throw error;
      }

      Alert.alert('Succès', 'Profil mis à jour avec succès');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderSelectItem = ({ item }) => (
    <TouchableOpacity
      style={styles.selectItem}
      onPress={() => {
        if (showCountryModal) {
          setCountry(item.value);
          setShowCountryModal(false);
        } else {
          setCity(item.value);
          setShowCityModal(false);
        }
      }}
    >
      <Text style={styles.selectItemText}>{item.label}</Text>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      color: colors.text,
      marginBottom: 8,
      fontSize: 16,
      fontWeight: '500',
    },
    input: {
      color: colors.text,
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingHorizontal: 15,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectButton: {
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 15,
      marginBottom: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    selectButtonText: {
      color: colors.text,
      fontSize: 16,
    },
    selectButtonDisabled: {
      opacity: 0.5,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '600',
    },
    closeButton: {
      padding: 5,
    },
    selectItem: {
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    selectItemText: {
      color: colors.text,
      fontSize: 16,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 15,
      borderRadius: 10,
      marginTop: 20,
      marginBottom: 30,
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView 
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator={true}
        scrollEventThrottle={16}
      >
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <Input
            placeholder="Votre email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            inputStyle={styles.input}
            inputContainerStyle={{ borderBottomWidth: 0 }}
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Nom complet</Text>
          <Input
            placeholder="Votre nom complet"
            value={fullName}
            onChangeText={setFullName}
            inputStyle={styles.input}
            inputContainerStyle={{ borderBottomWidth: 0 }}
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Téléphone</Text>
          <Input
            placeholder="Votre numéro de téléphone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            inputStyle={styles.input}
            inputContainerStyle={{ borderBottomWidth: 0 }}
            returnKeyType="next"
          />
        </View>

        <Text style={styles.label}>Pays</Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => {
            Keyboard.dismiss();
            setShowCountryModal(true);
          }}
        >
          <Text style={styles.selectButtonText}>
            {country ? countries.find(c => c.value === country)?.label : 'Sélectionner un pays'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={styles.label}>Ville</Text>
        <TouchableOpacity
          style={[styles.selectButton, !country && styles.selectButtonDisabled]}
          onPress={() => {
            if (country) {
              Keyboard.dismiss();
              setShowCityModal(true);
            }
          }}
          disabled={!country}
        >
          <Text style={styles.selectButtonText}>
            {city ? cities[country]?.find(c => c.value === city)?.label : 'Sélectionner une ville'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={24} color={colors.text} />
        </TouchableOpacity>

        {isWesternCountry(country) && (
          <>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Numéro de rue</Text>
              <Input
                placeholder="Numéro"
                value={streetNumber}
                onChangeText={setStreetNumber}
                keyboardType="numeric"
                inputStyle={styles.input}
                inputContainerStyle={{ borderBottomWidth: 0 }}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nom de la rue</Text>
              <Input
                placeholder="Nom de la rue"
                value={streetName}
                onChangeText={setStreetName}
                inputStyle={styles.input}
                inputContainerStyle={{ borderBottomWidth: 0 }}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>
          </>
        )}

        <Button
          title="Mettre à jour"
          onPress={() => {
            Keyboard.dismiss();
            updateProfile();
          }}
          loading={loading}
          buttonStyle={styles.button}
          titleStyle={styles.buttonText}
        />

        <Modal
          visible={showCountryModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCountryModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Sélectionner un pays</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowCountryModal(false)}
                >
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={countries}
                renderItem={renderSelectItem}
                keyExtractor={item => item.value}
              />
            </View>
          </View>
        </Modal>

        <Modal
          visible={showCityModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCityModal(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Sélectionner une ville</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowCityModal(false)}
                >
                  <MaterialIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <FlatList
                data={cities[country] || []}
                renderItem={renderSelectItem}
                keyExtractor={item => item.value}
              />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
