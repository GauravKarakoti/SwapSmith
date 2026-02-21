// Staking Contract ABIs for common DeFi protocols
// These ABIs are used to encode staking transactions

// Lido stETH staking ABI
export const LIDO_STETH_ABI = [
  // Submit function for staking ETH and receiving stETH
  "function submit(address _referral) external payable returns (uint256)",
  // Balance of stETH
  "function balanceOf(address account) external view returns (uint256)",
  // Transfer stETH
  "function transfer(address recipient, uint256 amount) external returns (bool)",
  // Approve spending
  "function approve(address spender, uint256 amount) external returns (bool)",
];

// Lido wstETH (wrapped stETH) ABI
export const LIDO_WSTETH_ABI = [
  // Wrap stETH to wstETH
  "function wrap(uint256 _stETHAmount) external returns (uint256)",
  // Unwrap wstETH to stETH
  "function unwrap(uint256 _wstETHAmount) external returns (uint256)",
  // Get stETH per wstETH rate
  "function stEthPerToken() external view returns (uint256)",
];

// Rocket Pool rETH staking ABI
export const ROCKET_POOL_RETH_ABI = [
  // Deposit ETH and receive rETH
  "function deposit() external payable",
  // Get the exchange rate
  "function getExchangeRate() external view returns (uint256)",
  // Balance of rETH
  "function balanceOf(address account) external view returns (uint256)",
  // Burn rETH for ETH
  "function burn(uint256 _rethAmount) external",
];

// Rocket Pool minipool deposit ABI (for node operators)
export const ROCKET_POOL_MINIPOOL_ABI = [
  // Deposit to minipool
  "function deposit() external payable",
  // Stake minipool
  "function stake(bytes calldata _validatorSignature, bytes calldata _depositDataRoot) external",
];

// Frax sfrxETH staking ABI
export const FRAX_SFRXETH_ABI = [
  // Deposit ETH and receive sfrxETH
  "function depositAndStake() external payable returns (uint256)",
  // Stake frxETH to get sfrxETH
  "function stake(uint256 amount) external returns (uint256)",
  // Withdraw sfrxETH
  "function withdraw(uint256 amount, bool claim) external returns (uint256)",
  // Balance of sfrxETH
  "function balanceOf(address account) external view returns (uint256)",
];

// Coinbase cbETH staking ABI
export const COINBASE_CBETH_ABI = [
  // Mint cbETH by depositing ETH
  "function mint() external payable",
  // Balance of cbETH
  "function balanceOf(address account) external view returns (uint256)",
  // Approve spending
  "function approve(address spender, uint256 amount) external returns (bool)",
  // Burn cbETH for ETH
  "function burn(uint256 amount) external",
];

// Stader ETHx staking ABI
export const STADER_ETHX_ABI = [
  // Deposit ETH and receive ETHx
  "function deposit(address _receiver) external payable returns (uint256)",
  // Balance of ETHx
  "function balanceOf(address account) external view returns (uint256)",
  // Approve spending
  "function approve(address spender, uint256 amount) external returns (bool)",
];

// Polygon POL staking ABI (formerly MATIC)
export const POLYGON_POL_ABI = [
  // Stake MATIC/POL
  "function stake(uint256 amount) external",
  // Withdraw stake
  "function withdraw(uint256 amount) external",
  // Restake rewards
  "function restake() external",
  // Get staked amount
  "function getTotalStake(address user) external view returns (uint256)",
];

// Arbitrum ARB staking ABI
export const ARBITRUM_ARB_ABI = [
  // Delegate votes
  "function delegate(address delegatee) external",
  // Get votes
  "function getVotes(address account) external view returns (uint256)",
  // Balance of ARB
  "function balanceOf(address account) external view returns (uint256)",
];

// Optimism OP staking ABI
export const OPTIMISM_OP_ABI = [
  // Delegate votes
  "function delegate(address delegatee) external",
  // Get votes
  "function getVotes(address account) external view returns (uint256)",
  // Balance of OP
  "function balanceOf(address account) external view returns (uint256)",
];

// Generic ERC20 ABI for approvals
export const ERC20_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
];

// Map of protocol names to their ABIs
export const STAKING_ABIS: Record<string, string[]> = {
  'Lido': LIDO_STETH_ABI,
  'RocketPool': ROCKET_POOL_RETH_ABI,
  'Frax': FRAX_SFRXETH_ABI,
  'Coinbase': COINBASE_CBETH_ABI,
  'Stader': STADER_ETHX_ABI,
  'Polygon': POLYGON_POL_ABI,
  'Arbitrum': ARBITRUM_ARB_ABI,
  'Optimism': OPTIMISM_OP_ABI,
};

// Staking function selectors (first 4 bytes of keccak256 hash)
export const STAKING_FUNCTION_SELECTORS: Record<string, string> = {
  // Lido submit(address)
  'Lido_submit': '0xa1903eab',
  // Rocket Pool deposit()
  'RocketPool_deposit': '0xd0e30db0',
  // Frax depositAndStake()
  'Frax_depositAndStake': '0xf6326fb3',
  // Coinbase mint()
  'Coinbase_mint': '0x1249c58b',
  // Stader deposit(address)
  'Stader_deposit': '0x47e7ef24',
  // Polygon stake(uint256)
  'Polygon_stake': '0xa694fc3a',
  // Arbitrum delegate(address)
  'Arbitrum_delegate': '0x5c19a95c',
  // Optimism delegate(address)
  'Optimism_delegate': '0x5c19a95c',
};

// Helper function to get ABI for a protocol
export function getStakingAbi(protocol: string): string[] {
  return STAKING_ABIS[protocol] || ERC20_ABI;
}

// Helper function to get function selector for staking
export function getStakingSelector(protocol: string): string {
  return STAKING_FUNCTION_SELECTORS[`${protocol}_deposit`] || 
         STAKING_FUNCTION_SELECTORS[`${protocol}_submit`] ||
         STAKING_FUNCTION_SELECTORS[`${protocol}_stake`] ||
         '0x';
}
