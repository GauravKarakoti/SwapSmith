/**
 * Re-exports address validation utilities from shared service.
 * This ensures consistent address validation across bot and frontend.
 */

export { ADDRESS_PATTERNS, DEFAULT_EVM_PATTERN, isValidAddress } from '../../../shared/services/address-validator'
