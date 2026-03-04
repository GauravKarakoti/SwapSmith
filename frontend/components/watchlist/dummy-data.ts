import { WatchlistItem } from './types';

// Dummy data for testing and development
// This will be replaced with API data in production
export const dummyWatchlistItems: WatchlistItem[] = [
  {
    id: '1',
    name: 'Bitcoin',
    symbol: 'BTC',
    network: 'bitcoin',
    price: 64250.00,
    change24h: 2.45,
    sparklineData: [62000, 62500, 63100, 62800, 63500, 64000, 63800, 64200, 64100, 64250],
    marketCap: 1260000000000,
    volume24h: 28500000000,
    addedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    name: 'Ethereum',
    symbol: 'ETH',
    network: 'ethereum',
    price: 3120.45,
    change24h: -1.32,
    sparklineData: [3200, 3180, 3150, 3160, 3140, 3130, 3110, 3125, 3115, 3120],
    marketCap: 375000000000,
    volume24h: 15200000000,
    addedAt: new Date('2024-01-10'),
  },
  {
    id: '3',
    name: 'Solana',
    symbol: 'SOL',
    network: 'solana',
    price: 142.85,
    change24h: 5.67,
    sparklineData: [130, 132, 135, 138, 136, 139, 141, 140, 142, 143],
    marketCap: 65000000000,
    volume24h: 3200000000,
    addedAt: new Date('2024-01-20'),
  },
  {
    id: '4',
    name: 'Cardano',
    symbol: 'ADA',
    network: 'cardano',
    price: 0.58,
    change24h: -0.85,
    sparklineData: [0.60, 0.59, 0.58, 0.59, 0.57, 0.58, 0.57, 0.58, 0.57, 0.58],
    marketCap: 20500000000,
    volume24h: 450000000,
    addedAt: new Date('2024-01-18'),
  },
  {
    id: '5',
    name: 'Avalanche',
    symbol: 'AVAX',
    network: 'avalanche',
    price: 38.92,
    change24h: 3.21,
    sparklineData: [36, 36.5, 37, 37.2, 37.8, 38, 38.2, 38.5, 38.7, 39],
    marketCap: 14200000000,
    volume24h: 580000000,
    addedAt: new Date('2024-01-22'),
  },
  {
    id: '6',
    name: 'Polkadot',
    symbol: 'DOT',
    network: 'polkadot',
    price: 7.85,
    change24h: 1.45,
    sparklineData: [7.5, 7.55, 7.6, 7.58, 7.65, 7.7, 7.72, 7.78, 7.8, 7.85],
    marketCap: 10200000000,
    volume24h: 320000000,
    addedAt: new Date('2024-01-12'),
  },
];

// Helper function to generate random sparkline data
export const generateSparkline = (basePrice: number, volatility: number = 0.05): number[] => {
  const points = 10;
  const data: number[] = [];
  let currentPrice = basePrice * (1 - volatility);
  
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.5) * volatility * basePrice;
    currentPrice = Math.max(currentPrice + change, basePrice * (1 - volatility * 2));
    data.push(currentPrice);
  }
  
  // Ensure the last point is close to the actual price
  data[data.length - 1] = basePrice;
  
  return data;
};
