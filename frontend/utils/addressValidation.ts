import { isAddress } from 'viem'

export type AddressValidationResult = { passed: true; message: string } | { passed: false; message: string }

const ZERO_EVM_ADDRESS = '0x0000000000000000000000000000000000000000'

function hasSuspiciousChars(address: string) {
  // Reject anything that looks like a URI/ENS/email/contains whitespace.
  return /\s|:|@|\//.test(address)
}

function validateEvmAddress(address: string): AddressValidationResult {
  if (!isAddress(address)) return { passed: false, message: 'Invalid EVM address format' }
  if (address.toLowerCase() === ZERO_EVM_ADDRESS) return { passed: false, message: 'Zero address is not allowed' }
  return { passed: true, message: 'Valid EVM deposit address' }
}

function validateBitcoinAddress(address: string): AddressValidationResult {
  // Covers legacy (1..., 3...) and bech32 (bc1..., incl. taproot bc1p...)
  const legacy = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
  const bech32 = /^bc1[0-9ac-hj-np-z]{25,79}$/i
  if (legacy.test(address) || bech32.test(address)) return { passed: true, message: 'Valid Bitcoin address format' }
  return { passed: false, message: 'Invalid Bitcoin address format' }
}

function validateSolanaAddress(address: string): AddressValidationResult {
  // Base58, typically 32-44 chars. This is format-only; no checksum validation.
  const base58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
  if (base58.test(address)) return { passed: true, message: 'Valid Solana address format' }
  return { passed: false, message: 'Invalid Solana address format' }
}

function validateTronAddress(address: string): AddressValidationResult {
  // TRON base58check addresses typically start with T and are 34 chars.
  const tron = /^T[1-9A-HJ-NP-Za-km-z]{33}$/
  if (tron.test(address)) return { passed: true, message: 'Valid TRON address format' }
  return { passed: false, message: 'Invalid TRON address format' }
}

function validateRippleAddress(address: string): AddressValidationResult {
  // XRP classic addresses start with r; format-only.
  const xrp = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/
  if (xrp.test(address)) return { passed: true, message: 'Valid XRP address format' }
  return { passed: false, message: 'Invalid XRP address format' }
}

export function validateDepositAddressForNetwork(
  depositNetwork: string,
  depositAddress: string | undefined | null,
): AddressValidationResult {
  if (!depositAddress) return { passed: false, message: 'Deposit address is missing' }

  const address = depositAddress.trim()
  if (address.length === 0) return { passed: false, message: 'Deposit address is empty' }
  if (address !== depositAddress) return { passed: false, message: 'Deposit address contains leading/trailing whitespace' }
  if (hasSuspiciousChars(address)) return { passed: false, message: 'Deposit address contains suspicious characters' }

  const network = (depositNetwork || '').toLowerCase()

  // EVM networks supported by the app’s wallet flow.
  if (['ethereum', 'polygon', 'arbitrum', 'avalanche', 'optimism', 'bsc', 'base'].includes(network)) {
    return validateEvmAddress(address)
  }

  if (network === 'bitcoin') return validateBitcoinAddress(address)
  if (network === 'solana') return validateSolanaAddress(address)
  if (network === 'tron') return validateTronAddress(address)
  if (network === 'ripple' || network === 'xrp') return validateRippleAddress(address)

  // Unknown networks: fail closed rather than allowing ambiguous formats.
  return { passed: false, message: `Unsupported deposit network "${depositNetwork}"` }
}

