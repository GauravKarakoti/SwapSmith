/**
 * React Hook for Crypto Favorites
 * Provides state management and utilities for favorite cryptocurrencies
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FavoriteCrypto,
  getFavorites,
  addToFavorites,
  removeFromFavorites,
  isFavorite,
  toggleFavorite,
  sortWithFavorites
} from '@/utils/crypto-favorites';

export function useCryptoFavorites() {
  const [favorites, setFavorites] = useState<FavoriteCrypto[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites on mount
  useEffect(() => {
    const loadFavorites = () => {
      const stored = getFavorites();
      setFavorites(stored);
      setIsLoaded(true);
    };

    // Load immediately if localStorage is available
    if (typeof window !== 'undefined') {
      loadFavorites();
    }
  }, []);

  // Add to favorites
  const addFavorite = useCallback((crypto: FavoriteCrypto) => {
    addToFavorites(crypto);
    setFavorites(getFavorites());
  }, []);

  // Remove from favorites
  const removeFavorite = useCallback((coin: string, network: string) => {
    removeFromFavorites(coin, network);
    setFavorites(getFavorites());
  }, []);

  // Toggle favorite status
  const toggleFavoriteStatus = useCallback((crypto: FavoriteCrypto) => {
    const newStatus = toggleFavorite(crypto);
    setFavorites(getFavorites());
    return newStatus;
  }, []);

  // Check if crypto is favorite
  const checkIsFavorite = useCallback((coin: string, network: string) => {
    return isFavorite(coin, network);
  }, []);

  // Sort array with favorites first
  const sortWithFavoritesFirst = useCallback(<T extends { coin: string; network?: string }>(
    items: T[]
  ): T[] => {
    return sortWithFavorites(items, favorites);
  }, [favorites]);

  return {
    favorites,
    isLoaded,
    addFavorite,
    removeFavorite,
    toggleFavorite: toggleFavoriteStatus,
    isFavorite: checkIsFavorite,
    sortWithFavorites: sortWithFavoritesFirst
  };
}