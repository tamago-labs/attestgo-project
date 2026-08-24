/**
 * 2_verify_single_view.ts — Generate + verify a single tx proof (read-only, no signing)
 *
 * End-to-end readability dry run using hosted ProofBuilder + on-chain view verify.
 * Does NOT submit a tx — only calls PrecompileBlockProver.verifySingle (view).
 *
 * Prereqs: SOURCE_CHAIN_RPC_URL (Sepolia Infura/Alchemy), CREDITCOIN_RPC_URL, PROOF_BUILDER_URL
 * Cost: ~2.3e-5 CTC + 2.9e-7 * continuityLen (view call = no gas unless you submit)
 *
 * Usage:
 *   npx tsx scripts/2_verify_single_view.ts 0x<txHash>
 *   # tx must be mined on Sepolia and burn/mint-like; hello-bridge burn tx works:
 *   # cast send --rpc-url $SOURCE_CHAIN_RPC_URL $SOURCE_CHAIN_CONTRACT_ADDRESS "burn(uint256)" 50000000000000000000 --private-key $KEY
 */
import 'dotenv/config';
import { JsonRpcProvider } from 'ethers';
import { chainInfo, blockProver, proofProvider } from '@gluwa/usc-sdk';

const SOURCE_CHAIN_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1); // 1 = Sepolia on CC3 Testnet
const SOURCE_CHAIN_RPC_URL = process.env.SOURCE_CHAIN_RPC_URL || '';
const CREDITCOIN_RPC_URL = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PROOF_BUILDER_URL = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';

function usageAndExit() {
  console.error(`
Usage:
  npx tsx scripts/2_verify_single_view.ts <Transaction_Hash>

Env (.env):
  SOURCE_CHAIN_KEY=1
  SOURCE_CHAIN_RPC_URL=https://sepolia.infura.io/v3/<key>
  CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
  PROOF_BUILDER_URL=https://prover.cc3-testnet.creditcoin.network

Example:
  npx tsx scripts/2_verify_single_view.ts 0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1
`);
  process.exit(1);
}

async function main() {
  const [txHash] = process.argv.slice(2);
  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) usageAndExit();

  if (!SOURCE_CHAIN_RPC_URL) {
    console.error('❌ SOURCE_CHAIN_RPC_URL not set — add Sepolia RPC to .env (e.g. https://sepolia.infura.io/v3/<key>)');
    process.exit(1);
  }

  console.log(`\n🔗 Source RPC: ${SOURCE_CHAIN_RPC_URL.slice(0, 48)}...`);
  console.log(`🔗 Creditcoin RPC: ${CREDITCOIN_RPC_URL}`);
  console.log(`🔗 Prover: ${PROOF_BUILDER_URL}`);
  console.log(`🔑 chainKey: ${SOURCE_CHAIN_KEY} (1=Sepolia on CC3 Testnet, 3=Ethereum Mainnet on testnet)`);
  console.log(`📦 txHash: ${txHash}\n`);

  const sourceProvider = new JsonRpcProvider(SOURCE_CHAIN_RPC_URL);
  const ccProvider = new JsonRpcProvider(CREDITCOIN_RPC_URL);

  // 1. locate tx + block
  const tx = await sourceProvider.getTransaction(txHash);
  if (!tx) throw new Error(`Transaction ${txHash} not found on source chain — wrong RPC or tx not mined yet`);
  const blockNumber = tx.blockNumber;
  if (!blockNumber) throw new Error(`Transaction ${txHash} not yet mined (no blockNumber)`);

  console.log(`✅ Found in block ${blockNumber} (from=${tx.from} to=${tx.to})`);

  // 2. wait for attestation (cached in prover, not direct on-chain polling to avoid timing race)
  const proofBuilder = new proofProvider.service.ProofBuilder(SOURCE_CHAIN_KEY, PROOF_BUILDER_URL, 5000);
  const info = new chainInfo.PrecompileChainInfoProvider(ccProvider);

  const latest = await info.getLatestAttestedHeightAndHash(SOURCE_CHAIN_KEY);
  console.log(`📡 Latest attested height for chainKey ${SOURCE_CHAIN_KEY}: ${latest.height}`);
  if (latest.height < blockNumber) {
    console.log(`⏳ Block ${blockNumber} not yet attested (lag ~ ${blockNumber - latest.height} blocks, ~8-10 min for Sepolia). Waiting...`);
    console.log(`   Polling prover every 15s, timeout 20m...`);
  }
  await proofBuilder.waitUntilHeightAttested(SOURCE_CHAIN_KEY, blockNumber, 15_000, 1_200_000);
  console.log(`✅ Block ${blockNumber} attested (in prover cache)`);

  // 3. generate proofs via hosted service
  console.log('⏳ Generating Merkle + continuity proofs...');
  const result = await proofBuilder.getProof(txHash);
  if (!result.success || !result.data) throw new Error(`Proof generation failed: ${result.error}`);

  const { chainKey, headerNumber, txBytes, merkleProof, continuityProof, cached } = result.data!;
  console.log(`✅ Proofs ready (header=${headerNumber} cached=${cached} continuityLen=${continuityProof.roots.length} siblings=${merkleProof.siblings.length})`);

  // gas hint per docs: CTC ≈ 2.3e-5 + 2.9e-7 * continuityLen
  const estCTC = 2.3e-5 + 2.9e-7 * continuityProof.roots.length;
  console.log(`⛽ Est. verify cost if submitted: ~${estCTC.toExponential(2)} CTC (continuity=${continuityProof.roots.length})`);

  // 4. view-verify on-chain (no signing, no gas)
  const prover = new blockProver.PrecompileBlockProver(ccProvider);
  console.log('⏳ Verifying via BlockProver precompile 0x0FD2 (view)...');
  const verified = await prover.verifySingle(chainKey, headerNumber, txBytes, merkleProof, continuityProof);
  console.log(verified ? '✅ VERIFIED — tx is included in attested chain' : '❌ FAILED — precompile rejected');

  if (verified) {
    console.log('\nTip: now run a *write* check with a funded key:');
    console.log('  npx tsx usc-testnet-bridge-examples/hello-bridge/submit_query.ts <same txHash>');
    console.log('  -> submits proof to USCMinter 0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f and mints BTKT');
  }
  console.log('');
}

main().catch((e) => {
  console.error('\n❌ Failed:', e.message ?? e);
  if ((e as any).stack) console.error((e as any).stack);
  process.exit(1);
});
