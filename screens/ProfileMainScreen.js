import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import NewProfileScreen from './NewProfileScreen';
import FavoritesScreen from './FavoritesScreen';

const ProfileMainScreen = ({ navigation }) => {
  const [currentScreen, setCurrentScreen] = useState('profile');

  const renderScreen = () => {
    switch (currentScreen) {
      case 'favorites':
        return (
          <View style={styles.container}>
            <FavoritesScreen 
              navigation={navigation}
              onBack={() => setCurrentScreen('profile')} 
            />
          </View>
        );
      default:
        return (
          <View style={styles.container}>
            <NewProfileScreen 
              navigation={navigation}
              onShowFavorites={() => setCurrentScreen('favorites')} 
            />
          </View>
        );
    }
  };

  return renderScreen();
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  }
});

export default ProfileMainScreen;
