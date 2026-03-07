import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    SafeAreaView,
    ActivityIndicator
} from 'react-native';
import { PieChart, ArrowUpRight, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react-native';

import { theme } from '../../theme/theme';
import { authenticatedFetch } from '../../services/api';

export default function PortfolioScreen() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [portfolioData, setPortfolioData] = useState<any>(null);

    const fetchPortfolio = async (isRefetch = false) => {
        if (isRefetch) setRefreshing(true);
        else setLoading(true);
        setError(null);

        try {
            // In a real app, this would fetch from the connected wallet.
            // For SwapSmith, we rely on the backend's saved history or a specific portfolio endpoint.
            // Here we simulate fetching the portfolio targets which is what the web app does.
            const res = await authenticatedFetch('/api/portfolio-targets');
            if (!res.ok) throw new Error('Failed to fetch portfolio data');

            const data = await res.json();
            setPortfolioData(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Error connecting to SwapSmith backend');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPortfolio();
    }, []);

    // Generate some mock data if the API doesn't return exactly what we want for demomstration
    const totalValue = 12450.75;
    const dayChange = 342.12;
    const dayChangePct = +2.8;

    const mockAssets = [
        { coin: 'ETH', name: 'Ethereum', balance: 2.5, value: 8500.50, color: '#627EEA' },
        { coin: 'BTC', name: 'Bitcoin', balance: 0.05, value: 3100.25, color: '#F7931A' },
        { coin: 'SOL', name: 'Solana', balance: 15.2, value: 850.00, color: '#14F195' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerTitleContainer}>
                    <View style={styles.iconBox}>
                        <PieChart color="#fff" size={20} />
                    </View>
                    <Text style={styles.headerTitle}>My <Text style={styles.headerTitleAccent}>Portfolio</Text></Text>
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
                    <Text style={styles.errorTitle}>Portfolio Unavailable</Text>
                    <Text style={styles.errorText}>{error}</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchPortfolio(true)}
                            tintColor={theme.colors.accentLight}
                            colors={[theme.colors.accentLight]}
                        />
                    }
                >
                    {/* Main Balance Card */}
                    <View style={styles.balanceCard}>
                        <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
                        <Text style={styles.balanceValue}>
                            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Text>

                        <View style={styles.changeContainer}>
                            <View style={[styles.changeBadge, { backgroundColor: 'rgba(52,211,153,0.1)' }]}>
                                <TrendingUp color={theme.colors.success} size={14} />
                                <Text style={styles.changePctText}>+{dayChangePct}%</Text>
                            </View>
                            <Text style={styles.changeAbsText}>+${dayChange} Today</Text>
                        </View>
                    </View>

                    {/* Allocation */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Asset Allocation</Text>
                    </View>

                    <View style={styles.allocationCard}>
                        {mockAssets.map((asset, index) => {
                            const pct = (asset.value / totalValue) * 100;
                            return (
                                <View key={asset.coin} style={styles.assetRow}>
                                    <View style={styles.assetInfoRow}>
                                        <View style={[styles.colorDot, { backgroundColor: asset.color }]} />
                                        <View>
                                            <Text style={styles.assetName}>{asset.name}</Text>
                                            <Text style={styles.assetBalance}>{asset.balance} {asset.coin}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.assetValueRow}>
                                        <Text style={styles.assetValue}>${asset.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                                        <Text style={styles.assetPct}>{pct.toFixed(1)}%</Text>
                                    </View>
                                </View>
                            )
                        })}
                    </View>

                    {/* Targets */}
                    {portfolioData?.targetPortfolio && portfolioData.targetPortfolio.length > 0 && (
                        <>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>AI Targets</Text>
                            </View>

                            <View style={styles.targetsCard}>
                                {portfolioData.targetPortfolio.map((target: any, index: number) => (
                                    <View key={target.asset || index} style={styles.targetRow}>
                                        <Text style={styles.targetAsset}>{target.asset}</Text>
                                        <Text style={styles.targetPct}>{target.percentage}%</Text>
                                    </View>
                                ))}

                                <View style={styles.rebalanceBtn}>
                                    <Text style={styles.rebalanceBtnText}>Rebalance Now</Text>
                                    <ArrowUpRight color={theme.colors.accentLight} size={16} />
                                </View>
                            </View>
                        </>
                    )}

                </ScrollView>
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
        backgroundColor: '#8B5CF6',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#8B5CF6',
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
        color: '#A78BFA',
    },
    scrollContent: {
        padding: 20,
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
    balanceCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.xl,
        padding: 24,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 24,
        // Add a slight top glow matching web
        borderTopWidth: 2,
        borderTopColor: 'rgba(139, 92, 246, 0.5)',
    },
    balanceLabel: {
        color: theme.colors.tertiary,
        fontSize: 12,
        fontFamily: theme.typography.fontFamily.bold,
        letterSpacing: 2,
        marginBottom: 12,
    },
    balanceValue: {
        color: theme.colors.primary,
        fontSize: 40,
        fontFamily: theme.typography.fontFamily.black,
        letterSpacing: -1,
        marginBottom: 16,
    },
    changeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    changeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    changePctText: {
        color: theme.colors.success,
        fontSize: 14,
        fontFamily: theme.typography.fontFamily.bold,
    },
    changeAbsText: {
        color: theme.colors.secondary,
        fontSize: 14,
        fontFamily: theme.typography.fontFamily.medium,
    },
    sectionHeader: {
        marginBottom: 16,
        marginTop: 8,
    },
    sectionTitle: {
        color: theme.colors.primary,
        fontSize: 18,
        fontFamily: theme.typography.fontFamily.bold,
    },
    allocationCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: 24,
    },
    assetRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.cardBorder,
    },
    assetInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    assetName: {
        color: theme.colors.primary,
        fontSize: 16,
        fontFamily: theme.typography.fontFamily.bold,
        marginBottom: 2,
    },
    assetBalance: {
        color: theme.colors.tertiary,
        fontSize: 13,
        fontFamily: theme.typography.fontFamily.medium,
    },
    assetValueRow: {
        alignItems: 'flex-end',
    },
    assetValue: {
        color: theme.colors.primary,
        fontSize: 16,
        fontFamily: theme.typography.fontFamily.bold,
        marginBottom: 2,
    },
    assetPct: {
        color: theme.colors.secondary,
        fontSize: 13,
        fontFamily: theme.typography.fontFamily.medium,
    },
    targetsCard: {
        backgroundColor: theme.colors.card,
        borderRadius: theme.borderRadius.lg,
        padding: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    targetRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.cardBorder,
    },
    targetAsset: {
        color: theme.colors.primary,
        fontSize: 15,
        fontFamily: theme.typography.fontFamily.medium,
    },
    targetPct: {
        color: theme.colors.accentLight,
        fontSize: 15,
        fontFamily: theme.typography.fontFamily.bold,
    },
    rebalanceBtn: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        paddingTop: 16,
        marginTop: 8,
    },
    rebalanceBtnText: {
        color: theme.colors.accentLight,
        fontSize: 15,
        fontFamily: theme.typography.fontFamily.bold,
    }
});
