import { useNavigation } from '@react-navigation/native';

export function useStackNavigation() {
  const navigation = useNavigation();

  const navigateToScreen = (screenName, params = {}) => {
    console.log('Navigation vers:', screenName);
    console.log('Navigation state:', navigation.getState());
    
    try {
      // Essayer d'abord la navigation directe
      navigation.navigate(screenName, params);
    } catch (error) {
      console.log('Erreur de navigation directe:', error);
      
      // Si ça échoue, essayer via le parent
      const parent = navigation.getParent();
      if (parent) {
        console.log('Tentative via parent');
        parent.navigate(screenName, params);
      } else {
        console.log('Navigation impossible');
      }
    }
  };

  return {
    navigateToScreen,
  };
}
