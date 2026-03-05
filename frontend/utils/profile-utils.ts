/**
 * Profile Page Business Logic Utilities
 * Separates data processing and business logic from UI components
 */

type SwapRecord = {
  status?: string;
  createdAt?: string | Date;
  settleAmount?: number | string;
  [key: string]: unknown;
};

/**
 * Validate password strength
 * @param password - The password to validate
 * @returns Object with isStrong boolean and feedback message
 */
export function validatePasswordStrength(password: string) {
  const checks = {
    length: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  const strength = passedChecks <= 2 ? 'weak' : passedChecks <= 4 ? 'medium' : 'strong';

  return {
    isStrong: passedChecks >= 4,
    strength,
    checks,
    feedback: getPasswordFeedback(checks),
  };
}

/**
 * Get password feedback based on checks
 */
function getPasswordFeedback(checks: Record<string, boolean>): string[] {
  const feedback: string[] = [];
  if (!checks.length) feedback.push('Password must be at least 8 characters');
  if (!checks.hasUppercase) feedback.push('Add uppercase letters');
  if (!checks.hasLowercase) feedback.push('Add lowercase letters');
  if (!checks.hasNumbers) feedback.push('Add numbers');
  if (!checks.hasSpecialChar) feedback.push('Add special characters');
  return feedback;
}

/**
 * Validate email format
 * @param email - Email to validate
 * @returns Boolean
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Calculate total swap volume from swap history
 * @param swaps - Array of swap history items
 * @returns Total volume in USD (estimated)
 */
export function calculateTotalSwapVolume(swaps: SwapRecord[]): number {
  return swaps.reduce((total, swap) => {
    const amount = typeof swap.settleAmount === 'string' 
      ? parseFloat(swap.settleAmount) 
      : swap.settleAmount || 0;
    return total + (isNaN(amount) ? 0 : amount);
  }, 0);
}

/**
 * Analyze user statistics from swap history
 * @param swaps - Array of swap history items
 * @returns Statistics object
 */
export function analyzeSwapStatistics(swaps: SwapRecord[]): {
  totalSwaps: number;
  successfulSwaps: number;
  failedSwaps: number;
  pendingSwaps: number;
  successRate: number;
  totalVolume: number;
  averageSwapSize: number;
  lastSwapDate: Date | null;
} {
  const totalSwaps = swaps.length;
  const successfulSwaps = swaps.filter(s => s.status === 'completed' || s.status === 'success').length;
  const failedSwaps = swaps.filter(s => s.status === 'failed').length;
  const pendingSwaps = swaps.filter(s => s.status === 'pending').length;

  const totalVolume = calculateTotalSwapVolume(swaps);
  const averageSwapSize = totalSwaps > 0 ? totalVolume / totalSwaps : 0;

  const lastSwap = swaps[swaps.length - 1];
  const lastSwapDate = lastSwap?.createdAt ? new Date(lastSwap.createdAt as string | number | Date) : null;

  return {
    totalSwaps,
    successfulSwaps,
    failedSwaps,
    pendingSwaps,
    successRate: totalSwaps > 0 ? (successfulSwaps / totalSwaps) * 100 : 0,
    totalVolume,
    averageSwapSize,
    lastSwapDate,
  };
}

/**
 * Format large numbers for display
 * @param value - Number to format
 * @param decimals - Decimal places
 * @returns Formatted string
 */
export function formatLargeNumber(value: number, decimals: number = 2): string {
  if (value >= 1e9) {
    return (value / 1e9).toFixed(decimals) + 'B';
  }
  if (value >= 1e6) {
    return (value / 1e6).toFixed(decimals) + 'M';
  }
  if (value >= 1e3) {
    return (value / 1e3).toFixed(decimals) + 'K';
  }
  return value.toFixed(decimals);
}

/**
 * Check if user has admin privileges
 * @param roles - User roles/permissions
 * @returns Boolean
 */
export function isAdmin(roles: string[] | string): boolean {
  const roleList = Array.isArray(roles) ? roles : [roles];
  return roleList.includes('admin') || roleList.includes('superadmin');
}

/**
 * Filter swaps by date range
 * @param swaps - Array of swaps
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Filtered swaps
 */
export function filterSwapsByDateRange(
  swaps: SwapRecord[],
  startDate: Date,
  endDate: Date
): SwapRecord[] {
  return swaps.filter((swap) => {
    if (!swap.createdAt) return false;
    const swapDate = new Date(swap.createdAt as string | number | Date);
    return swapDate >= startDate && swapDate <= endDate;
  });
}

/**
 * Sort swaps by field
 * @param swaps - Array of swaps
 * @param field - Field to sort by
 * @param ascending - Sort direction
 * @returns Sorted swaps
 */
export function sortSwaps(
  swaps: SwapRecord[],
  field: string,
  ascending: boolean = false
): SwapRecord[] {
  return [...swaps].sort((a, b) => {
    const valueA = a[field] as string | number | null | undefined;
    const valueB = b[field] as string | number | null | undefined;

    if (valueA == null) return ascending ? 1 : -1;
    if (valueB == null) return ascending ? -1 : 1;
    if (valueA < valueB) return ascending ? -1 : 1;
    if (valueA > valueB) return ascending ? 1 : -1;
    return 0;
  });
}
