/**
 * 1_lend_setup.ts — wiring + sanity checks for cross-chain lending (2 markets, no vault redeploy)
 * CollateralToken on CC is same address as source RWA (identity mapping, no mirror)
 * Usage: npx tsx scripts/lending/1_lend_setup.ts --all
 *        npx tsx scripts/lending/1_lend_setup.ts --market nikkei
 * Env: CREDITCOIN_RPC_URL, PRIVATE_KEY, CORE_VAULT_ADDR, MORPHO_ADDR
 *      CUSDT_CC, ATC_CC, GTOKEN_SOURCE_AN225, GTOKEN_SOURCE_ATBILL, ORACLE_AN225, ORACLE_ATBILL, IRM_ADDR, LLTV
 */
import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet, keccak256, AbiCoder } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PK = process.env.PRIVATE_KEY || '';
const CORE = process.env.CORE_VAULT_ADDR || '';
const MORPHO = process.env.MORPHO_ADDR || '';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const MARKETS: Record<string, { loanEnv: string; sourceEnv: string; oracleEnv: string; lltv: string; desc: string }> = {
  nikkei: { loanEnv: 'CUSDT_CC', sourceEnv: 'GTOKEN_SOURCE_AN225', oracleEnv: 'ORACLE_AN225', lltv: '620000000000000000', desc: 'CUSDT / aN225' },
  tbill: { loanEnv: 'ATC_CC', sourceEnv: 'GTOKEN_SOURCE_ATBILL', oracleEnv: 'ORACLE_ATBILL', lltv: '620000000000000000', desc: 'ATC / aTBILL' },
};

const DEFAULTS: Record<string, string> = {
  CUSDT_CC: '0x60f6456FBE5566e515E63219fC9c0dbb80015F8E',
  ATC_CC: '0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a',
  GTOKEN_SOURCE_AN225: '0xc55D7821b6e0D8AC162e5b672aa9eA87A066B5a8',
  GTOKEN_SOURCE_ATBILL: '0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db',
  ORACLE_AN225: '0x4865dc0C4A3B11CF6FB57Dec180577f4824bB082',
  ORACLE_ATBILL: '0xC78D2b542Ef075c0753332ab2aA63b8C3f3793cd',
};

const MORPHO_ABI = [
  'function market(bytes32) view returns (tuple(uint128 totalSupplyAssets,uint128 totalSupplyShares,uint128 totalBorrowAssets,uint128 totalBorrowShares,uint48 lastUpdate,uint48 fee))',
  'function createMarket(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)) external',
  'function enableLltv(uint256) external',
  'function enableIrm(address) external',
  'function isLltvEnabled(uint256) view returns (bool)',
  'function isIrmEnabled(address) view returns (bool)',
  'function remoteCollateralManager() view returns (address)',
  'function setRemoteCollateralManager(address) external',
] as const;

const CORE_ABI = [
  'function sourceToCreditcoinToken(address) view returns (address)',
  'function setSourceTokenMapping(address sourceToken, address creditcoinToken) external',
  'function SOURCE_VAULT() view returns (address)',
] as const;

async function main() {
  if (!CORE || !MORPHO) { console.error('need CORE_VAULT_ADDR, MORPHO_ADDR'); process.exit(1); }
  if (!PK || !PK.startsWith('0x')) { console.error('PRIVATE_KEY missing'); process.exit(1); }

  const cc = new JsonRpcProvider(CC_RPC);
  const w = new Wallet(PK, cc);
  const morpho = new Contract(MORPHO, MORPHO_ABI, w);
  const core = new Contract(CORE, CORE_ABI, w);

  const marketArg = (arg('--market') || '').toLowerCase();
  const allFlag = process.argv.includes('--all');
  let keys: string[];
  if (marketArg) {
    if (!MARKETS[marketArg]) { console.error(`unknown --market ${marketArg} expected nikkei|tbill`); process.exit(1); }
    keys = [marketArg];
  } else if (allFlag) keys = Object.keys(MARKETS);
  else keys = Object.keys(MARKETS);

  const irm = arg('--irm') || process.env.IRM_ADDR || '0x3345A6582669C00cA022d9200C083b3097B18DBb';
  const lltvOverride = arg('--lltv') || process.env.LLTV;

  console.log(`morpho=${MORPHO} coreVault=${CORE} markets=${keys.join(',')} irm=${irm}`);
  console.log(`sourceVault on CC side: ${await (core as any).SOURCE_VAULT()}`);

  if ((await (morpho as any).remoteCollateralManager()) !== CORE) {
    console.log('setting remoteCollateralManager = CoreVault...');
    await (await (morpho as any).setRemoteCollateralManager(CORE)).wait();
  }

  for (const key of keys) {
    const m = MARKETS[key];
    const loan = process.env[m.loanEnv] || DEFAULTS[m.loanEnv] || '';
    const source = process.env[m.sourceEnv] || DEFAULTS[m.sourceEnv] || '';
    const oracle = process.env[m.oracleEnv] || DEFAULTS[m.oracleEnv] || '';
    const lltv = lltvOverride || m.lltv;
    const col = source; // identity: collateralToken on CC is same addr as source RWA
    if (!loan || !source || !oracle) { console.error(`[${key}] need ${m.loanEnv}/${m.sourceEnv}/${m.oracleEnv}`); continue; }

    const mp = { loanToken: loan, collateralToken: col, oracle, irm, lltv: BigInt(lltv) };
    console.log(`\n[${key}] ${m.desc} loan=${loan} col=${col} (identity) oracle=${oracle} lltv=${lltv}`);

    if ((await (core as any).sourceToCreditcoinToken(source)) !== col) {
      console.log(`[${key}] setting source token mapping (identity)...`);
      await (await (core as any).setSourceTokenMapping(source, col)).wait();
    }
    if (!(await (morpho as any).isLltvEnabled(mp.lltv))) { console.log(`[${key}] enableLltv`); await (await (morpho as any).enableLltv(mp.lltv)).wait(); }
    if (irm !== '0x0000000000000000000000000000000000000000' && !(await (morpho as any).isIrmEnabled(irm))) { console.log(`[${key}] enableIrm`); await (await (morpho as any).enableIrm(irm)).wait(); }

    const id = keccak256(AbiCoder.defaultAbiCoder().encode(['address','address','address','address','uint256'], [loan, col, oracle, irm, BigInt(lltv)]));
    const mk = await (morpho as any).market(id);
    const lastUpdate: bigint = mk[4];
    if (lastUpdate === 0n) {
      console.log(`[${key}] creating market id=${id}...`);
      await (await (morpho as any).createMarket(mp)).wait();
    } else console.log(`[${key}] market exists id=${id}`);
  }

  console.log('\ndone — supplyRemoteCollateral via CoreVault.verifyAndSupplyCollateral, withdraw via requestUnlock (CoreVault.sol:157/321) → Morpho 351/368');
}
main().catch((e) => { console.error(e); process.exit(1); });
