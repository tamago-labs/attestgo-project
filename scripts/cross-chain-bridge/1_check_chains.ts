/**
 * 1_check_chains.ts — Attestcoin smoke check (read-only, no gas, no private key)
 *
 * Queries Creditcoin CC3 Testnet for:
 *  - supported source chains (chainKey, chainId, encoding)
 *  - latest attested height per chain
 *  - prover cache height (if PROOF_BUILDER_URL set)
 *
 * Usage:
 *   npx tsx scripts/1_check_chains.ts
 *   CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network npx tsx scripts/1_check_chains.ts
 */
import 'dotenv/config';
import { JsonRpcProvider } from 'ethers';
import { chainInfo } from '@gluwa/usc-sdk';

const CREDITCOIN_RPC_URL = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PROOF_BUILDER_URL = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';

async function main() {
  console.log(`\n🔗 Creditcoin RPC: ${CREDITCOIN_RPC_URL}`);
  const ccProvider = new JsonRpcProvider(CREDITCOIN_RPC_URL);
  const info = new chainInfo.PrecompileChainInfoProvider(ccProvider);

  console.log('⏳ Fetching supported chains (precompile 0x0fd3)...');
  const chains = await info.getSupportedChains();
  if (!chains.length) {
    console.log('⚠️  No chains returned — check RPC / network');
    return;
  }

  console.log(`\n✅ Supported chains (${chains.length}):`);
  for (const c of chains) {
    // shape per docs: { chainKey, chainId, chainName, chainEncoding }
    console.log(`  - chainKey=${(c as any).chainKey} chainId=${(c as any).chainId} name=${(c as any).chainName ?? 'n/a'} encoding=${(c as any).chainEncoding}`);
  }

  console.log('\n⏳ Fetching latest attested heights...');
  for (const c of chains) {
    const chainKey = (c as any).chainKey as number;
    try {
      const latest = await info.getLatestAttestedHeightAndHash(chainKey);
      console.log(`  chainKey ${chainKey}: height=${latest.height} hash=${latest.hash ?? (latest as any).attestedHash ?? 'n/a'}`);
    } catch (e: any) {
      console.warn(`  chainKey ${chainKey}: failed — ${e.message ?? e}`);
    }
  }

  if (PROOF_BUILDER_URL) {
    console.log(`\n🔍 Prover cache: ${PROOF_BUILDER_URL} (optional, not queried here)`);
    console.log(`   Tip: open ${PROOF_BUILDER_URL.replace(/\/$/, '')}/swagger or /health if available`);
  }

  console.log('\nDone. Next: npx tsx scripts/2_verify_single_view.ts <sepolia_txHash>\n');
}

main().catch((e) => {
  console.error('❌ Failed:', e);
  process.exit(1);
});
