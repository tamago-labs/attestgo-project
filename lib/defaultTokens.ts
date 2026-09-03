export type DefaultToken = {
  address: `0x${string}`;
  chainId: number;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
};

export const DEFAULT_TOKENS: DefaultToken[] = [
  {
    symbol: "JPYC",
    name: "JPY Coin",
    decimals: 18,
    chainId: 11155111,
    address: "0xB8712751fFBe66DA15f2aCCCf0DFE8071Cc2E5D0",
    icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/40123.png",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    chainId: 11155111,
    address: "0x8d1A804D73CA595A8538C805Daef6FE8Ec68137B",
    icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png",
  },
  {
    symbol: "ATC",
    name: "Attestcoin",
    decimals: 18,
    chainId: 102031,
    address: "0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a",
    icon: "/attestcoin-icon.png",
  },
  {
    symbol: "cUSDT",
    name: "Credit USDT",
    decimals: 6,
    chainId: 102031,
    address: "0x60f6456FBE5566e515E63219fC9c0dbb80015F8E",
    icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png",
  },
];

export function getDefaultToken(address: string, chainId: number): DefaultToken | undefined {
  return DEFAULT_TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase() && t.chainId === chainId);
}
