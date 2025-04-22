import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme, Platform } from 'react-native';

export const ThemeContext = createContext();

const THEME_KEY = '@app_theme';

// Helper pour gérer le stockage sur différentes plateformes
const storage = {
  async getItem(key) {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(key);
      } else {
        return await AsyncStorage.getItem(key);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du thème:', error);
      return null;
    }
  },
  async setItem(key, value) {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
      return true;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du thème:', error);
      return false;
    }
  }
};

export const ThemeProvider = ({ children }) => {
  const systemTheme = useColorScheme();
  const [theme, setTheme] = useState('system');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await storage.getItem(THEME_KEY);
      if (savedTheme) {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error('Erreur lors du chargement du thème:', error);
    } finally {
      setLoading(false);
    }
  };

  const setThemeMode = async (newTheme) => {
    try {
      await storage.setItem(THEME_KEY, newTheme);
      setTheme(newTheme);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du thème:', error);
    }
  };

  const getCurrentTheme = () => {
    if (theme === 'system') {
      return systemTheme || 'light';
    }
    return theme;
  };

  const isDark = getCurrentTheme() === 'dark';

  const colors = {
    background: isDark ? '#000000' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    primary: '#4CAF50',
    secondary: isDark ? '#333333' : '#F5F5F5',
    border: isDark ? '#333333' : '#E0E0E0',
    card: isDark ? '#1A1A1A' : '#FFFFFF',
    notification: '#FF4444',
  };

  if (loading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ 
      isDarkMode: isDark, 
      setThemeMode, 
      theme: getCurrentTheme(),
      colors 
    }}>
      {!loading && children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
