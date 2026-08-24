/**
 * 4_estimate_gas_table.ts — Gas cost scenarios (read-only, no RPC needed for table; optional RPC for live estimate)
 *
 * Prints docs.creditcoin.org/attestcoin-protocol/attestcoin-readability/gas-costs table
 * and optionally estimates gas for a real tx via CC RPC estimateGas.
 *
 * Formula: CTC ≈ 2.3e-5 + 2.9e-7 * continuityLen
 * For each continuity block: ~5000 gas fallback if estimate fails (see usc-testnet-bridge-examples/utils)
 *
 * Usage:
 *   npx tsx scripts/4_estimate_gas_table.ts
 *   npx tsx scripts/4_estimate_gas_table.ts 0x<txHash>  # also fetch real continuity len
 */
import 'dotenv/config';
import { JsonRpcProvider } from 'ethers';
import { proofProvider } from '@gluwa/usc-sdk';

const SOURCE_CHAIN_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1);
const SOURCE_CHAIN_RPC_URL = process.env.SOURCE_CHAIN_RPC_URL || '';
const PROOF_BUILDER_URL = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';

function ctcCost(continuityLen: number) {
  return 2.3e-5 + 2.9e-7 * continuityLen;
}
function gasFallback(continuityLen: number) {
  return 21000 + continuityLen * 5000 + 20000;
}

async function main() {
  console.log('\n⛽ Attestcoin Readability Gas Model (from docs)');
  console.log('   CTC ≈ 2.3e-5 + 2.9e-7 * continuityLen');
  console.log('   Gas fallback ≈ 21000 + continuityLen*5000 + 20000\n');

  const scenarios = [
    { label: 'Recent (10 blocks, ~10 min after finality)', len: 10 },
    { label: '1 hour old (~300 blocks)', len: 300 },
    { label: '24h old via checkpoint (1000 blocks)', len: 1000 },
    { label: '1 week old (checkpoint, 1000)', len: 1000 },
    { label: 'Max batch (10 txs share 1000)', len: 1000 },
  ];
  console.log('Scenario'.padEnd(44) + 'continuity  CTC (est)      gas fallback');
  console.log('-'.repeat(72));
  for (const s of scenarios) {
    console.log(s.label.padEnd(44) + String(s.len).padEnd(11) + ctcCost(s.len).toExponential(2).padEnd(15) + String(gasFallback(s.len)));
  }

  console.log('\nTakeaway: prove soon after attestation (10 vs 1000 = 10x cheaper). Batch amortizes continuity.');

  const txHash = process.argv[2];
  if (txHash && txHash.startsWith('0x') && txHash.length === 66) {
    if (!SOURCE_CHAIN_RPC_URL) {
      console.warn('\n⚠️  SOURCE_CHAIN_RPC_URL not set — skipping live fetch');
      return;
    }
    console.log(`\n🔍 Live check for ${txHash}...`);
    const builder = new proofProvider.service.ProofBuilder(SOURCE_CHAIN_KEY, PROOF_BUILDER_URL, 5000);
    const sourceProvider = new JsonRpcProvider(SOURCE_CHAIN_RPC_URL);
    const tx = await sourceProvider.getTransaction(txHash);
    if (!tx?.blockNumber) throw new Error('tx not mined');
    console.log(`   block ${tx.blockNumber}, waiting for attestation...`);
    await builder.waitUntilHeightAttested(SOURCE_CHAIN_KEY, tx.blockNumber, 15_000, 300_000).catch(() => {
      console.log('   wait timed out, trying proof anyway...');
    });
    const res = await builder.getProof(txHash);
    if (!res.success || !res.data) throw new Error(String(res.error));
    const len = res.data.continuityProof.roots.length;
    console.log(`   ✅ continuityLen=${len} siblings=${res.data.merkleProof.siblings.length} cached=${res.data.cached}`);
    console.log(`   → est CTC ${ctcCost(len).toExponential(2)} gas fallback ${gasFallback(len)}`);
  } else {
    console.log('\nTip: npx tsx scripts/4_estimate_gas_table.ts 0x<sepoliaTx>  for live continuityLen');
  }
  console.log('');
}

main().catch((e) => {
  console.error('❌', e.message ?? e);
  process.exit(1);
});
