// Watchlist Components - Modular Architecture
// Export all components for easy imports

export { default as WatchlistHeader } from './WatchlistHeader';
export { default as WatchlistCard } from './WatchlistCard';
export { default as WatchlistGrid } from './WatchlistGrid';
export { default as EmptyState } from './EmptyState';
export { default as AddTokenModal } from './AddTokenModal';
export { default as WatchlistContainer } from './WatchlistContainer';

// Types
export * from './types';

// Dummy data for development
export { dummyWatchlistItems, generateSparkline } from './dummy-data';
