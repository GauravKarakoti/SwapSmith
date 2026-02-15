export interface ExplorerConfig {
  baseUrl: string;
  addressPath: string;
  txPath: string;
  name: string;
}

export const BLOCKCHAIN_EXPLORERS: { [key: string]: ExplorerConfig } = {
  ethereum: {
    baseUrl: 'https://etherscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Etherscan'
  },
  bitcoin: {
    baseUrl: 'https://blockchain.com',
    addressPath: '/explorer/addresses',
    txPath: '/explorer/transactions',
    name: 'Blockchain.com Explorer'
  },
  bsc: {
    baseUrl: 'https://bscscan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'BscScan'
  },
  polygon: {
    baseUrl: 'https://polygonscan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Polygonscan'
  },
  arbitrum: {
    baseUrl: 'https://arbiscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Arbiscan'
  },
  base: {
    baseUrl: 'https://basescan.org',
    addressPath: '/address',
    txPath: '/tx',
    name: 'BaseScan'
  },
  optimism: {
    baseUrl: 'https://optimistic.etherscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Optimistic Etherscan'
  },
  avalanche: {
    baseUrl: 'https://snowtrace.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Snowtrace'
  },
  fantom: {
    baseUrl: 'https://ftmscan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'FTMScan'
  },
  cronos: {
    baseUrl: 'https://cronoscan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'CronoScan'
  },
  moonbeam: {
    baseUrl: 'https://moonscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Moonscan'
  },
  moonriver: {
    baseUrl: 'https://moonriver.moonscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Moonriver Moonscan'
  },
  celo: {
    baseUrl: 'https://celoscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'CeloScan'
  },
  gnosis: {
    baseUrl: 'https://gnosisscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'GnosisScan'
  },
  harmony: {
    baseUrl: 'https://explorer.harmony.one',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Harmony Explorer'
  },
  metis: {
    baseUrl: 'https://andromeda-explorer.metis.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Metis Explorer'
  },
  aurora: {
    baseUrl: 'https://aurorascan.dev',
    addressPath: '/address',
    txPath: '/tx',
    name: 'AuroraScan'
  },
  kava: {
    baseUrl: 'https://explorer.kava.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Kava Explorer'
  },
  evmos: {
    baseUrl: 'https://escan.live',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Evmos Explorer'
  },
  boba: {
    baseUrl: 'https://bobascan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'BobaScan'
  },
  okc: {
    baseUrl: 'https://www.oklink.com/okc',
    addressPath: '/address',
    txPath: '/tx',
    name: 'OKLink OKC'
  },
  heco: {
    baseUrl: 'https://hecoinfo.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'HecoInfo'
  },
  iotex: {
    baseUrl: 'https://iotexscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'IoTeXScan'
  },
  klaytn: {
    baseUrl: 'https://scope.klaytn.com',
    addressPath: '/account',
    txPath: '/tx',
    name: 'Klaytn Scope'
  },
  conflux: {
    baseUrl: 'https://evm.confluxscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'ConfluxScan'
  },
  astar: {
    baseUrl: 'https://astar.subscan.io',
    addressPath: '/account',
    txPath: '/extrinsic',
    name: 'Astar Subscan'
  },
  shiden: {
    baseUrl: 'https://shiden.subscan.io',
    addressPath: '/account',
    txPath: '/extrinsic',
    name: 'Shiden Subscan'
  },
  telos: {
    baseUrl: 'https://www.teloscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'TelosScan'
  },
  fuse: {
    baseUrl: 'https://explorer.fuse.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Fuse Explorer'
  },
  velas: {
    baseUrl: 'https://evmexplorer.velas.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Velas Explorer'
  },
  thundercore: {
    baseUrl: 'https://viewblock.io/thundercore',
    addressPath: '/address',
    txPath: '/tx',
    name: 'ThunderCore ViewBlock'
  },
  xdc: {
    baseUrl: 'https://xdcscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'XDCScan'
  },
  nahmii: {
    baseUrl: 'https://explorer.nahmii.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Nahmii Explorer'
  },
  callisto: {
    baseUrl: 'https://explorer.callisto.network',
    addressPath: '/addr',
    txPath: '/tx',
    name: 'Callisto Explorer'
  },
  smartbch: {
    baseUrl: 'https://www.smartscan.cash',
    addressPath: '/address',
    txPath: '/tx',
    name: 'SmartScan'
  },
  energyweb: {
    baseUrl: 'https://explorer.energyweb.org',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Energy Web Explorer'
  },
  theta: {
    baseUrl: 'https://explorer.thetatoken.org',
    addressPath: '/account',
    txPath: '/txs',
    name: 'Theta Explorer'
  },
  flare: {
    baseUrl: 'https://flare-explorer.flare.network',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Flare Explorer'
  },
  songbird: {
    baseUrl: 'https://songbird-explorer.flare.network',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Songbird Explorer'
  },
  coston: {
    baseUrl: 'https://coston-explorer.flare.network',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Coston Explorer'
  },
  coston2: {
    baseUrl: 'https://coston2-explorer.flare.network',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Coston2 Explorer'
  },
  rei: {
    baseUrl: 'https://scan.rei.network',
    addressPath: '/address',
    txPath: '/tx',
    name: 'REI Scan'
  },
  kekchain: {
    baseUrl: 'https://mainnet-explorer.kekchain.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'KekChain Explorer'
  },
  tomochain: {
    baseUrl: 'https://tomoscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'TomoScan'
  },
  bitgert: {
    baseUrl: 'https://brisescan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'BriseScan'
  },
  clover: {
    baseUrl: 'https://clvscan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'CLVScan'
  },
  defichain: {
    baseUrl: 'https://meta.defichain.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'DeFiChain MetaChain'
  },
  findora: {
    baseUrl: 'https://evm.findorascan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Findora Scan'
  },
  gatechain: {
    baseUrl: 'https://gatescan.org',
    addressPath: '/address',
    txPath: '/tx',
    name: 'GateScan'
  },
  meter: {
    baseUrl: 'https://scan.meter.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Meter Scan'
  },
  nova: {
    baseUrl: 'https://explorer.novanetwork.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Nova Explorer'
  },
  syscoin: {
    baseUrl: 'https://explorer.syscoin.org',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Syscoin Explorer'
  },
  zksync: {
    baseUrl: 'https://explorer.zksync.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'zkSync Explorer'
  },
  polygonzkevm: {
    baseUrl: 'https://zkevm.polygonscan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Polygon zkEVM Scan'
  },
  linea: {
    baseUrl: 'https://lineascan.build',
    addressPath: '/address',
    txPath: '/tx',
    name: 'LineaScan'
  },
  mantle: {
    baseUrl: 'https://explorer.mantle.xyz',
    addressPath: '/address',
    txPath: '/tx',
    name: 'Mantle Explorer'
  },
  scroll: {
    baseUrl: 'https://scrollscan.com',
    addressPath: '/address',
    txPath: '/tx',
    name: 'ScrollScan'
  },
  taiko: {
    baseUrl: 'https://taikoscan.io',
    addressPath: '/address',
    txPath: '/tx',
    name: 'TaikoScan'
  },
  solana: {
    baseUrl: 'https://solscan.io',
    addressPath: '/account',
    txPath: '/tx',
    name: 'Solscan'
  }
}

export const getExplorerUrl = (
  network: string, 
  type: 'address' | 'transaction' = 'address',
  identifier: string
): string | null => {
  const explorer = BLOCKCHAIN_EXPLORERS[network.toLowerCase()]
  if (!explorer) return null

  const path = type === 'address' ? explorer.addressPath : explorer.txPath
  return `${explorer.baseUrl}${path}/${identifier}`
}

export const getNetworkDisplayName = (network: string): string => {
  return BLOCKCHAIN_EXPLORERS[network.toLowerCase()]?.name || network
}