/**
 * 6_setup_tbill_market.ts — set oracle price + create the new tbill market (oracle was redeployed with 18/18 dec)
 * Usage: npx tsx scripts/lending/6_setup_tbill_market.ts
 */
import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet, keccak256, AbiCoder, parseUnits } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PK = process.env.PRIVATE_KEY || '';
const MORPHO = process.env.MORPHO_ADDR || '0x10FbF147BfaC591c1756C67b1eAfeaEB11b3E67D';

const ORACLE = '0xC78D2b542Ef075c0753332ab2aA63b8C3f3793cd';
const ATC_CC = '0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a';
const GTOKEN_ATBILL = '0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db';
const IRM = '0x3345A6582669C00cA022d9200C083b3097B18DBb';
const LLTV = 620000000000000000n;

const ORACLE_ABI = [
  'function price() view returns (uint256)',
  'function setPrice(uint256 newCollateralUsdPrice, uint256 newLoanUsdPrice) external',
  'function getPriceInfo() view returns (uint8 collMode, uint8 lnMode, uint256 collUsd, uint256 lnUsd, uint256 morphoPrice)',
] as const;
const MORPHO_ABI = [
  'function market(bytes32) view returns (tuple(uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint48 lastUpdate,uint48 fee))',
  'function createMarket(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)) external',
  'function isLltvEnabled(uint256) view returns (bool)',
  'function enableLltv(uint256) external',
  'function isIrmEnabled(address) view returns (bool)',
  'function enableIrm(address) external',
] as const;

async function main() {
  const cc = new JsonRpcProvider(CC_RPC);
  const w = new Wallet(PK, cc);

  const oracle = new Contract(ORACLE, ORACLE_ABI, cc);
  const info = await (oracle as any).getPriceInfo();
  console.log(`\nOracle ${ORACLE}`);
  console.log(`  collUsd=${info.collUsd.toString()} (${Number(info.collUsd) / 1e18})`);
  console.log(`  loanUsd=${info.lnUsd.toString()} (${Number(info.lnUsd) / 1e18})`);
  console.log(`  current price()=${info.morphoPrice.toString()} (${(Number(info.morphoPrice) / 1e36).toFixed(4)}e36)`);

  const collUsd = parseUnits('1.0', 18);
  const loanUsd = parseUnits('0.15', 18);
  if (info.collUsd !== collUsd || info.lnUsd !== loanUsd) {
    console.log(`\n→ setPrice(collUsd=1.0, loanUsd=0.15)...`);
    const oracleW = new Contract(ORACLE, ORACLE_ABI, w);
    const tx = await (oracleW as any).setPrice(collUsd, loanUsd);
    await tx.wait();
    const after = await (oracle as any).getPriceInfo();
    console.log(`  new price()=${after.morphoPrice.toString()} (${(Number(after.morphoPrice) / 1e36).toFixed(4)}e36)`);
  } else {
    console.log('\nprice already correct, skipping setPrice');
  }

  // create the new tbill market
  const morpho = new Contract(MORPHO, MORPHO_ABI, w);
  const mp = { loanToken: ATC_CC, collateralToken: GTOKEN_ATBILL, oracle: ORACLE, irm: IRM, lltv: LLTV };
  const marketId = keccak256(AbiCoder.defaultAbiCoder().encode(['address', 'address', 'address', 'address', 'uint256'], [ATC_CC, GTOKEN_ATBILL, ORACLE, IRM, LLTV]));
  const mk = await (morpho as any).market(marketId);
  if (mk[4] === 0n) {
    console.log(`\n→ creating tbill market id=${marketId}...`);
    if (!(await (morpho as any).isLltvEnabled(LLTV))) { await (await (morpho as any).enableLltv(LLTV)).wait(); }
    if (!(await (morpho as any).isIrmEnabled(IRM))) { await (await (morpho as any).enableIrm(IRM)).wait(); }
    await (await (morpho as any).createMarket(mp)).wait();
    console.log('  market created');
  } else {
    console.log(`\ntbill market already exists id=${marketId}`);
  }

  console.log('\ndone');
}
main().catch((e) => { console.error(e); process.exit(1); });
