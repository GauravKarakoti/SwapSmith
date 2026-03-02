/**
 * Terminal SideShift order statuses shared between order-monitor and database helpers.
 * Centralising here prevents the two modules from drifting out of sync.
 */
export const TERMINAL_STATUSES_LIST: string[] = ['settled', 'expired', 'refunded', 'failed'];
