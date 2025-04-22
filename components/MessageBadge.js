import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MessageBadge = ({ count }) => {
  if (!count || count <= 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E53935',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: -8,
    top: -8,
    paddingHorizontal: 6,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default MessageBadge;
