"use client";

import { Contract, JsonRpcProvider, keccak256, AbiCoder, formatUnits, id as keccakTopic } from "ethers";
import { getChainById } from "../chains";
import {
  CORE_VAULT,
  CREDITCOIN_CHAIN_ID,
  IRM,
  MORPHO,
  ORACLE_PRICE_SCALE,
  SEPOLIA_CHAIN_ID,
  SOURCE_VAULT,
  WAD,
  type DefiMarket,
  type MarketParamsStruct,
} from "./markets";

const TUP = "tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)";
const MKT_TUP = "tuple(uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint48 lastUpdate,uint48 fee)";
const POS_TUP = "tuple(uint256 supplyShares,uint128 borrowShares,uint128 collateral)";

export const MORPHO_ABI = [
  `function market(bytes32) view returns (${MKT_TUP})`,
  `function idToMarketParams(bytes32) view returns (${TUP})`,
  `function position(bytes32,address) view returns (${POS_TUP})`,
  "function isAuthorized(address,address) view returns (bool)",
] as const;

export const CORE_ABI = [
  `function supply(${TUP},uint256,uint256,address) returns (uint256,uint256)`,
  `function withdraw(${TUP},uint256,uint256,address) returns (uint256,uint256)`,
  `function borrow(${TUP},uint256,address) returns (uint256,uint256)`,
  `function repay(${TUP},uint256,uint256,address) returns (uint256,uint256)`,
  "function requestUnlock(" + TUP + ",uint256) external",
  "function isProofUsed(bytes32) view returns (bool)",
] as const;

export const IRM_ABI = [
  `function borrowRateView(${TUP},${MKT_TUP}) view returns (uint256)`,
] as const;

export const ORACLE_ABI = ["function price() view returns (uint256)"] as const;

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function decimals() view returns (uint8)",
] as const;

export const SOURCE_VAULT_ABI = [
  "function lock(address,address,uint256,bytes32,uint256) returns (bytes32)",
  "function nonce() view returns (uint256)",
  "function available(address,address) view returns (uint256)",
  "function worker() view returns (address)",
] as const;

export const LOCKED_EVENT_TOPIC = keccakTopic("Locked(bytes32,address,address,uint256,bytes32,uint64)");
export const UNLOCK_REQUESTED_EVENT_TOPIC = keccakTopic(
  "UnlockRequested(address,address,address,uint256,bytes32)"
);

export function ccProvider(): JsonRpcProvider {
  return new JsonRpcProvider(getChainById(CREDITCOIN_CHAIN_ID)!.rpcUrl);
}

export function sepoliaProvider(): JsonRpcProvider {
  return new JsonRpcProvider(getChainById(SEPOLIA_CHAIN_ID)!.rpcUrl);
}

export function computeMarketId(mp: MarketParamsStruct): string {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "address", "address", "uint256"],
      [mp.loanToken, mp.collateralToken, mp.oracle, mp.irm, mp.lltv]
    )
  );
}

export type MarketState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

export type MarketData = {
  marketId: string;
  state: MarketState;
  utilization: number;
  borrowApy: number;
  supplyApy: number;
  /** collateral unit price denominated in loan token (WAD) */
  priceWad: bigint;
  /** 1 collateral unit ≈ USD (loan treated as $1 for mocks) */
  collateralPriceUsd: number;
};

const SECONDS_PER_YEAR = 31_536_000;

export function toSupplyAssets(shares: bigint, s: MarketState): bigint {
  if (shares === 0n || s.totalSupplyShares === 0n) return 0n;
  return (shares * s.totalSupplyAssets) / s.totalSupplyShares;
}

export function toBorrowAssets(shares: bigint, s: MarketState): bigint {
  if (shares === 0n || s.totalBorrowShares === 0n) return 0n;
  const num = shares * s.totalBorrowAssets;
  return (num + s.totalBorrowShares - 1n) / s.totalBorrowShares;
}

function rateToApy(ratePerSecondWad: bigint): number {
  const r = Number(ratePerSecondWad) / 1e18;
  if (r <= 0) return 0;
  return Math.pow(1 + r, SECONDS_PER_YEAR) - 1;
}

export async function fetchMarketData(market: DefiMarket): Promise<MarketData> {
  const p = ccProvider();
  const morpho = new Contract(MORPHO, MORPHO_ABI, p);
  const marketId = computeMarketId(market.mp);
  // Result proxies are read-only and their named props aren't enumerable — copy by field
  // before passing back into another contract call (IRM takes (params, market)).
  const raw = await (morpho.market(marketId) as Promise<MarketState>);
  const s: MarketState = {
    totalSupplyAssets: raw.totalSupplyAssets,
    totalSupplyShares: raw.totalSupplyShares,
    totalBorrowAssets: raw.totalBorrowAssets,
    totalBorrowShares: raw.totalBorrowShares,
    lastUpdate: raw.lastUpdate,
    fee: raw.fee,
  };
  const oracle = new Contract(market.oracle, ORACLE_ABI, p);
  const priceWad = (await oracle.price()) as bigint;

  const totalSupply = s.totalSupplyAssets;
  const totalBorrow = s.totalBorrowAssets;
  const utilization = totalSupply > 0n ? Number(totalBorrow * WAD / totalSupply) / 1e18 : 0;

  const irm = new Contract(IRM, IRM_ABI, p);
  const borrowRateWad = (await irm.borrowRateView(market.mp, s)) as bigint;
  const feeWad = s.fee;
  const supplyRateWad = (borrowRateWad * (totalBorrow * WAD / (totalSupply > 0n ? totalSupply : 1n)) * (WAD - feeWad)) / WAD / WAD;

  return {
    marketId,
    state: s,
    utilization,
    borrowApy: rateToApy(borrowRateWad),
    supplyApy: rateToApy(supplyRateWad),
    priceWad,
    // valueLoanWei = collateralWei * price / 1e36 -> per collateral unit: price/1e18 loan-wei
    collateralPriceUsd: Number(priceWad) / 1e18 / 10 ** market.loan.decimals,
  };
}

export type UserData = {
  walletBalance: bigint;
  allowanceToCore: bigint;
  /** supply shares -> assets derived */
  suppliedAssets: bigint;
  collateral: bigint;
  borrowedAssets: bigint;
  /** max additional borrowable in loan wei (floor) */
  borrowableAssets: bigint;
  /** borrowed vs borrow limit ratio (1 = at LTV limit) */
  borrowLimitRatio: number;
  authorized: boolean;
};

export async function fetchUserData(market: DefiMarket, address: string): Promise<UserData> {
  const p = ccProvider();
  const morpho = new Contract(MORPHO, MORPHO_ABI, p);
  const marketId = computeMarketId(market.mp);
  const [state, pos, auth] = await Promise.all([
    morpho.market(marketId) as Promise<MarketState>,
    morpho.position(marketId, address) as Promise<{ supplyShares: bigint; collateral: bigint; borrowShares: bigint }>,
    morpho.isAuthorized(address, CORE_VAULT) as Promise<boolean>,
  ]);

  const loan = new Contract(market.loan.address, ERC20_ABI, p);
  const [bal, allow] = await Promise.all([
    loan.balanceOf(address) as Promise<bigint>,
    loan.allowance(address, CORE_VAULT) as Promise<bigint>,
  ]);

  const suppliedAssets = toSupplyAssets(pos.supplyShares, state);
  const borrowedAssets = toBorrowAssets(pos.borrowShares, state);
  const oracle = new Contract(market.oracle, ORACLE_ABI, p);
  const priceWad = (await oracle.price()) as bigint;
  const collateralValueLoan = (pos.collateral * priceWad) / ORACLE_PRICE_SCALE;
  const borrowLimit = pos.collateral === 0n ? 0n : (collateralValueLoan * WAD) / market.lltv;
  const borrowableAssets = borrowLimit > borrowedAssets ? borrowLimit - borrowedAssets : 0n;

  return {
    walletBalance: bal,
    allowanceToCore: allow,
    suppliedAssets,
    collateral: pos.collateral,
    borrowedAssets,
    borrowableAssets,
    borrowLimitRatio: borrowLimit > 0n ? Number(borrowedAssets * WAD / borrowLimit) / 1e18 : 0,
    authorized: auth,
  };
}

/** Loan token decimals shortcut (registry is the source of truth). */
export function loanDecimals(market: DefiMarket): number {
  return market.loan.decimals;
}

export function fmtLoan(market: DefiMarket, value: bigint): string {
  return formatUnits(value, market.loan.decimals);
}
