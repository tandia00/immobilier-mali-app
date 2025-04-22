import React, { useState } from 'react';
import { View, TouchableOpacity, Linking, StyleSheet, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const DocumentViewer = ({ url, filename }) => {
    const [error, setError] = useState(false);
    const { colors } = useTheme();

    const handlePress = async () => {
        try {
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                setError(true);
            }
        } catch (error) {
            console.error('Erreur lors de l\'ouverture du document:', error);
            setError(true);
        }
    };

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: colors.card }]}
            onPress={handlePress}
        >
            {error ? (
                <View style={styles.errorContainer}>
                    <MaterialIcons name="error" size={24} color={colors.error} />
                    <Text style={[styles.errorText, { color: colors.error }]}>
                        Impossible d'ouvrir le document
                    </Text>
                </View>
            ) : (
                <View style={styles.documentContainer}>
                    <MaterialIcons name="description" size={24} color={colors.text} />
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                        {filename || 'Document'}
                    </Text>
                    <MaterialIcons name="open-in-new" size={20} color={colors.primary} />
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 12,
        borderRadius: 8,
        marginVertical: 8,
    },
    documentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    fileName: {
        flex: 1,
        fontSize: 14,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    errorText: {
        flex: 1,
        fontSize: 14,
    },
});

export default DocumentViewer;
