/**
 * API Input Validation Utilities
 * 
 * Centralized validation schemas using Zod for API routes
 * Prevents SQL injection, type coercion vulnerabilities, and DoS attacks
 */

import { z } from 'zod';

/**
 * Common validation schemas
 */
export const schemas = {
  // User ID validation (Firebase UID format)
  userId: z.string().min(1).max(128),
  
  // Numeric ID validation (positive integers)
  numericId: z.number().int().positive(),
  
  // Pagination limit (prevent DoS from huge limits)
  limit: z.number().int().min(1).max(1000).default(50),
  
  // Wallet address validation (Ethereum format)
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  
  // Email validation
  email: z.string().email().max(255),
  
  // Generic string with length limits
  shortString: z.string().min(1).max(255),
  mediumString: z.string().min(1).max(1000),
  longString: z.string().min(1).max(10000),
  
  // Boolean validation
  boolean: z.boolean().or(z.string().transform(val => val === 'true')),
  
  // JSON string validation
  jsonString: z.string().transform((str, ctx) => {
    try {
      return JSON.parse(str);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid JSON string',
      });
      return z.NEVER;
    }
  }),
};

/**
 * Swap history query parameters schema
 */
export const swapHistoryQuerySchema = z.object({
  userId: schemas.userId,
  limit: z.string().optional().transform(val => {
    if (!val) return 50;
    const num = parseInt(val, 10);
    return isNaN(num) ? 50 : Math.min(Math.max(num, 1), 1000);
  }),
});

/**
 * User settings body schema
 */
export const userSettingsBodySchema = z.object({
  userId: schemas.userId,
  walletAddress: schemas.walletAddress.optional(),
  preferences: z.string().optional(),
  emailNotifications: z.string().optional(),
});

/**
 * Portfolio target body schema
 */
export const portfolioTargetBodySchema = z.object({
  name: schemas.shortString,
  assets: z.array(z.object({
    symbol: z.string().min(1).max(20),
    allocation: z.number().min(0).max(100),
  })).min(1),
  driftThreshold: z.number().min(0).max(100).optional(),
  autoRebalance: z.boolean().optional(),
});

/**
 * Portfolio targets query schema
 */
export const portfolioTargetsQuerySchema = z.object({
  id: z.string().optional().transform(val => {
    if (!val) return undefined;
    const num = parseInt(val, 10);
    return isNaN(num) ? undefined : num;
  }),
  history: z.string().optional().transform(val => val === 'true'),
});

/**
 * User ensure body schema
 */
export const userEnsureBodySchema = z.object({
  firebaseUid: schemas.userId,
  walletAddress: schemas.walletAddress.optional(),
});

/**
 * Waitlist body schema
 */
export const waitlistBodySchema = z.object({
  email: schemas.email,
});

/**
 * Wallet connected body schema
 */
export const walletConnectedBodySchema = z.object({
  walletAddress: schemas.walletAddress,
});

/**
 * Strategy query schema
 */
export const strategyQuerySchema = z.object({
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  status: z.string().default('active'),
  minReturn: z.string().optional().transform(val => val ? Number(val) : undefined),
  maxDrawdown: z.string().optional().transform(val => val ? Number(val) : undefined),
  search: z.string().optional(),
  sortBy: z.enum(['totalReturn', 'subscriberCount', 'monthlyReturn', 'createdAt']).default('totalReturn'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.string().optional().transform(val => {
    if (!val) return 20;
    const num = parseInt(val, 10);
    return isNaN(num) ? 20 : Math.min(Math.max(num, 1), 100);
  }),
  offset: z.string().optional().transform(val => {
    if (!val) return 0;
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : Math.max(num, 0);
  }),
});

export const strategyCreateBodySchema = z.object({
  creatorId: z.number().int().positive(),
  creatorTelegramId: z.coerce.number().optional(), // Coerce to number
  name: schemas.shortString,
  description: schemas.mediumString,
  parameters: z.record(z.string(), z.unknown()).optional().default({}),
  riskLevel: z.enum(['low', 'medium', 'high']),
  subscriptionFee: z.string().default('0'),
  // Accept string or number, but output a string to match the DB signature
  performanceFee: z.union([z.number(), z.string()]).transform(val => String(val)).default('0'),
  minInvestment: z.string().default('100'),
  isPublic: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
});

export function validateInput<T>(
  schema: z.ZodType<T, any, any>, // Allow input and output types to differ
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return { success: true, data: result.data };
    }
    
    // Format Zod errors into readable message
    const errorMessage = result.error.issues
      .map((err) => `${err.path.join('.')}: ${err.message}`)
      .join(', ');
    
    return { success: false, error: errorMessage };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Validation failed' 
    };
  }
}

/**
 * Sanitize string input to prevent XSS and injection attacks
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 10000); // Limit length
}

/**
 * Validate and sanitize numeric ID from query params
 */
export function validateNumericId(id: string | null): number | null {
  if (!id) return null;
  
  const num = parseInt(id, 10);
  
  if (isNaN(num) || num <= 0 || num > Number.MAX_SAFE_INTEGER) {
    return null;
  }
  
  return num;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(params: {
  page?: string | null;
  limit?: string | null;
}): { page: number; limit: number } {
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const limit = Math.min(1000, Math.max(1, parseInt(params.limit || '50', 10) || 50));
  
  return { page, limit };
}
