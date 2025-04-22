import React from 'react';
import { View, StyleSheet } from 'react-native';

const WebInput = ({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  containerStyle,
  inputStyle,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <input
        type={secureTextEntry ? 'password' : keyboardType === 'email-address' ? 'email' : 'text'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        style={{
          ...styles.input,
          ...inputStyle,
        }}
        autoCapitalize={autoCapitalize}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 8,
  },
  input: {
    height: 48,
    width: '100%',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#86939e',
    borderRadius: 5,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    outline: 'none',
    color: '#000',
  },
});

export default WebInput;
