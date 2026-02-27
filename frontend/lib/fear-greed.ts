/**
 * Fear & Greed Index Utility
 * Fetches data from alternative.me Crypto API
 */

export interface FearGreedData {
  value: number;
  value_classification: string;
  timestamp: number;
  time_until_update: string;
}

export interface FearGreedIndex {
  current: FearGreedData;
  history: FearGreedData[];
}

/**
 * Fetch current Fear & Greed Index
 */
export async function fetchFearGreedIndex(): Promise<FearGreedData> {
  try {
    const response = await fetch(
      'https://api.alternative.me/fng/?limit=1'
    );
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.data && data.data.length > 0) {
      const item = data.data[0];
      return {
        value: parseInt(item.value),
        value_classification: item.value_classification,
        timestamp: parseInt(item.timestamp),
        time_until_update: data.data[0].time_until_update || '',
      };
    }
    
    throw new Error('No data returned from API');
  } catch (error) {
    console.error('Error fetching Fear & Greed Index:', error);
    // Return fallback data
    return {
      value: 50,
      value_classification: 'Neutral',
      timestamp: Date.now() / 1000,
      time_until_update: '',
    };
  }
}

/**
 * Fetch historical Fear & Greed Index data
 * @param limit Number of days to fetch (default 7)
 */
export async function fetchFearGreedHistory(limit: number = 7): Promise<FearGreedData[]> {
  try {
    const response = await fetch(
      `https://api.alternative.me/fng/?limit=${limit}`
    );
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.data) {
      return data.data.map((item: any) => ({
        value: parseInt(item.value),
        value_classification: item.value_classification,
        timestamp: parseInt(item.timestamp),
        time_until_update: '',
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching Fear & Greed History:', error);
    return [];
  }
}

/**
 * Get color based on Fear & Greed value
 */
export function getFearGreedColor(value: number): string {
  if (value <= 25) return '#ef4444'; // Extreme Fear - Red
  if (value <= 45) return '#f97316'; // Fear - Orange
  if (value <= 55) return '#eab308'; // Neutral - Yellow
  if (value <= 75) return '#22c55e'; // Greed - Light Green
  return '#15803d'; // Extreme Greed - Green
}

/**
 * Get emoji based on Fear & Greed value
 */
export function getFearGreedEmoji(value: number): string {
  if (value <= 25) return '😱'; // Extreme Fear
  if (value <= 45) return '😰'; // Fear
  if (value <= 55) return '😐'; // Neutral
  if (value <= 75) return '😊'; // Greed
  return '🤑'; // Extreme Greed
}

/**
 * Get label based on Fear & Greed value
 */
export function getFearGreedLabel(value: number): string {
  if (value <= 25) return 'Extreme Fear';
  if (value <= 45) return 'Fear';
  if (value <= 55) return 'Neutral';
  if (value <= 75) return 'Greed';
  return 'Extreme Greed';
}
