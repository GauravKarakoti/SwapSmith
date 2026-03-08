import { db } from '@/shared/lib/db';
import { adminAuditLog } from '@/shared/schema';
import type { AdminAuditLog } from '@/shared/schema';

/**
 * Interface for logging admin actions
 */
export interface AuditLogParams {
  adminId: string;          // Firebase UID of the admin
  adminEmail: string;       // Email of the admin
  action: string;           // Action performed (e.g., 'approve_admin_request')
  targetResource?: string;  // Resource type (e.g., 'user', 'admin_request', 'config')
  targetId?: string;        // ID of the affected resource
  metadata?: Record<string, any>; // Additional context
  ipAddress?: string;       // IP address of the admin
  userAgent?: string;       // User agent of the admin
}

/**
 * Logs an admin action to the audit log table
 * 
 * @param params - Audit log parameters
 * @returns Promise<AdminAuditLog | null> - The created audit log entry (first element from returning()), or null if failed
 */
export async function logAdminAction(params: AuditLogParams): Promise<AdminAuditLog | null> {
  try {
    const [auditLogEntry] = await db.insert(adminAuditLog).values({
      adminId: params.adminId,
      adminEmail: params.adminEmail,
      action: params.action,
      targetResource: params.targetResource ?? null,
      targetId: params.targetId ?? null,
      metadata: params.metadata ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    }).returning();

    return auditLogEntry;
  } catch (error) {
    console.error('[Audit Logger] Failed to log admin action:', error);
    // Don't throw - audit logging should not break the main operation
    return null;
  }
}

/**
 * Helper function to extract IP address from request headers
 */
export function getIpAddress(headers: Headers): string | undefined {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() ||
         headers.get('x-real-ip') ||
         undefined;
}

/**
 * Helper function to extract user agent from request headers
 */
export function getUserAgent(headers: Headers): string | undefined {
  return headers.get('user-agent') || undefined;
}

/**
 * Audit log action constants for consistency
 */
export const AUDIT_ACTIONS = {
  // Admin request actions
  APPROVE_ADMIN_REQUEST: 'approve_admin_request',
  REJECT_ADMIN_REQUEST: 'reject_admin_request',
  
  // User management actions
  SUSPEND_USER: 'suspend_user',
  UNSUSPEND_USER: 'unsuspend_user',
  FLAG_USER: 'flag_user',
  UNFLAG_USER: 'unflag_user',
  
  // Coin management actions
  GIFT_COINS: 'gift_coins',
  DEDUCT_COINS: 'deduct_coins',
  RESET_COINS: 'reset_coins',
  GIFT_COINS_ALL: 'gift_coins_all',
  
  // Platform configuration actions
  UPDATE_SWAP_CONFIG: 'update_swap_config',
  TOGGLE_EMERGENCY_STOP: 'toggle_emergency_stop',
  UPDATE_API_KEYS: 'update_api_keys',
  
  // Analytics & monitoring actions
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_USER_SWAPS: 'view_user_swaps',
  VIEW_SWAP_DETAILS: 'view_swap_details',
  VIEW_AUDIT_LOG: 'view_audit_log',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

/**
 * System-level admin ID constant for actions performed via email links
 * (e.g., approve/reject admin requests via master admin email)
 */
export const SYSTEM_ADMIN_ID = 'SYSTEM_MASTER_ADMIN';
