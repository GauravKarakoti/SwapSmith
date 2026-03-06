import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Secure Secrets Loader
 * 
 * Loads secrets from Docker secrets files or falls back to environment variables.
 * This provides a secure way to handle sensitive data in containerized environments.
 */

const DOCKER_SECRETS_PATH = '/run/secrets';

// Simple logger for shared utilities (no Winston dependency)
const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(`[Secrets Loader] ${message}${metaStr}`);
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.warn(`[Secrets Loader] ${message}${metaStr}`);
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.error(`[Secrets Loader] ${message}${metaStr}`);
  },
};

/**
 * Load a secret from Docker secrets or environment variable
 * 
 * @param secretName - Name of the secret (without file extension)
 * @param envVarName - Environment variable name as fallback
 * @param required - Whether the secret is required (throws error if missing)
 * @returns The secret value or undefined if not found and not required
 */
export function loadSecret(
  secretName: string, 
  envVarName: string, 
  required: boolean = true
): string | undefined {
  // Try to load from Docker secrets first
  try {
    const secretPath = join(DOCKER_SECRETS_PATH, secretName);
    const secretValue = readFileSync(secretPath, 'utf8').trim();
    
    if (secretValue) {
      logger.info('Loaded secret from Docker secrets', { secretName });
      return secretValue;
    }
  } catch (error) {
    // Docker secret not found, try environment variable
    logger.info('Docker secret not found, trying environment variable', { secretName });
  }
  
  // Fallback to environment variable
  const envValue = process.env[envVarName];
  
  if (envValue) {
    logger.info('Loaded secret from environment variable', { envVarName });
    return envValue;
  }
  
  // Handle missing required secrets
  if (required) {
    throw new Error(
      `Required secret '${secretName}' not found in Docker secrets or environment variable '${envVarName}'`
    );
  }
  
  logger.warn('Optional secret not found', { secretName });
  return undefined;
}

/**
 * Load a JSON secret (like Firebase service account)
 * 
 * @param secretName - Name of the secret file
 * @param envVarName - Environment variable name as fallback
 * @param required - Whether the secret is required
 * @returns Parsed JSON object or undefined
 */
export function loadJSONSecret<T = any>(
  secretName: string, 
  envVarName: string, 
  required: boolean = true
): T | undefined {
  const secretValue = loadSecret(secretName, envVarName, required);
  
  if (!secretValue) {
    return undefined;
  }
  
  try {
    return JSON.parse(secretValue) as T;
  } catch (error) {
    if (required) {
      throw new Error(`Failed to parse JSON secret '${secretName}': ${error}`);
    }
    logger.warn('Failed to parse optional JSON secret', { secretName });
    return undefined;
  }
}

/**
 * Validate that all required secrets are loaded
 * 
 * @param secrets - Object with secret names and their loaded values
 * @throws Error if any required secret is missing
 */
export function validateSecrets(secrets: Record<string, string | undefined>): void {
  const missingSecrets = Object.entries(secrets)
    .filter(([_, value]) => !value)
    .map(([name, _]) => name);
  
  if (missingSecrets.length > 0) {
    throw new Error(
      `Missing required secrets: ${missingSecrets.join(', ')}\n` +
      'Please ensure all secrets are properly configured in Docker secrets or environment variables.'
    );
  }
  
  logger.info('All required secrets loaded successfully');
}

/**
 * Common secrets for the application
 */
export const AppSecrets = {
  // API Keys
  GROQ_API_KEY: () => loadSecret('groq_api_key', 'GROQ_API_KEY'),
  SIDESHIFT_API_KEY: () => loadSecret('sideshift_api_key', 'NEXT_PUBLIC_SIDESHIFT_API_KEY'),
  BREVO_API_KEY: () => loadSecret('brevo_api_key', 'BREVO_API_KEY', false),
  
  // Bot specific
  BOT_TOKEN: () => loadSecret('bot_token', 'BOT_TOKEN'),
  WALLETCONNECT_PROJECT_ID: () => loadSecret('walletconnect_project_id', 'WALLETCONNECT_PROJECT_ID', false),
  
  // Blockchain
  REWARD_TOKEN_PRIVATE_KEY: () => loadSecret('reward_token_private_key', 'REWARD_TOKEN_OWNER_PRIVATE_KEY', false),
  
  // Firebase
  FIREBASE_SERVICE_ACCOUNT: () => loadJSONSecret('firebase_service_account_key', 'FIREBASE_SERVICE_ACCOUNT_KEY', false),
} as const;

/**
 * Initialize and validate all application secrets
 * Call this at application startup
 */
export function initializeSecrets(): {
  groqApiKey: string;
  sideshiftApiKey: string;
  brevoApiKey?: string;
  botToken?: string;
  walletConnectProjectId?: string;
  rewardTokenPrivateKey?: string;
  firebaseServiceAccount?: Record<string, unknown>;
} {
  logger.info('Initializing application secrets');
  
  const secrets = {
    groqApiKey: AppSecrets.GROQ_API_KEY()!,
    sideshiftApiKey: AppSecrets.SIDESHIFT_API_KEY()!,
    brevoApiKey: AppSecrets.BREVO_API_KEY(),
    botToken: AppSecrets.BOT_TOKEN(),
    walletConnectProjectId: AppSecrets.WALLETCONNECT_PROJECT_ID(),
    rewardTokenPrivateKey: AppSecrets.REWARD_TOKEN_PRIVATE_KEY(),
    firebaseServiceAccount: AppSecrets.FIREBASE_SERVICE_ACCOUNT(),
  };
  
  // Validate required secrets
  validateSecrets({
    groqApiKey: secrets.groqApiKey,
    sideshiftApiKey: secrets.sideshiftApiKey,
  });
  
  logger.info('Secrets initialization complete');
  return secrets;
}

/**
 * Utility to mask secrets for logging
 * 
 * @param secret - The secret to mask
 * @param visibleChars - Number of characters to show at the end
 * @returns Masked secret string
 */
export function maskSecret(secret: string, visibleChars: number = 4): string {
  if (!secret || secret.length <= visibleChars) {
    return '***';
  }
  
  const masked = '*'.repeat(secret.length - visibleChars);
  const visible = secret.slice(-visibleChars);
  return masked + visible;
}
