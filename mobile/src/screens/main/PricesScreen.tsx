import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    SafeAreaView,
    ActivityIndicator,
    TextInput
} from 'react-native';
import { TrendingUp, Search, RefreshCw, AlertCircle } from 'lucide-react-native';

import { theme } from '../../theme/theme';
import { authenticatedFetch } from '../../services/api';
import CoinCard from '../../components/CoinCard';

interface CoinPrice {
    coin: string;
    name: string;
    network: string;
    usdPrice?: string;
    change24h?: number;
}

export default function PricesScreen() {
    const [coins, setCoins] = useState<CoinPrice[]>([]);
    const [filteredCoins, setFilteredCoins] = useState<CoinPrice[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchPrices = async (isRefetch = false) => {
        if (isRefetch) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            const res = await authenticatedFetch('/api/prices');
            if (!res.ok) throw new Error('Failed to fetch prices. Check your connection to the server.');

            const data = await res.json();

            // Inject some mock 24h changes since the Sideshift API doesn't provide them reliably
            const pricesWithMockChanges = (data.prices || []).map((coin: any) => ({
                ...coin,
                change24h: (Math.random() * 10) - 5
            }));

            setCoins(pricesWithMockChanges);
            setFilteredCoins(pricesWithMockChanges);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error connecting to SwapSmith backend');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPrices();
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredCoins(coins);
        } else {
            const q = searchQuery.toLowerCase();
            setFilteredCoins(coins.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.coin.toLowerCase().includes(q) ||
                c.network.toLowerCase().includes(q)
            ));
        }
    }, [searchQuery, coins]);

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                    <View style={styles.iconBox}>
                        <TrendingUp color="#fff" size={20} />
                    </View>
                    <Text style={styles.headerTitle}>Market <Text style={styles.headerTitleAccent}>Pulse</Text></Text>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputWrapper}>
                    <Search color={theme.colors.tertiary} size={18} style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search assets or networks..."
                        placeholderTextColor={theme.colors.tertiary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {/* Content Area */}
            {loading && !refreshing ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={theme.colors.accentLight} />
                </View>
            ) : error ? (
                <View style={styles.centerContainer}>
                    <AlertCircle color={theme.colors.error} size={48} />
                    <Text style={styles.errorTitle}>Market Feed Interrupted</Text>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredCoins}
                    keyExtractor={(item) => `${item.coin}-${item.network}`}
                    renderItem={({ item }) => <CoinCard {...item} />}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchPrices(true)}
                            tintColor={theme.colors.accentLight}
                            colors={[theme.colors.accentLight]}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No assets found matching "{searchQuery}"</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: theme.colors.backgroundAlt,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: theme.colors.accent,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    headerTitle: {
        color: theme.colors.primary,
        fontSize: 24,
        fontFamily: theme.typography.fontFamily.black,
        letterSpacing: -0.5,
    },
    headerTitleAccent: {
        color: theme.colors.accentLight,
    },
    searchContainer: {
        padding: 16,
        paddingBottom: 8,
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.lg,
        paddingHorizontal: 16,
        height: 48,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        color: theme.colors.primary,
        fontSize: 15,
        fontFamily: theme.typography.fontFamily.medium,
    },
    listContainer: {
        padding: 16,
        paddingBottom: 100, // For bottom tabs
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorTitle: {
        color: theme.colors.error,
        fontSize: 18,
        fontFamily: theme.typography.fontFamily.bold,
        marginTop: 16,
        marginBottom: 8,
    },
    errorText: {
        color: theme.colors.secondary,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
    },
    emptyContainer: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        color: theme.colors.tertiary,
        fontSize: 15,
        fontFamily: theme.typography.fontFamily.medium,
    }
});
