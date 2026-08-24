export type ChainConfig = {
  id: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  color: string;
  icon: string;
};

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    id: 11155111,
    name: "ETH Sepolia",
    shortName: "Sepolia",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/demo",
    explorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    color: "#627EEA",
    icon: "https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628",
  },
  {
    id: 102031,
    name: "CreditCoin Testnet",
    shortName: "CreditCoin",
    rpcUrl: "https://rpc.cc3-testnet.creditcoin.network",
    explorerUrl: "https://creditcoin-testnet.blockscout.com",
    nativeCurrency: { name: "Test CTC", symbol: "tCTC", decimals: 18 },
    color: "#FDB750",
    icon: "https://coin-images.coingecko.com/coins/images/54774/small/WCTC_200px.png?1761924042",
  },
];

export function getChainById(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId);
}

export function getExplorerAddressUrl(chainId: number, address: string): string {
  const chain = getChainById(chainId);
  if (!chain) return `https://sepolia.etherscan.io/address/${address}`;
  return `${chain.explorerUrl}/address/${address}`;
}

export function getAddChainParams(chain: ChainConfig) {
  return {
    chainId: `0x${chain.id.toString(16)}`,
    chainName: chain.name,
    rpcUrls: [chain.rpcUrl],
    blockExplorerUrls: [chain.explorerUrl],
    nativeCurrency: chain.nativeCurrency,
  };
}
