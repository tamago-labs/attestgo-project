// Live lending stack addresses — CreditCoin Testnet (CC3, 102031) + ETH Sepolia (11155111)
// Mirrors deployment.txt. Override via NEXT_PUBLIC_* env vars.

export const MORPHO = process.env.NEXT_PUBLIC_MORPHO_ADDR || "0x10FbF147BfaC591c1756C67b1eAfeaEB11b3E67D";
export const CORE_VAULT = process.env.NEXT_PUBLIC_CORE_VAULT_ADDR || "0x51062701163469d30a0c4331BB2FBab215d24434";
export const IRM = process.env.NEXT_PUBLIC_IRM_ADDR || "0x3345A6582669C00cA022d9200C083b3097B18DBb";

export const CREDITCOIN_CHAIN_ID = 102031;
export const SEPOLIA_CHAIN_ID = 11155111;

export const LOAN_TOKENS = {
  CUSDT: {
    symbol: "CUSDT",
    address: process.env.NEXT_PUBLIC_CUSDT_CC || "0x60f6456FBE5566e515E63219fC9c0dbb80015F8E",
    decimals: 6,
    isMock: true,
    name: "Mock CUSDT",
    icon: "https://s2.coinmarketcap.com/static/img/coins/64x64/825.png",
  },
  ATC: {
    symbol: "ATC",
    address: process.env.NEXT_PUBLIC_ATC_CC || "0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a",
    decimals: 18,
    isMock: true,
    name: "Mock ATC",
    icon: "/attestcoin-icon.png",
  },
} as const;

export const SOURCE_TOKENS = {
  AN225: {
    symbol: "aN225",
    address: process.env.NEXT_PUBLIC_GTOKEN_AN225 || "0xc55D7821b6e0D8AC162e5b672aa9eA87A066B5a8",
    decimals: 18,
    name: "Nikkei 225 RWA",
    icon: "/nekkei-token-icon.png",
  },
  ATBILL: {
    symbol: "aTBILL",
    address: process.env.NEXT_PUBLIC_GTOKEN_ATBILL || "0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db",
    decimals: 18,
    name: "USD T-Bill RWA",
    icon: "/t-bill-token-icon.png",
  },
} as const;

export const SOURCE_VAULT = process.env.NEXT_PUBLIC_SOURCE_VAULT_ADDR || "0xd81F1A1a63fB33989bF46432527A6F7E997cF6ED";

export type MarketParamsStruct = {
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: bigint;
};

export type DefiMarket = {
  slug: string;
  name: string;
  sub: string;
  loan: { symbol: string; address: string; decimals: number; isMock: boolean; name: string; icon?: string };
  collateral: { symbol: string; address: string; decimals: number; name: string; icon?: string };
  oracle: string;
  lltv: bigint;
  mp: MarketParamsStruct;
};

function mk(
  slug: string,
  name: string,
  sub: string,
  loan: (typeof LOAN_TOKENS)[keyof typeof LOAN_TOKENS],
  collateral: (typeof SOURCE_TOKENS)[keyof typeof SOURCE_TOKENS],
  oracle: string
): DefiMarket {
  const mp: MarketParamsStruct = {
    loanToken: loan.address,
    collateralToken: collateral.address,
    oracle,
    irm: IRM,
    lltv: 620000000000000000n, // 62%
  };
  return {
    slug,
    name,
    sub,
    loan: { ...loan },
    collateral: { ...collateral },
    oracle,
    lltv: mp.lltv,
    mp,
  };
}

export const MARKETS: DefiMarket[] = [
  mk("nikkei", "GO-NIKKEI", "Nikkei 225 RWA · JP", LOAN_TOKENS.CUSDT, SOURCE_TOKENS.AN225, process.env.NEXT_PUBLIC_ORACLE_AN225 || "0x4865dc0C4A3B11CF6FB57Dec180577f4824bB082"),
  mk("tbill", "GO-TBILL", "USD T-Bill RWA · US, SG", LOAN_TOKENS.ATC, SOURCE_TOKENS.ATBILL, process.env.NEXT_PUBLIC_ORACLE_ATBILL || "0xC78D2b542Ef075c0753332ab2aA63b8C3f3793cd"),
];

export function getMarketBySlug(slug: string): DefiMarket | undefined {
  return MARKETS.find((m) => m.slug === slug);
}

export const ORACLE_PRICE_SCALE = 10n ** 36n;
export const WAD = 10n ** 18n;
