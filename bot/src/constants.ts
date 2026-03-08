/**
 * Terminal SideShift order statuses shared between order-monitor and database helpers.
 * Centralising here prevents the two modules from drifting out of sync.
 */
export const TERMINAL_STATUSES_LIST: string[] = ['settled', 'expired', 'refunded', 'failed'];

/**
 * Configuration documentation for environment variables
 * 
 * WORKER & SCHEDULER INTERVALS (milliseconds):
 * - PRICE_ALERT_CHECK_INTERVAL_MS: How often price alerts are checked (default: 60000ms = 60 seconds)
 * - ORDER_MONITOR_TICK_INTERVAL_MS: Order monitoring loop interval (default: 10000ms = 10 seconds)
 * - DCA_SCHEDULER_CHECK_INTERVAL_MS: DCA schedule processing interval (default: 60000ms = 60 seconds)
 * 
 * ORDER PROCESSING LIMITS:
 * - MAX_CONCURRENT_ORDERS: Maximum concurrent SideShift API calls (default: 5)
 * 
 * DCA TIMING (minutes):
 * - DCA_RETRY_DELAY_MINUTES: Wait time before retrying failed DCA executions (default: 5 minutes)
 * - DCA_MAX_PROCESSING_TIME_MINUTES: Maximum time allocated for processing a schedule (default: 10 minutes)
 * 
 * SIDESHIFT CONFIGURATION:
 * - SIDESHIFT_API_KEY: SideShift API key for server-side operations (REQUIRED)
 * - SIDESHIFT_AFFILIATE_ID: Optional affiliate ID (fallback to AFFILIATE_ID)
 * - SIDESHIFT_CLIENT_IP: Client IP for SideShift requests
 */
