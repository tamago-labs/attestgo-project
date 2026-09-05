/**
 * 2a_supply_liquidity.ts — supplier seeds Morpho market via CoreVault (must exist before borrowers can borrow)
 * Usage: npx tsx scripts/lending/2a_supply_liquidity.ts --market nikkei --amount 1000
 *        npx tsx scripts/lending/2a_supply_liquidity.ts --all --amount 1000
 * Env: CREDITCOIN_RPC_URL, PRIVATE_KEY, CORE_VAULT_ADDR, CUSDT_CC, ATC_CC, GTOKEN_SOURCE_AN225, GTOKEN_SOURCE_ATBILL, ORACLE_AN225, ORACLE_ATBILL, IRM_ADDR, LLTV
 */
import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet, parseUnits } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PK = process.env.PRIVATE_KEY || '';
const CORE = process.env.CORE_VAULT_ADDR || '';
function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const MARKETS: Record<string, { loanEnv: string; sourceEnv: string; oracleEnv: string; lltv: string; loanDec: number }> = {
  nikkei: { loanEnv: 'CUSDT_CC', sourceEnv: 'GTOKEN_SOURCE_AN225', oracleEnv: 'ORACLE_AN225', lltv: '620000000000000000', loanDec: 6 },
  tbill: { loanEnv: 'ATC_CC', sourceEnv: 'GTOKEN_SOURCE_ATBILL', oracleEnv: 'ORACLE_ATBILL', lltv: '620000000000000000', loanDec: 18 },
};
const DEFAULTS: Record<string, string> = {
  CUSDT_CC: '0x60f6456FBE5566e515E63219fC9c0dbb80015F8E',
  ATC_CC: '0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a',
  GTOKEN_SOURCE_AN225: '0xc55D7821b6e0D8AC162e5b672aa9eA87A066B5a8',
  GTOKEN_SOURCE_ATBILL: '0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db',
  ORACLE_AN225: '0x4865dc0C4A3B11CF6FB57Dec180577f4824bB082',
  ORACLE_ATBILL: '0xc1D218017533dA1F61ba28125bcCcEC0FB3874B2',
};

const CORE_ABI = ['function supply(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp, uint256 assets, uint256 shares, address onBehalf) returns (uint256,uint256)'] as const;
const ERC20_ABI = ['function approve(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'] as const;

async function main() {
  if (!PK.startsWith('0x') || !CORE) { console.error('need PRIVATE_KEY, CORE_VAULT_ADDR'); process.exit(1); }
  const marketArg = (arg('--market') || '').toLowerCase();
  const keys = marketArg ? [marketArg] : Object.keys(MARKETS).filter(k => process.argv.includes('--all') || !marketArg ? true : false);
  // default --all if no market specified
  const selected = marketArg ? [marketArg] : Object.keys(MARKETS);
  const amountRaw = arg('--amount') || '1000';
  const irm = arg('--irm') || process.env.IRM_ADDR || '0x3345A6582669C00cA022d9200C083b3097B18DBb';
  const lltvOverride = arg('--lltv') || process.env.LLTV;
  const cc = new JsonRpcProvider(CC_RPC);
  const w = new Wallet(PK, cc);
  console.log(`supplier ${w.address} core=${CORE} markets=${selected.join(',')} amount=${amountRaw}`);
  for (const key of selected) {
    const m = MARKETS[key];
    if (!m) { console.error(`unknown market ${key}`); continue; }
    const loan = process.env[m.loanEnv] || DEFAULTS[m.loanEnv];
    const source = process.env[m.sourceEnv] || DEFAULTS[m.sourceEnv];
    const oracle = process.env[m.oracleEnv] || DEFAULTS[m.oracleEnv];
    const lltv = lltvOverride || m.lltv;
    const col = source; // identity
    const dec = m.loanDec;
    const assets = parseUnits(amountRaw, dec);
    const loanC = new Contract(loan, ERC20_ABI, w);
    const bal = await (loanC as any).balanceOf(w.address);
    console.log(`[${key}] loan=${loan} bal=${bal} need=${assets}`);
    if (bal < assets) console.warn(`[${key}] insufficient loan balance`);
    const mp = { loanToken: loan, collateralToken: col, oracle, irm, lltv: BigInt(lltv) };
    await (await (loanC as any).approve(CORE, assets)).wait();
    const core = new Contract(CORE, CORE_ABI, w);
    const tx = await (core as any).supply(mp, assets, 0, w.address);
    console.log(`[${key}] supply tx ${tx.hash}...`);
    await tx.wait();
    console.log(`[${key}] supplied ${amountRaw}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
