import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions
} from 'react-native';
import { Input, Button, Text } from 'react-native-elements';
import { supabase } from '../config/supabase';

export default function RegisterScreen({ navigation }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setLoading(true);
      const { data: { user }, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName
          }
        }
      });

      if (error) throw error;
      
      Alert.alert(
        'Succès',
        'Vérifiez votre email pour confirmer votre inscription',
        [{ text: 'OK', onPress: () => {
          navigation.goBack();
        }}]
      );
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            <Text h3 style={styles.title}>Inscription</Text>
            
            <Input
              placeholder="Prénom"
              leftIcon={{ type: 'material', name: 'person' }}
              onChangeText={setFirstName}
              value={firstName}
              autoCapitalize="words"
              textContentType="givenName"
              autoComplete="given-name"
            />

            <Input
              placeholder="Nom"
              leftIcon={{ type: 'material', name: 'person' }}
              onChangeText={setLastName}
              value={lastName}
              autoCapitalize="words"
              textContentType="familyName"
              autoComplete="family-name"
            />

            <Input
              placeholder="Email"
              leftIcon={{ type: 'material', name: 'email' }}
              onChangeText={setEmail}
              value={email}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
            />

            <Input
              placeholder="Mot de passe"
              leftIcon={{ type: 'material', name: 'lock' }}
              onChangeText={setPassword}
              value={password}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="password-new"
            />

            <Input
              placeholder="Confirmer le mot de passe"
              leftIcon={{ type: 'material', name: 'lock' }}
              onChangeText={setConfirmPassword}
              value={confirmPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="password-new"
            />

            <Button
              title="S'inscrire"
              onPress={handleSignUp}
              loading={loading}
              containerStyle={styles.buttonContainer}
              buttonStyle={styles.button}
            />

            <Button
              title="Déjà un compte ? Se connecter"
              type="outline"
              onPress={() => navigation.navigate('Login')}
              containerStyle={styles.buttonContainer}
            />
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const windowHeight = Dimensions.get('window').height;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: windowHeight,
  },
  formContainer: {
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    marginVertical: 10,
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 15,
  },
});
