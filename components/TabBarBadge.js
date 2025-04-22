import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Composant Badge pour afficher un compteur sur les onglets de navigation
 * @param {object} props - Propriétés du composant
 * @param {number} props.count - Nombre à afficher dans le badge
 * @returns {React.Component}
 */
export default function TabBarBadge({ count }) {
  if (!count || count <= 0) {
    return null;
  }

  return (
    <View style={styles.badgeContainer}>
      <Text style={styles.badgeText}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: '#E53935', // Rouge pour la visibilité
    borderRadius: 12,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
