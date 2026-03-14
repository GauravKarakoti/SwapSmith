/**
 * Crypto Favorites Utility
 * Manages user's favorite cryptocurrencies using localStorage
 */

export interface FavoriteCrypto {
  coin: string;
  name: string;
  network: string;
}

const FAVORITES_STORAGE_KEY = 'swapsmith_crypto_favorites';

/**
 * Get all favorite cryptocurrencies from localStorage
 */
export function getFavorites(): FavoriteCrypto[] {
  try {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading crypto favorites:', error);
    return [];
  }
}

/**
 * Save favorites to localStorage
 */
export function saveFavorites(favorites: FavoriteCrypto[]): void {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch (error) {
    console.error('Error saving crypto favorites:', error);
  }
}

/**
 * Add a cryptocurrency to favorites
 */
export function addToFavorites(crypto: FavoriteCrypto): void {
  const favorites = getFavorites();
  const key = `${crypto.coin}-${crypto.network}`;
  
  // Check if already exists
  const exists = favorites.some(fav => `${fav.coin}-${fav.network}` === key);
  if (!exists) {
    favorites.push(crypto);
    saveFavorites(favorites);
  }
}

/**
 * Remove a cryptocurrency from favorites
 */
export function removeFromFavorites(coin: string, network: string): void {
  const favorites = getFavorites();
  const key = `${coin}-${network}`;
  const filtered = favorites.filter(fav => `${fav.coin}-${fav.network}` !== key);
  saveFavorites(filtered);
}

/**
 * Check if a cryptocurrency is in favorites
 */
export function isFavorite(coin: string, network: string): boolean {
  const favorites = getFavorites();
  const key = `${coin}-${network}`;
  return favorites.some(fav => `${fav.coin}-${fav.network}` === key);
}

/**
 * Toggle favorite status of a cryptocurrency
 */
export function toggleFavorite(crypto: FavoriteCrypto): boolean {
  const isCurrentlyFavorite = isFavorite(crypto.coin, crypto.network);
  
  if (isCurrentlyFavorite) {
    removeFromFavorites(crypto.coin, crypto.network);
    return false;
  } else {
    addToFavorites(crypto);
    return true;
  }
}

/**
 * Sort coins array to show favorites first
 */
export function sortWithFavorites<T extends { coin: string; network?: string }>(
  coins: T[],
  favorites?: FavoriteCrypto[]
): T[] {
  const favs = favorites || getFavorites();
  const favoriteKeys = new Set(favs.map(fav => `${fav.coin}-${fav.network}`));
  
  return coins.sort((a, b) => {
    const aKey = `${a.coin}-${a.network || ''}`;
    const bKey = `${b.coin}-${b.network || ''}`;
    const aIsFav = favoriteKeys.has(aKey);
    const bIsFav = favoriteKeys.has(bKey);
    
    // Favorites first
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;
    
    // Then alphabetical
    return a.coin.localeCompare(b.coin);
  });
}