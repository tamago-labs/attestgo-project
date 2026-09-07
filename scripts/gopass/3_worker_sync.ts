/**
 * 3_worker_sync.ts — real tx-inclusion proof: prove GOPass mint tx via ProofBuilder + 0x0FD2 verifySingle
 * Usage: npx tsx scripts/gopass/3_worker_sync.ts --wallet 0x2c1A... --tx 0x<mintTxHash>
 * Env: CREDITCOIN_RPC_URL, SEPOLIA_RPC_URL, GOPASS_ADDR, VERIFIER_ADDR, PRIVATE_KEY, PROOF_BUILDER_URL
 */


// PS C:\projects\attestgo-project> npx tsx scripts/gopass/3_worker_sync.ts --wallet 0xB045bbB51f3CE266A506f332EDBDe176C9862Ff3 --tx 0xa14ac9fcd71792977f953877111598359c33e277c542c99480bee4747b50e380
// fetching record for 0xB045bbB51f3CE266A506f332EDBDe176C9862Ff3 on Sepolia hub...
//   tier=10 bitmap=1 expiry=1819176071 frozen=false active=false kycSource=sumsub hash=0xdccf0bb5635d44df8d48e18e1e9d424fb0c1911cbbd4dd4f34dca4c2b7fb316e
//   generating tx-inclusion proof for mint tx 0xa14ac9fcd71792977f953877111598359c33e277c542c99480bee4747b50e380 via ProofBuilder chainKey 1...
//   latest attested 11562330
//   tx block 11562361, waiting attested...
// Height 11562361 not yet attested and in proof builder service cache for chain key 1. Latest height: 11562330. Retrying in 15000ms...
// Height 11562361 not yet attested and in proof builder service cache for chain key 1. Latest height: 11562330. Retrying in 15000ms...
// Height 11562361 not yet attested and in proof builder service cache for chain key 1. Latest height: 11562360. Retrying in 15000ms...
// Height 11562361 not yet attested and in proof builder service cache for chain key 1. Latest height: 11562360. Retrying in 15000ms...
//   attested, generating proof...
//   proof header=11562361 chainKey=1 siblings=8 roots=10 cached=true
//   off-chain verifySingle on CC3: ✅
//   calling registry.syncPassWithTxProof on CC3...
//   tx 0xbd1651c2fb52ab8e6769d1eea7e863f03d281fc14d61b49221c0156e39e18425 waiting...
//   mined block 5370168 status=1
//   isEligible on CC registry: true
// done — worker now calls Sepolia GOPass.setActive(true) to activate (hub pending → eligible)

import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import { proofProvider, blockProver, chainInfo } from '@gluwa/usc-sdk';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || process.env.SOURCE_CHAIN_RPC_URL || '';
const GOPASS_ADDR = process.env.GOPASS_ADDR || ''; // Sepolia hub
const REGISTRY_ADDR = process.env.REGISTRY_ADDR || process.env.VERIFIER_ADDR || ''; // CC3 registry
const PK = process.env.PRIVATE_KEY || process.env.WORKER_PRIVATE_KEY || '';
const PROOF_BUILDER_URL = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const SEPOLIA_CHAIN_KEY = 1; // Sepolia chainKey for 0x0FD2 verifySingle on CC3

if (!GOPASS_ADDR || !REGISTRY_ADDR) { console.error('GOPASS_ADDR/REGISTRY_ADDR missing'); process.exit(1); }
if (!SEPOLIA_RPC) { console.error('SEPOLIA_RPC_URL missing'); process.exit(1); }
if (!PK || !PK.startsWith('0x')) { console.error('PRIVATE_KEY missing'); process.exit(1); }

const HUB_ABI = [
  'function getRecord(address) view returns (tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource))',
  'function recordHash(address) view returns (bytes32)',
] as const;
const REGISTRY_ABI = [
  "function syncPass(address wallet, tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource) r, bytes proof) external",
  "function syncPassWithTxProof(address wallet, tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource) r, uint64 headerNumber, bytes txBytes, bytes32 merkleRoot, tuple(bytes32 hash,bool isLeft)[] siblings, bytes32 lowerDigest, bytes32[] roots) external",
  "function isEligible(address wallet, tuple(bytes2 allowed_group,bytes2 allowed_sub_group,uint8 min_tier,uint8 min_sub_tier,bool is_black_list,uint256 countriesBitmap) rule) view returns (bool)",
] as const;

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const walletAddr = arg('--wallet') || arg('--to') || '';
  const txHash = arg('--tx') || arg('--txHash') || '';
  if (!walletAddr || !walletAddr.startsWith('0x')) { console.error('need --wallet 0x...'); process.exit(1); }
  const sepolia = new JsonRpcProvider(SEPOLIA_RPC);
  const cc = new JsonRpcProvider(CC_RPC);
  const w = new Wallet(PK, cc);
  const hub = new Contract(GOPASS_ADDR, HUB_ABI, sepolia);
  const registry = new Contract(REGISTRY_ADDR, REGISTRY_ABI, w);

  console.log(`fetching record for ${walletAddr} on Sepolia hub...`);
  const rec: any = await (hub as any).getRecord(walletAddr);
  const hash: string = await (hub as any).recordHash(walletAddr);
  if (hash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    console.error('no pass on hub for wallet — mint first via 2_mint.ts');
    process.exit(1);
  }
  console.log(`  tier=${rec.tier} bitmap=${rec.countryBitmap} expiry=${rec.expiry} frozen=${rec.frozen} active=${rec.active} kycSource=${rec.kycSource || '(blank)'} hash=${hash}`);
  const tuple = { tier: rec.tier, subTier: rec.subTier, group: rec.group, subGroup: rec.subGroup, countryBitmap: rec.countryBitmap, expiry: rec.expiry, frozen: rec.frozen, active: rec.active, customerIdHash: rec.customerIdHash, kycSource: rec.kycSource || '' } as any;

  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
    console.error('need --tx 0x<mintTxHash> for real ProofBuilder proof (no dummy)');
    console.error('  example: npx tsx scripts/gopass/3_worker_sync.ts --wallet 0xB045... --tx 0x1ef4...');
    process.exit(1);
  }
  console.log(`  generating tx-inclusion proof for mint tx ${txHash} via ProofBuilder chainKey ${SEPOLIA_CHAIN_KEY}...`);
  const builder = new proofProvider.service.ProofBuilder(SEPOLIA_CHAIN_KEY, PROOF_BUILDER_URL, 5000);
  const ccInfo = new chainInfo.PrecompileChainInfoProvider(cc);
  const latest = await ccInfo.getLatestAttestedHeightAndHash(SEPOLIA_CHAIN_KEY);
  console.log(`  latest attested ${latest.height}`);
  const tx = await sepolia.getTransaction(txHash);
  if (!tx?.blockNumber) throw new Error(`tx ${txHash} not found / not mined on Sepolia`);
  console.log(`  tx block ${tx.blockNumber}, waiting attested...`);
  await builder.waitUntilHeightAttested(SEPOLIA_CHAIN_KEY, tx.blockNumber, 15_000, 600_000);
  console.log('  attested, generating proof...');
  const res = await builder.getProof(txHash);
  if (!res.success || !res.data) throw new Error(`Proof generation failed: ${res.error}`);
  const d = res.data as any;
  console.log(`  proof header=${d.headerNumber} chainKey=${d.chainKey} siblings=${d.merkleProof.siblings.length} roots=${d.continuityProof.roots.length} cached=${d.cached}`);
  const prover = new blockProver.PrecompileBlockProver(cc);
  const ok = await prover.verifySingle(d.chainKey, d.headerNumber, d.txBytes, d.merkleProof, d.continuityProof);
  console.log(`  off-chain verifySingle on CC3: ${ok ? '✅' : '❌'}`);
  if (!ok) throw new Error('off-chain verifySingle failed');
  console.log('  calling registry.syncPassWithTxProof on CC3...');
  const txResp = await (registry as any).syncPassWithTxProof(
    walletAddr,
    tuple,
    d.headerNumber,
    d.txBytes,
    d.merkleProof.root,
    d.merkleProof.siblings.map((s: any) => ({ hash: s.hash ?? s, isLeft: s.isLeft ?? false })),
    d.continuityProof.lowerEndpointDigest,
    d.continuityProof.roots,
  );
  console.log(`  tx ${txResp.hash} waiting...`);
  const rc = await txResp.wait();
  console.log(`  mined block ${rc.blockNumber} status=${rc.status}`);

  const rule = { allowed_group: '0x0000', allowed_sub_group: '0x0000', min_tier: 10, min_sub_tier: 0, is_black_list: false, countriesBitmap: 3n } as any;
  console.log(`  isEligible on CC registry: ${await (registry as any).isEligible(walletAddr, rule)}`);
  console.log('done — worker now calls Sepolia GOPass.setActive(true) to activate (hub pending → eligible)');
}

main().catch((e) => { console.error(e); process.exit(1); });
