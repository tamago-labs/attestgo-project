/**
 * 4_check_borrow_power.ts — read Morpho position + compute borrowable for a market/address
 * Usage: npx tsx scripts/lending/4_check_borrow_power.ts --market tbill --address 0xB045bbB51f3CE266A506f332EDBDe176C9862Ff3
 */
import 'dotenv/config';
import { ethers } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const MORPHO = process.env.MORPHO_ADDR || '0x10FbF147BfaC591c1756C67b1eAfeaEB11b3E67D';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const ORACLES: Record<string, string> = {
  nikkei: process.env.ORACLE_AN225 || '0x4865dc0C4A3B11CF6FB57Dec180577f4824bB082',
  tbill: process.env.ORACLE_ATBILL || '0xc1D218017533dA1F61ba28125bcCcEC0FB3874B2',
};

const IRM = process.env.IRM_ADDR || '0x3345A6582669C00cA022d9200C083b3097B18DBb';
const WAD = 10n ** 18n;
const ORACLE_PRICE_SCALE = 10n ** 36n;

const MORPHO_ABI = [
  'function market(bytes32) view returns (tuple(uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint48 lastUpdate,uint48 fee))',
  'function position(bytes32,address) view returns (tuple(uint256 supplyShares,uint128 borrowShares,uint128 collateral))',
] as const;
const ORACLE_ABI = ['function price() view returns (uint256)'] as const;
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'] as const;

async function main() {
  const slug = (arg('--market') || 'tbill').toLowerCase();
  const addr = arg('--address') || process.env.ISSUER_WALLET || '';
  if (!addr) throw new Error('--address required');

  const isNikkei = slug === 'nikkei';
  const loanToken = isNikkei ? (process.env.CUSDT_CC || '0x60f6456FBE5566e515E63219fC9c0dbb80015F8E') : (process.env.ATC_CC || '0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a');
  const collateralToken = isNikkei ? (process.env.GTOKEN_AN225 || '0xc55D7821b6e0D8AC162e5b672aa9eA87A066B5a8') : (process.env.GTOKEN_ATBILL || '0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db');
  const oracleAddr = ORACLES[slug];
  const lltv = 620000000000000000n;
  const loanDec = isNikkei ? 6 : 18;

  const marketId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(['address', 'address', 'address', 'address', 'uint256'], [loanToken, collateralToken, oracleAddr, IRM, lltv])
  );

  const p = new ethers.JsonRpcProvider(CC_RPC);
  const morpho = new ethers.Contract(MORPHO, MORPHO_ABI, p);
  const oracle = new ethers.Contract(oracleAddr, ORACLE_ABI, p);
  const loan = new ethers.Contract(loanToken, ERC20_ABI, p);
  const col = new ethers.Contract(collateralToken, ERC20_ABI, p);

  const [state, pos, priceWad, walletBal, colBal] = await Promise.all([
    morpho.market(marketId) as Promise<any>,
    morpho.position(marketId, addr) as Promise<any>,
    oracle.price() as Promise<bigint>,
    loan.balanceOf(addr).then((v: bigint) => v).catch(() => null) as Promise<bigint | null>,
    col.balanceOf(addr).then((v: bigint) => v).catch(() => null) as Promise<bigint | null>,
  ]);

  const collateral = pos.collateral as bigint;
  const borrowShares = pos.borrowShares as bigint;
  const totalSupplyAssets = state.totalSupplyAssets as bigint;
  const totalSupplyShares = state.totalSupplyShares as bigint;
  const totalBorrowAssets = state.totalBorrowAssets as bigint;
  const totalBorrowShares = state.totalBorrowShares as bigint;

  const suppliedAssets = totalSupplyShares > 0n ? (pos.supplyShares * totalSupplyAssets) / totalSupplyShares : 0n;
  const borrowedAssets = totalBorrowShares > 0n ? (borrowShares * totalBorrowAssets) / totalBorrowShares : 0n;
  const collateralValueLoan = (collateral * priceWad) / ORACLE_PRICE_SCALE;
  const borrowLimit = collateral === 0n ? 0n : (collateralValueLoan * WAD) / lltv;
  const borrowable = borrowLimit > borrowedAssets ? borrowLimit - borrowedAssets : 0n;

  const collateralPriceUsd = Number(priceWad) / 1e18 / 10 ** loanDec;

  console.log(`\n===== ${slug} market @ ${addr.slice(0, 10)}…`);
  console.log(`marketId:                ${marketId}`);
  console.log(`collateral (raw):       ${collateral.toString()} (${ethers.formatUnits(collateral, 18)})`);
  console.log(`borrowShares:           ${borrowShares.toString()}`);
  console.log(`suppliedAssets:         ${ethers.formatUnits(suppliedAssets, loanDec)}`);
  console.log(`borrowedAssets:         ${ethers.formatUnits(borrowedAssets, loanDec)}`);
  console.log(`priceWad:               ${priceWad.toString()}`);
  console.log(`collateralPriceUsd:     ${collateralPriceUsd}`);
  console.log(`collateralValueLoan:    ${ethers.formatUnits(collateralValueLoan, loanDec)}`);
  console.log(`borrowLimit (62% LTV):  ${ethers.formatUnits(borrowLimit, loanDec)}`);
  console.log(`borrowable:             ${ethers.formatUnits(borrowable, loanDec)}`);
  console.log(`wallet loan balance:    ${walletBal !== null ? ethers.formatUnits(walletBal, loanDec) : 'n/a'}`);
  console.log(`wallet collateral bal:  ${colBal !== null ? ethers.formatUnits(colBal, 18) : 'n/a'}`);
  console.log(`\nmarket state: supply=${ethers.formatUnits(totalSupplyAssets, loanDec)} borrow=${ethers.formatUnits(totalBorrowAssets, loanDec)} util=${totalSupplyAssets > 0n ? ((Number(totalBorrowAssets * WAD / totalSupplyAssets) / 1e18 * 100).toFixed(2) + '%') : '0%'}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
