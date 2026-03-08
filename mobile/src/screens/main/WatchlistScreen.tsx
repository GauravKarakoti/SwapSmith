import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { Star, Bell, AlertCircle, Plus } from 'lucide-react-native';

import { theme } from '../../theme/theme';
import { authenticatedFetch } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

export default function WatchlistScreen() {
  const { user } = useAuth();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWatchlist = async (isRefetch = false) => {
    if (!user) return;

    if (isRefetch) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await authenticatedFetch(`/api/watchlist?userId=${user.uid}`);
      if (!res.ok) throw new Error('Failed to fetch watchlist');

      const data = await res.json();
      setWatchlist(data.watchlist || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error connecting to SwapSmith backend');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, [user]);

  const renderWatchItem = ({ item }: { item: any }) => (
    <View style={styles.watchItem}>
      <View style={styles.itemMeta}>
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>{item.coin.substring(0, 1)}</Text>
        </View>
        <View>
          <Text style={styles.coinTitle}>{item.coin}</Text>
          <Text style={styles.coinNetwork}>{item.network}</Text>
        </View>
      </View>

      <View style={styles.itemActions}>
        <TouchableOpacity style={styles.alertBtn}>
          <Bell color={theme.colors.warning} size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <View style={styles.iconBox}>
            <Star color="#fff" size={20} />
          </View>
          <Text style={styles.headerTitle}>My <Text style={styles.headerTitleAccent}>Watchlist</Text></Text>
        </View>
      </View>

      {/* Content Area */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.warning} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <AlertCircle color={theme.colors.error} size={48} />
          <Text style={styles.errorTitle}>Watchlist Unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={watchlist}
          keyExtractor={(item, index) => `${item.coin}-${item.network}-${index}`}
          renderItem={renderWatchItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchWatchlist(true)}
              tintColor={theme.colors.warning}
              colors={[theme.colors.warning]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Star color={theme.colors.tertiary} size={48} />
              </View>
              <Text style={styles.emptyTitle}>Watchlist is Empty</Text>
              <Text style={styles.emptyText}>Track your favorite assets and get alerts for price changes.</Text>

              <TouchableOpacity style={styles.addBtn}>
                <Plus color="#fff" size={20} />
                <Text style={styles.addBtnText}>Add Asset</Text>
              </TouchableOpacity>
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
    backgroundColor: theme.colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.warning,
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
    color: theme.colors.warning,
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
  watchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    color: theme.colors.warning,
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
  },
  coinTitle: {
    color: theme.colors.primary,
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
  },
  coinNetwork: {
    color: theme.colors.tertiary,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 12,
  },
  alertBtn: {
    padding: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    marginTop: 40,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 24,
  },
  emptyTitle: {
    color: theme.colors.primary,
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: 12,
  },
  emptyText: {
    color: theme.colors.secondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.warning,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: theme.borderRadius.lg,
  },
  addBtnText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
  }
});
