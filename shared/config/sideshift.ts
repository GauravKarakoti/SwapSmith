/**
 * SideShift API Configuration
 * Centralized configuration for all SideShift URLs with environment variable support
 */

export const SIDESHIFT_CONFIG = {
  // API Configuration - supports environment overrides
  BASE_URL: process.env.SIDESHIFT_API_URL || 'https://sideshift.ai/api/v2',
  PAY_URL: process.env.SIDESHIFT_PAY_URL || 'https://pay.sideshift.ai',
  
  // Tracking and Navigation URLs
  TRACKING_URL: process.env.SIDESHIFT_TRACKING_URL || 'https://sideshift.ai/transactions',
  SUCCESS_URL: process.env.SIDESHIFT_SUCCESS_URL || 'https://sideshift.ai/success',
  CANCEL_URL: process.env.SIDESHIFT_CANCEL_URL || 'https://sideshift.ai/cancel',
  
  // Checkout Configuration
  CHECKOUT_URL: process.env.SIDESHIFT_CHECKOUT_URL || 'https://pay.sideshift.ai/checkout',
  
  // Documentation URLs
  HELP_URL: process.env.SIDESHIFT_HELP_URL || 'https://help.sideshift.ai/en/',
  FAQ_URL: process.env.SIDESHIFT_FAQ_URL || 'https://docs.sideshift.ai/faq/',
  
  // Display Configuration
  DISPLAY_NAME: process.env.SIDESHIFT_DISPLAY_NAME || 'SideShift.ai',
  
  // API Endpoints - commonly used paths
  ENDPOINTS: {
    COINS: 'coins',
    PAIRS: 'pairs', 
    QUOTES: 'quotes',
    ORDERS: 'shifts/fixed',
    CHECKOUT: 'checkout',
    SHIFTS: 'shifts'
  }
} as const;

/**
 * Generate a tracking URL for a specific transaction
 * @param transactionId - The SideShift transaction ID
 * @returns Full tracking URL
 */
export function getTrackingUrl(transactionId: string): string {
  return `${SIDESHIFT_CONFIG.TRACKING_URL}/${transactionId}`;
}

/**
 * Generate a checkout URL for a specific checkout session
 * @param checkoutId - The SideShift checkout ID
 * @returns Full checkout URL
 */
export function getCheckoutUrl(checkoutId: string): string {
  return `${SIDESHIFT_CONFIG.CHECKOUT_URL}/${checkoutId}`;
}

/**
 * Get API endpoint URL
 * @param endpoint - The API endpoint path (e.g., 'quotes', 'checkout') or use ENDPOINTS constants
 * @returns Full API URL
 */
export function getApiUrl(endpoint: string): string {
  return `${SIDESHIFT_CONFIG.BASE_URL}/${endpoint}`;
}

/**
 * Get API endpoint URL using predefined endpoint constants
 * @param endpoint - Key from SIDESHIFT_CONFIG.ENDPOINTS
 * @returns Full API URL
 */
export function getApiEndpoint(endpoint: keyof typeof SIDESHIFT_CONFIG.ENDPOINTS): string {
  return `${SIDESHIFT_CONFIG.BASE_URL}/${SIDESHIFT_CONFIG.ENDPOINTS[endpoint]}`;
}

/**
 * Get affiliate tracking URL
 * @param affiliateId - The affiliate ID
 * @returns Full affiliate URL
 */
export function getAffiliateUrl(affiliateId: string): string {
  return `${SIDESHIFT_CONFIG.TRACKING_URL}/a/${affiliateId}`;
}
