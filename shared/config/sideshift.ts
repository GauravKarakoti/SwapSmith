export const SIDESHIFT_CONFIG = {
  BASE_URL: 'https://sideshift.ai/api/v2',
  PAY_URL: 'https://pay.sideshift.ai',
  TRACKING_URL: 'https://sideshift.ai/transactions',
  SUCCESS_URL: 'https://sideshift.ai/success',
  CANCEL_URL: 'https://sideshift.ai/cancel',
  CHECKOUT_URL: 'https://pay.sideshift.ai/checkout',
  HELP_URL: 'https://help.sideshift.ai/en/',
  FAQ_URL: 'https://docs.sideshift.ai/faq/',
  DISPLAY_NAME: 'SideShift.ai',
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
 * @param endpoint - The API endpoint path (e.g., 'quotes', 'checkout')
 * @returns Full API URL
 */
export function getApiUrl(endpoint: string): string {
  return `${SIDESHIFT_CONFIG.BASE_URL}/${endpoint}`;
}
