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
  Dimensions,
  TextInput,
} from 'react-native';
import { Button, Text } from 'react-native-elements';
import { supabase } from '../config/supabase';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data && data.session) {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainApp' }],
        });
      }
    } catch (error) {
      Alert.alert('Erreur de connexion', 
        error.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect'
          : error.message
      );
    } finally {
      setLoading(false);
    }
  };

  const InputField = Platform.select({
    web: ({ placeholder, value, onChangeText, secureTextEntry }) => (
      <input
        type={secureTextEntry ? 'password' : 'text'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        style={styles.webInput}
      />
    ),
    default: ({ placeholder, value, onChangeText, secureTextEntry }) => (
      <TextInput
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    ),
  });

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
            <Text h3 style={styles.title}>Connexion</Text>
            
            <View style={styles.inputContainer}>
              {InputField({
                placeholder: "Email",
                value: email,
                onChangeText: setEmail,
              })}
            </View>

            <View style={styles.inputContainer}>
              {InputField({
                placeholder: "Mot de passe",
                value: password,
                onChangeText: setPassword,
                secureTextEntry: true,
              })}
            </View>

            <Button
              title="Se connecter"
              onPress={handleLogin}
              loading={loading}
              containerStyle={styles.buttonContainer}
              buttonStyle={styles.button}
            />

            <Button
              title="Créer un compte"
              type="outline"
              onPress={() => navigation.navigate('Register')}
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
  inputContainer: {
    marginVertical: 8,
    width: '100%',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#86939e',
    borderRadius: 5,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  webInput: {
    height: '48px',
    width: '100%',
    border: '1px solid #86939e',
    borderRadius: '5px',
    padding: '0 12px',
    fontSize: '16px',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
  },
  buttonContainer: {
    marginTop: 10,
    width: '100%',
  },
  button: {
    backgroundColor: '#4CAF50',
  },
});
