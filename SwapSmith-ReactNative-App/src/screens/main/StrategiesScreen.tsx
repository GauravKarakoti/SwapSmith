import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme/theme';

export default function StrategiesScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Strategies Marketplace</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: theme.colors.primary,
        fontSize: 20,
        fontFamily: theme.typography.fontFamily.bold,
    }
});
