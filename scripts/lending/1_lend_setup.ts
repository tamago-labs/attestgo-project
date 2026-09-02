/**
 * 1_lend_setup.ts — wiring + sanity checks for cross-chain lending (see contracts/CROSS_CHAIN_LENDING_PLAN.md)
 * Usage: npx tsx scripts/lending/1_lend_setup.ts [--supply 1000]
 * Env: CREDITCOIN_RPC_URL, PRIVATE_KEY, CORE_VAULT_ADDR, MORPHO_ADDR, USDC_CC, GTOKEN_CC, ORACLE_ADDR, IRM_ADDR (0x0 ok), LLTV (default 0.62e18)
 */
import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PK = process.env.PRIVATE_KEY || '';
const CORE = process.env.CORE_VAULT_ADDR || '';
const MORPHO = process.env.MORPHO_ADDR || '';
const USDC = process.env.USDC_CC || '';
const GTOKEN_CC = process.env.GTOKEN_CC || '';
const GTOKEN_SOURCE = process.env.GTOKEN_SOURCE || '';
const ORACLE = process.env.ORACLE_ADDR || '';
const IRM = process.env.IRM_ADDR || '0x0000000000000000000000000000000000000000';
const LLTV = process.env.LLTV || '620000000000000000';

if (!CORE || !MORPHO || !USDC || !GTOKEN_CC || !ORACLE) {
  console.error('need CORE_VAULT_ADDR, MORPHO_ADDR, USDC_CC, GTOKEN_CC, ORACLE_ADDR');
  process.exit(1);
}
if (!PK || !PK.startsWith('0x')) { console.error('PRIVATE_KEY missing'); process.exit(1); }

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const MORPHO_ABI = [
  'function market(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)) view returns (tuple(uint128,uint128,uint128,uint128,uint48,uint48))',
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
  'function supply(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp, uint256 assets, uint256 shares, address onBehalf) returns (uint256,uint256)',
] as const;

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function approve(address,uint256) returns (bool)', 'function decimals() view returns (uint8)'] as const;

async function main() {
  const cc = new JsonRpcProvider(CC_RPC);
  const w = new Wallet(PK, cc);
  const morpho = new Contract(MORPHO, MORPHO_ABI, w);
  const core = new Contract(CORE, CORE_ABI, w);
  const usdc = new Contract(USDC, ERC20_ABI, cc);

  const mp = { loanToken: USDC, collateralToken: GTOKEN_CC, oracle: ORACLE, irm: IRM, lltv: BigInt(LLTV) };
  console.log(`morpho=${MORPHO} coreVault=${CORE} lltv=${LLTV}`);
  console.log(`sourceVault on CC side: ${await (core as any).SOURCE_VAULT()}`);

  // wiring checks / fixes
  if ((await (morpho as any).remoteCollateralManager()) !== CORE) {
    console.log('setting remoteCollateralManager = CoreVault...');
    await (await (morpho as any).setRemoteCollateralManager(CORE)).wait();
  }
  if ((await (core as any).sourceToCreditcoinToken(GTOKEN_SOURCE)) !== GTOKEN_CC) {
    console.log('setting source token mapping...');
    await (await (core as any).setSourceTokenMapping(GTOKEN_SOURCE, GTOKEN_CC)).wait();
  }
  if (!(await (morpho as any).isLltvEnabled(mp.lltv))) await (await (morpho as any).enableLltv(mp.lltv)).wait();
  if (!(await (morpho as any).isIrmEnabled(IRM))) await (await (morpho as any).enableIrm(IRM)).wait();

  const m = await (morpho as any).market(mp);
  const lastUpdate: bigint = m[4];
  if (lastUpdate === 0n) {
    console.log('creating market...');
    await (await (morpho as any).createMarket(mp)).wait();
  } else {
    console.log('market exists');
  }

  const supplyArg = arg('--supply');
  if (supplyArg) {
    const amount = BigInt(supplyArg);
    await (await (usdc as any).connect(w).approve(CORE, amount)).wait();
    const tx = await (core as any).connect(w).supply(mp, amount, 0, w.address);
    console.log(`supplied ${supplyArg} USDC tx ${tx.hash} -> earning for suppliers`);
  }

  console.log('bal USDC(w):', (await (usdc as any).balanceOf(w.address)).toString());
  console.log('done — next: 2_lend_e2e.ts (borrower flow) and 3_worker_unlock.ts (worker)');
}

main().catch((e) => { console.error(e); process.exit(1); });
