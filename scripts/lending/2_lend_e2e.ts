/**
 * 2_lend_e2e.ts — borrower E2E: lock RWA on Sepolia -> Attestcoin proof -> credit on CC -> borrow -> repay -> requestUnlock
 * (Oracle Query Worker role, docs provisioning steps 3a-3c; submission is permissionless.)
 *
 * Usage:
 *   npx tsx scripts/lending/2_lend_e2e.ts --collateral 10 --borrow 6
 * Env:
 *   SEPOLIA_RPC_URL, CREDITCOIN_RPC_URL, PRIVATE_KEY (borrower = worker for proof submission)
 *   SOURCE_VAULT_ADDR, GTOKEN_SOURCE (Sepolia RWA), CORE_VAULT_ADDR, MORPHO_ADDR
 *   USDC_CC, GTOKEN_CC, ORACLE_ADDR, IRM_ADDR (0x0 ok), LLTV (default 0.62e18)
 *   PROOF_BUILDER_URL, SOURCE_CHAIN_KEY=1, SOURCE_CHAIN_ID=11155111
 */
import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet, solidityPackedKeccak256 } from 'ethers';
import { proofProvider, chainInfo } from '@gluwa/usc-sdk';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || '';
const PK = process.env.PRIVATE_KEY || '';
const SOURCE_VAULT = process.env.SOURCE_VAULT_ADDR || '';
const GTOKEN_SOURCE = process.env.GTOKEN_SOURCE || '';
const CORE = process.env.CORE_VAULT_ADDR || '';
const MORPHO = process.env.MORPHO_ADDR || '';
const USDC = process.env.USDC_CC || '';
const GTOKEN_CC = process.env.GTOKEN_CC || '';
const ORACLE = process.env.ORACLE_ADDR || '';
const IRM = process.env.IRM_ADDR || '0x0000000000000000000000000000000000000000';
const LLTV = process.env.LLTV || '620000000000000000';
const PROVER_URL = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const CHAIN_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1); // Sepolia chainKey (0x0FD2)
const SOURCE_CHAIN_ID = Number(process.env.SOURCE_CHAIN_ID || 11155111);

if (!SEPOLIA_RPC || !SOURCE_VAULT || !GTOKEN_SOURCE || !CORE || !MORPHO) {
  console.error('need SEPOLIA_RPC_URL SOURCE_VAULT_ADDR GTOKEN_SOURCE CORE_VAULT_ADDR MORPHO_ADDR');
  process.exit(1);
}
if (!PK || !PK.startsWith('0x')) { console.error('PRIVATE_KEY missing'); process.exit(1); }

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const SOURCE_ABI = [
  'function lock(address recipient, address collateralToken, uint256 amount, bytes32 marketId, uint256 nonceArg) returns (bytes32 lockId)',
  'function nonce() view returns (uint256)',
  'function lockedTotal(address,address) view returns (uint256)',
  'function available(address,address) view returns (uint256)',
] as const;

const CORE_ABI = [
  'function verifyAndSupplyCollateral(tuple(bytes32 lockId,address sourceCollateral,uint256 amount,address recipient,bytes32 marketId,uint64 headerNumber,bytes txBytes,bytes32 merkleRoot,bytes32[] siblings,bytes32 lowerDigest,bytes32[] roots) p, tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp) external',
  'function borrow(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp, uint256 assets, address receiver) returns (uint256,uint256)',
  'function repay(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp, uint256 assets, uint256 shares, address onBehalf) returns (uint256,uint256)',
  'function requestUnlock(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp, uint256 amount) external',
] as const;

const MORPHO_ABI = [
  'function position(bytes32,address) view returns (tuple(uint256 supplyShares,uint128 borrowShares,uint128 collateral))',
] as const;

const ERC20_ABI = ['function approve(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)'] as const;

async function main() {
  const collateral = BigInt(arg('--collateral') || '10');
  const borrowAmt = BigInt(arg('--borrow') || '6');

  const sepolia = new JsonRpcProvider(SEPOLIA_RPC);
  const cc = new JsonRpcProvider(CC_RPC);
  const wSepolia = new Wallet(PK, sepolia);
  const wCC = new Wallet(PK, cc);

  const sourceVault = new Contract(SOURCE_VAULT, SOURCE_ABI, wSepolia);
  const gtoken = new Contract(GTOKEN_SOURCE, ERC20_ABI, wSepolia);
  const core = new Contract(CORE, CORE_ABI, wCC);
  const morpho = new Contract(MORPHO, MORPHO_ABI, cc);
  const usdc = new Contract(USDC, ERC20_ABI, wCC);

  const mp = { loanToken: USDC, collateralToken: GTOKEN_CC, oracle: ORACLE, irm: IRM, lltv: BigInt(LLTV) };
  // MarketParamsLib.id = keccak256(abi.encode(MarketParams)) == keccak of the 5 packed words
  const marketId = solidityPackedKeccak256(
    ['address', 'address', 'address', 'address', 'uint256'],
    [USDC, GTOKEN_CC, ORACLE, IRM, BigInt(LLTV)],
  );

  console.log(`borrower ${wSepolia.address} collateral=${collateral} borrow=${borrowAmt}`);

  // 1. lock RWA on Sepolia (escrow)
  await (await (gtoken as any).approve(SOURCE_VAULT, collateral)).wait();
  const nonce = await (sourceVault as any).nonce();
  const lockTx = await (sourceVault as any).lock(wSepolia.address, GTOKEN_SOURCE, collateral, marketId, nonce);
  console.log(`1) lock tx ${lockTx.hash} (nonce ${nonce})...`);
  const rc = await lockTx.wait();
  const lockBlock = rc.blockNumber;
  console.log(`   mined block ${lockBlock}; lockedTotal=${await (sourceVault as any).lockedTotal(wSepolia.address, GTOKEN_SOURCE)}`);

  // 2. wait attested + build proof (ProofBuilder, chainKey 1) and submit to CoreVault
  const builder = new proofProvider.service.ProofBuilder(CHAIN_KEY, PROVER_URL, 5000);
  const info = new chainInfo.PrecompileChainInfoProvider(cc);
  const latest = await info.getLatestAttestedHeightAndHash(CHAIN_KEY);
  console.log(`2) latest attested ${latest.height}, waiting for ${lockBlock}...`);
  await builder.waitUntilHeightAttested(CHAIN_KEY, lockBlock, 15_000, 1_200_000);
  const res = await builder.getProof(lockTx.hash);
  if (!res.success || !res.data) throw new Error(`proof failed: ${res.error}`);
  const d: any = res.data;
  console.log(`   proof header=${d.headerNumber} siblings=${d.merkleProof.siblings.length} roots=${d.continuityProof.roots.length}`);

  const proof = {
    lockId: solidityPackedKeccak256(
      ['uint256', 'address', 'address', 'uint256', 'bytes32', 'uint256'],
      [SOURCE_CHAIN_ID, GTOKEN_SOURCE, wSepolia.address, collateral, marketId, nonce],
    ),
    sourceCollateral: GTOKEN_SOURCE,
    amount: collateral,
    recipient: wSepolia.address,
    marketId,
    headerNumber: d.headerNumber,
    txBytes: d.txBytes,
    merkleRoot: d.merkleProof.root,
    siblings: d.merkleProof.siblings.map((s: any) => s.hash ?? s),
    lowerDigest: d.continuityProof.lowerEndpointDigest,
    roots: d.continuityProof.roots,
  };
  const tx2 = await (core as any).verifyAndSupplyCollateral(proof, mp);
  console.log(`   verifyAndSupplyCollateral tx ${tx2.hash}...`);
  await tx2.wait();
  const pos = await (morpho as any).position(marketId, wSepolia.address);
  console.log(`   collateral credited: ${pos[2].toString()}`);

  // 3. borrow USDC on Creditcoin
  await (await (usdc as any).approve(CORE, 2n ** 256n - 1n)).wait();
  const tx3 = await (core as any).borrow(mp, borrowAmt, wSepolia.address);
  console.log(`3) borrow ${borrowAmt} USDC tx ${tx3.hash}...`);
  await tx3.wait();

  // 4. repay
  const tx4 = await (core as any).repay(mp, borrowAmt, 0, wSepolia.address);
  console.log(`4) repay tx ${tx4.hash}...`);
  await tx4.wait();

  // 5. request unlock (worker settles on Sepolia via 3_worker_unlock.ts)
  const tx5 = await (core as any).requestUnlock(mp, collateral);
  console.log(`5) requestUnlock tx ${tx5.hash} — worker will call SourceVault.unlock on Sepolia`);
  await tx5.wait();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
