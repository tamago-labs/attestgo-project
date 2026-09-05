/**
 * 2d_repay_and_unlock.ts — repay loan + request unlock (worker settles on Sepolia via 3_worker_unlock.ts)
 * Usage: npx tsx scripts/lending/2d_repay_and_unlock.ts --market nikkei --repay 100 --unlock 10
 * Env: CREDITCOIN_RPC_URL, PRIVATE_KEY, CORE_VAULT_ADDR, CUSDT_CC, ATC_CC, GTOKEN_SOURCE_AN225, GTOKEN_SOURCE_ATBILL, ORACLE_AN225, ORACLE_ATBILL, IRM_ADDR, LLTV
 */
import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet, parseUnits } from 'ethers';
import { solidityPackedKeccak256 } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PK = process.env.PRIVATE_KEY || '';
const CORE = process.env.CORE_VAULT_ADDR || '0x78bb1584fF13E93dD42B90b0F47C893e1B6031CC';
function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const MARKETS: Record<string, { loanEnv: string; sourceEnv: string; oracleEnv: string; lltv: string; loanDec: number }> = {
  nikkei: { loanEnv: 'CUSDT_CC', sourceEnv: 'GTOKEN_SOURCE_AN225', oracleEnv: 'ORACLE_AN225', lltv: '620000000000000000', loanDec: 6 },
  tbill: { loanEnv: 'ATC_CC', sourceEnv: 'GTOKEN_SOURCE_ATBILL', oracleEnv: 'ORACLE_ATBILL', lltv: '620000000000000000', loanDec: 18 },
};
const DEFAULTS: Record<string, string> = {
  CUSDT_CC: '0x60f6456FBE5566e515E63219fC9c0dbb80015F8E',
  ATC_CC: '0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a',
  GTOKEN_SOURCE_AN225: '0xc55D7821b6e0D8AC162e5b672aa9ea87a066b5a8',
  GTOKEN_SOURCE_ATBILL: '0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db',
  ORACLE_AN225: '0x4865dc0C4A3B11CF6FB57Dec180577f4824bB082',
  ORACLE_ATBILL: '0xc1D218017533dA1F61ba28125bcCcEC0FB3874B2',
};

const CORE_ABI = ['function repay(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp, uint256 assets, uint256 shares, address onBehalf) returns (uint256,uint256)', 'function requestUnlock(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp, uint256 amount) external'] as const;
const ERC20_ABI = ['function approve(address,uint256) returns (bool)'] as const;

async function main() {
  const key = (arg('--market') || 'nikkei').toLowerCase();
  const m = MARKETS[key]; if (!m) { console.error('unknown market'); process.exit(1); }
  const repayRaw = arg('--repay') || arg('--borrow') || '100';
  const unlockRaw = arg('--unlock') || arg('--amount') || '10';
  const irm = arg('--irm') || process.env.IRM_ADDR || '0x3345A6582669C00cA022d9200C083b3097B18DBb';
  const lltv = arg('--lltv') || process.env.LLTV || m.lltv;
  const loan = process.env[m.loanEnv] || DEFAULTS[m.loanEnv];
  const source = process.env[m.sourceEnv] || DEFAULTS[m.sourceEnv];
  const oracle = process.env[m.oracleEnv] || DEFAULTS[m.oracleEnv];
  const col = source;
  const mp = { loanToken: loan, collateralToken: col, oracle, irm, lltv: BigInt(lltv) };
  const repayAmt = parseUnits(repayRaw, m.loanDec);
  const unlockAmt = parseUnits(unlockRaw, 18);

  const cc = new JsonRpcProvider(CC_RPC);
  const w = new Wallet(PK, cc);
  const loanC = new Contract(loan, ERC20_ABI, w);
  await (await (loanC as any).approve(CORE, repayAmt)).wait();
  const core = new Contract(CORE, CORE_ABI, w);
  const tx4 = await (core as any).repay(mp, repayAmt, 0, w.address);
  console.log(`repay tx ${tx4.hash}...`);
  await tx4.wait();
  const tx5 = await (core as any).requestUnlock(mp, unlockAmt);
  console.log(`requestUnlock tx ${tx5.hash} — worker will call SourceVault.unlock on Sepolia`);
  await tx5.wait();
  console.log('done');
}
main().catch(e => { console.error(e); process.exit(1); });
