/**
 * 3_verify_batch_view.ts — Batch proof + view verify (read-only)
 *
 * Tests batch path where 2-10 txs share one continuity proof (must be within 1000 blocks).
 * Useful for AttestGO payment-streams where multiple stream payments settle together.
 * Docs: MAX_BATCH_SIZE=10, MAX_BATCH_RANGE=1000 blocks.
 *
 * Usage:
 *   npx tsx scripts/3_verify_batch_view.ts 0x<tx1> 0x<tx2> [...]
 *   npx tsx scripts/3_verify_batch_view.ts 0xabc... 0xdef... --chainKey 1
 */
import 'dotenv/config';
import { JsonRpcProvider } from 'ethers';
import { chainInfo, blockProver, proofProvider } from '@gluwa/usc-sdk';

const SOURCE_CHAIN_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1);
const SOURCE_CHAIN_RPC_URL = process.env.SOURCE_CHAIN_RPC_URL || '';
const CREDITCOIN_RPC_URL = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PROOF_BUILDER_URL = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const chainKeyArg = process.argv.find((a) => a.startsWith('--chainKey='))?.split('=')[1];
  const chainKey = chainKeyArg ? Number(chainKeyArg) : SOURCE_CHAIN_KEY;

  if (args.length < 2 || args.some((h) => !h.startsWith('0x') || h.length !== 66)) {
    console.error(`
Usage:
  npx tsx scripts/3_verify_batch_view.ts <txHash1> <txHash2> [..txHash10]

Env:
  SOURCE_CHAIN_KEY=1 SOURCE_CHAIN_RPC_URL=... CREDITCOIN_RPC_URL=... PROOF_BUILDER_URL=...
  Override: --chainKey=1

Notes:
  - All txs must be on same chainKey and within 1000 blocks.
  - Each tx must be mined + attested (~8-10 min after mining).
`);
    process.exit(1);
  }
  if (!SOURCE_CHAIN_RPC_URL) {
    console.error('❌ SOURCE_CHAIN_RPC_URL not set');
    process.exit(1);
  }
  if (args.length > 10) {
    console.error('❌ Batch max 10 txs (MAX_BATCH_SIZE)');
    process.exit(1);
  }

  const txHashes: string[] = args;
  console.log(`\n🔗 chainKey=${chainKey} prover=${PROOF_BUILDER_URL}`);
  console.log(`📦 batch size=${txHashes.length}`);
  txHashes.forEach((h, i) => console.log(`  [${i}] ${h}`));

  const sourceProvider = new JsonRpcProvider(SOURCE_CHAIN_RPC_URL);
  const ccProvider = new JsonRpcProvider(CREDITCOIN_RPC_URL);
  const info = new chainInfo.PrecompileChainInfoProvider(ccProvider);
  const proofBuilder = new proofProvider.service.ProofBuilder(chainKey, PROOF_BUILDER_URL, 5000);

  // Validate heights and range
  const heights: number[] = [];
  for (const h of txHashes) {
    const tx = await sourceProvider.getTransaction(h);
    if (!tx?.blockNumber) throw new Error(`tx ${h} not found / not mined`);
    heights.push(tx.blockNumber);
  }
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  console.log(`\n📊 heights: ${heights.join(', ')} range=${maxH - minH} (must be <1000)`);
  if (maxH - minH > 1000) throw new Error('Batch range >1000 blocks — split into smaller batches');

  const latest = await info.getLatestAttestedHeightAndHash(chainKey);
  console.log(`📡 latest attested: ${latest.height} (need >= ${maxH})`);
  if (latest.height < maxH) {
    console.log(`⏳ Waiting for max height ${maxH} attestation...`);
  }
  await proofBuilder.waitUntilHeightAttested(chainKey, maxH, 15_000, 1_200_000);
  console.log('✅ Max height attested');

  console.log('⏳ Generating batch proof (one continuity proof shared)...');
  const batchResult = await proofBuilder.getBatchProof(txHashes);
  if (!batchResult.success || !batchResult.data) throw new Error(`Batch proof failed: ${batchResult.error}`);

  const batchData = batchResult.data!;
  console.log(`✅ Batch ready: chainKey=${batchData.chainKey} continuityLen=${batchData.continuityProof.roots.length} cached=${(batchData as any).cached ?? 'n/a'}`);

  // Flatten as SDK verifyBatch expects parallel arrays
  const headers: number[] = [];
  const txBytesArr: string[] = [];
  const merkleProofs: any[] = [];
  for (const [headerNumber, proofsMap] of batchData.merkleProofs.entries()) {
    for (const [, entry] of (proofsMap as Map<string, any>).entries()) {
      headers.push(headerNumber);
      txBytesArr.push(entry.txBytes);
      merkleProofs.push(entry.merkleProof);
    }
  }
  console.log(`   flattened: ${headers.length} proofs headers=[${headers.join(',')}]`);

  const estCTC = 2.3e-5 + 2.9e-7 * batchData.continuityProof.roots.length;
  console.log(`⛽ Est. batch verify cost (shared continuity): ~${estCTC.toExponential(2)} CTC (vs ${txHashes.length}x single)`);

  const prover = new blockProver.PrecompileBlockProver(ccProvider);
  console.log('⏳ View verifying batch via 0x0FD2...');
  const verified = await prover.verifyBatch(batchData.chainKey, headers, txBytesArr, merkleProofs, batchData.continuityProof);
  console.log(verified ? '✅ BATCH VERIFIED' : '❌ BATCH FAILED');

  console.log('');
}

main().catch((e) => {
  console.error('❌ Failed:', e.message ?? e);
  process.exit(1);
});
