/**
 * Watchlist Component Types
 * Designed for scalability - ready for WebSocket updates, sorting, filtering, and drag reorder
 */

export interface WatchlistItem {
  id: string;
  name: string;
  symbol: string;
  network: string;
  price: number;
  change24h: number;
  sparklineData?: number[];
  marketCap?: number;
  volume24h?: number;
  iconUrl?: string;
  addedAt: Date | string;
}

export interface WatchlistState {
  items: WatchlistItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export type SortOption = 'name' | 'price' | 'change24h' | 'marketCap' | 'addedAt';
export type SortDirection = 'asc' | 'desc';

export interface WatchlistSort {
  option: SortOption;
  direction: SortDirection;
}

export interface WatchlistFilters {
  search: string;
  network: string | null;
  showPositiveOnly: boolean;
  priceRange: {
    min: number | null;
    max: number | null;
  };
}
