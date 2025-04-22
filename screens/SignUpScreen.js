import React, { useState } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import { Input, Button } from 'react-native-elements';
import { supabase } from '../config/supabase';

export default function SignUpScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');

  async function signUp() {
    if (!email || !password || !phone || !name) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    try {
      // Inscription avec Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            phone,
            name,
          },
        },
      });

      if (authError) throw authError;

      Alert.alert(
        'Vérifiez votre email',
        'Un lien de confirmation a été envoyé à votre adresse email.'
      );
      navigation.navigate('SignIn');
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inscription</Text>
      
      <Input
        placeholder="Nom complet"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <Input
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <Input
        placeholder="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <Input
        placeholder="Numéro de téléphone"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      <Button
        title="S'inscrire"
        onPress={signUp}
        loading={loading}
        containerStyle={styles.button}
      />

      <Button
        title="Déjà un compte ? Se connecter"
        type="clear"
        onPress={() => navigation.navigate('SignIn')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#000',
  },
  button: {
    marginVertical: 15,
  },
});
