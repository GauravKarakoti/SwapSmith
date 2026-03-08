import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { theme } from '../theme/theme';

interface CoinCardProps {
    coin: string;
    name: string;
    network: string;
    usdPrice?: string;
    change24h?: number;
}

export default function CoinCard({ coin, name, network, usdPrice, change24h = 0 }: CoinCardProps) {
    const isPositive = change24h >= 0;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Text style={styles.iconText}>{coin.substring(0, 1)}</Text>
                </View>
                <View style={styles.titleContainer}>
                    <Text style={styles.coinName} numberOfLines={1}>{name}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{network}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.priceContainer}>
                <Text style={styles.price}>
                    ${parseFloat(usdPrice || '0').toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </Text>
                <View style={[styles.changeContainer, isPositive ? styles.changePositive : styles.changeNegative]}>
                    {isPositive ? (
                        <TrendingUp size={12} color={theme.colors.success} />
                    ) : (
                        <TrendingDown size={12} color={theme.colors.error} />
                    )}
                    <Text style={[styles.changeText, isPositive ? styles.textPositive : styles.textNegative]}>
                        {Math.abs(change24h).toFixed(2)}%
                    </Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    iconText: {
        color: theme.colors.primary,
        fontSize: 18,
        fontFamily: theme.typography.fontFamily.bold,
    },
    titleContainer: {
        flex: 1,
    },
    coinName: {
        color: theme.colors.primary,
        fontSize: 16,
        fontFamily: theme.typography.fontFamily.bold,
        marginBottom: 4,
    },
    badge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    badgeText: {
        color: theme.colors.tertiary,
        fontSize: 10,
        fontFamily: theme.typography.fontFamily.bold,
        textTransform: 'uppercase',
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    price: {
        color: theme.colors.primary,
        fontSize: 20,
        fontFamily: theme.typography.fontFamily.bold,
    },
    changeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    changePositive: {
        backgroundColor: 'rgba(52,211,153,0.1)',
    },
    changeNegative: {
        backgroundColor: 'rgba(248,113,113,0.1)',
    },
    changeText: {
        fontSize: 12,
        fontFamily: theme.typography.fontFamily.bold,
    },
    textPositive: {
        color: theme.colors.success,
    },
    textNegative: {
        color: theme.colors.error,
    }
});
