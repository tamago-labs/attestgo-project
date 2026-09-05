/**
 * 2b_lock_collateral.ts — borrower locks RWA on Sepolia SourceVault (step 1, no waiting)
 * Checks GOPass active on Sepolia, approves GToken, calls lock(recipient, collateralToken, amount, marketId, nonce)
 * Usage: npx tsx scripts/lending/2b_lock_collateral.ts --market nikkei --amount 10
 * Env: SEPOLIA_RPC_URL, PRIVATE_KEY, SOURCE_VAULT_ADDR, GTOKEN_SOURCE_AN225, GTOKEN_SOURCE_ATBILL, CUSDT_CC, ATC_CC, ORACLE_AN225, ORACLE_ATBILL, IRM_ADDR, LLTV
 */
import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet, parseUnits, keccak256, AbiCoder } from 'ethers';

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || '';
const PK = process.env.PRIVATE_KEY || '';
const SOURCE_VAULT = process.env.SOURCE_VAULT_ADDR || '0xd81F1A1a63fB33989bF46432527A6F7E997cF6ED';
function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const MARKETS: Record<string, { loanEnv: string; sourceEnv: string; oracleEnv: string; lltv: string }> = {
  nikkei: { loanEnv: 'CUSDT_CC', sourceEnv: 'GTOKEN_SOURCE_AN225', oracleEnv: 'ORACLE_AN225', lltv: '620000000000000000' },
  tbill: { loanEnv: 'ATC_CC', sourceEnv: 'GTOKEN_SOURCE_ATBILL', oracleEnv: 'ORACLE_ATBILL', lltv: '620000000000000000' },
};
const DEFAULTS: Record<string, string> = {
  CUSDT_CC: '0x60f6456FBE5566e515E63219fC9c0dbb80015F8E',
  ATC_CC: '0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a',
  GTOKEN_SOURCE_AN225: '0xc55D7821b6e0D8AC162e5b672aa9eA87A066B5a8',
  GTOKEN_SOURCE_ATBILL: '0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db',
  ORACLE_AN225: '0x4865dc0C4A3B11CF6FB57Dec180577f4824bB082',
  ORACLE_ATBILL: '0xc1D218017533dA1F61ba28125bcCcEC0FB3874B2',
};

const SOURCE_ABI = ['function lock(address recipient, address collateralToken, uint256 amount, bytes32 marketId, uint256 nonceArg) returns (bytes32 lockId)', 'function nonce() view returns (uint256)'] as const;
const ERC20_ABI = ['function approve(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)'] as const;
const GOPASS_ABI = ['function isEligible(address wallet, tuple(bytes2 allowed_group,bytes2 allowed_sub_group,uint8 min_tier,uint8 min_sub_tier,bool is_black_list,uint256 countriesBitmap) rule) view returns (bool)'] as const;

async function main() {
  if (!SEPOLIA_RPC) { console.error('SEPOLIA_RPC_URL missing'); process.exit(1); }
  if (!PK.startsWith('0x')) { console.error('PRIVATE_KEY missing'); process.exit(1); }
  const key = (arg('--market') || 'nikkei').toLowerCase();
  const m = MARKETS[key]; if (!m) { console.error('unknown --market nikkei|tbill'); process.exit(1); }
  const amountRaw = arg('--amount') || '10';
  const amount = parseUnits(amountRaw, 18);
  const irm = arg('--irm') || process.env.IRM_ADDR || '0x3345A6582669C00cA022d9200C083b3097B18DBb';
  const lltv = arg('--lltv') || process.env.LLTV || m.lltv;
  const loan = process.env[m.loanEnv] || DEFAULTS[m.loanEnv];
  const source = process.env[m.sourceEnv] || DEFAULTS[m.sourceEnv];
  const oracle = process.env[m.oracleEnv] || DEFAULTS[m.oracleEnv];
  const col = source;
  const marketId = keccak256(AbiCoder.defaultAbiCoder().encode(['address','address','address','address','uint256'], [loan, col, oracle, irm, BigInt(lltv)]));

  const sepolia = new JsonRpcProvider(SEPOLIA_RPC);
  const w = new Wallet(PK, sepolia);
  const vault = new Contract(SOURCE_VAULT, SOURCE_ABI, w);
  const gtoken = new Contract(source, ERC20_ABI, w);

  // GOPass check (optional, warns if not eligible)
  const gopassAddr = process.env.GOPASS_ADDR || '0x0a6aD3b8B8D1A69Ba44002983e64e4824cB63334';
  try {
    const gopass = new Contract(gopassAddr, GOPASS_ABI, sepolia);
    const eligible = await (gopass as any).isEligible(w.address, ['0x0000','0x0000',10,0,false, key === 'nikkei' ? 7 : 1]);
    console.log(`GOPass eligible for ${w.address}: ${eligible}${eligible ? '' : ' — mint+active GOPass first'}`);
  } catch {}

  console.log(`borrower ${w.address} market=${key} amount=${amountRaw} marketId=${marketId}`);
  const bal = await (gtoken as any).balanceOf(w.address);
  console.log(`GToken bal ${bal} need ${amount}`);
  await (await (gtoken as any).approve(SOURCE_VAULT, amount)).wait();
  const nonce = await (vault as any).nonce();
  const tx = await (vault as any).lock(w.address, source, amount, marketId, nonce);
  console.log(`lock tx ${tx.hash} nonce ${nonce} — save for 2c`);
  const rc = await tx.wait();
  console.log(`mined block ${rc.blockNumber} lockId=${keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','address','address','uint256','bytes32','uint256'], [11155111, source, w.address, amount, marketId, nonce]))}`);
  console.log(`Next: npx tsx scripts/lending/2c_prove_and_borrow.ts --market ${key} --lockTx ${tx.hash} --amount ${amountRaw}`);
}
main().catch(e => { console.error(e); process.exit(1); });
