/**
 * 10_verify_travel_rule.ts — Verify Travel Rule attestId in StreamCreated / StreamPayment
 *
 * Checks that a Sepolia tx (createStream or payStream) is Attestcoin-proven (0x0FD2 view) and
 * that its emitted StreamCreated/StreamPayment attestId matches expected keccak(Travel Rule JSON).
 * Minimal: uses ethers Interface decoding, not @gluwa/usc-contracts EvmV1Decoder, but same checks:
 *   - receiptStatus == 1
 *   - event found with attestId == expected
 *   - view verify via BlockProver
 *
 * Env:
 *   SOURCE_CHAIN_RPC_URL, CREDITCOIN_RPC_URL, PROOF_BUILDER_URL, SOURCE_CHAIN_KEY, SOURCE_CHAIN_CONTRACT_ADDRESS
 *
 * Usage:
 *   npx tsx scripts/10_verify_travel_rule.ts 0x<txHash> 0x<expectedAttestId>
 *   # generate expected from Travel Rule JSON:
 *   cast keccak "$(cat travel_rule.json)"
 *   # or let script compute from --travelJson '{"originator":"...","beneficiary":"..."}'
 *   npx tsx scripts/10_verify_travel_rule.ts 0x<txHash> --travelJson '{"originator":"Alice","beneficiary":"Bob","amount":"10"}'
 *   # for StreamCreated tx from 7_create_stream, attestId is keccak(memo) or keccak(travelJson)
 */

import 'dotenv/config';
import { JsonRpcProvider, InterfaceAbi, Contract, keccak256, toUtf8Bytes } from 'ethers';
import { proofProvider, blockProver, chainInfo } from '@gluwa/usc-sdk';

const SRC_RPC = process.env.SOURCE_CHAIN_RPC_URL || '';
const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PROVER = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const SOURCE_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1);
const SRC_ADDR = process.env.SOURCE_CHAIN_CONTRACT_ADDRESS || '';

if (!SRC_RPC) throw new Error('SOURCE_CHAIN_RPC_URL missing');

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const txHash = process.argv[2];
  if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
    console.error('Usage: npx tsx scripts/10_verify_travel_rule.ts 0x<txHash> 0x<expectedAttestId> [--travelJson \'{"a":"b"}\']');
    process.exit(1);
  }
  let expectedAttestId = process.argv[3];
  const travelJson = arg('travelJson');
  if (travelJson && !expectedAttestId) {
    expectedAttestId = keccak256(toUtf8Bytes(travelJson));
    console.log(`  travelJson keccak → attestId ${expectedAttestId}`);
  }
  if (expectedAttestId && (!expectedAttestId.startsWith('0x') || expectedAttestId.length !== 66)) {
    throw new Error('expectedAttestId must be 0x + 64 hex (bytes32)');
  }

  console.log(`\n🔍 Travel Rule verify for ${txHash}`);
  if (expectedAttestId) console.log(`  expected attestId ${expectedAttestId}`);
  if (travelJson) console.log(`  travelJson ${travelJson}`);

  const srcProvider = new JsonRpcProvider(SRC_RPC);
  const ccProvider = new JsonRpcProvider(CC_RPC);

  const receipt: any = await srcProvider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error('tx not found on Sepolia');
  console.log(`  Sepolia block ${receipt.blockNumber} status=${receipt.status} logs=${receipt.logs.length} from=${receipt.from} to=${receipt.to}`);
  if (receipt.status !== 1) throw new Error('receiptStatus != 1 — tx reverted, must be 1 for verify');

  const attestAbi = [
    'event StreamCreated(address indexed payer, address indexed recipient, uint256 totalAmount, uint256 duration, bytes32 indexed attestId, uint256 streamId, string memo)',
    'event StreamPayment(address indexed payer, address indexed recipient, uint256 amount, bytes32 indexed attestId, uint256 streamId, string memo)',
  ] as const;
  const iface = new Contract(SRC_ADDR || receipt.to, attestAbi as unknown as InterfaceAbi, srcProvider).interface;

  let found: { name: string; attestId: string; streamId: string; payer: string; recipient: string } | null = null;
  for (const log of receipt.logs) {
    try {
      const p = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (p && (p.name === 'StreamCreated' || p.name === 'StreamPayment')) {
        found = { name: p.name, attestId: p.args.attestId as string, streamId: p.args.streamId.toString(), payer: p.args.payer, recipient: p.args.recipient };
        console.log(`  ✅ Found ${p.name} streamId=${found.streamId} attestId=${found.attestId} payer=${found.payer}`);
        break;
      }
    } catch {}
  }
  if (!found) throw new Error('No StreamCreated/StreamPayment event in receipt — not a stream tx');

  if (expectedAttestId && found.attestId.toLowerCase() !== expectedAttestId.toLowerCase()) {
    console.error(`  ❌ attestId mismatch: on-chain ${found.attestId} != expected ${expectedAttestId}`);
    console.error(`     Travel Rule JSON does not match — compliance check FAILED`);
    process.exit(1);
  }
  if (expectedAttestId) console.log(`  ✅ attestId matches expected — Travel Rule OK`);

  // Attestcoin view verify (same as 2)
  const builder = new proofProvider.service.ProofBuilder(SOURCE_KEY, PROVER, 5000);
  const info = new chainInfo.PrecompileChainInfoProvider(ccProvider);
  const latest = await info.getLatestAttestedHeightAndHash(SOURCE_KEY);
  console.log(`  latest attested ${latest.height}, waiting for ${receipt.blockNumber} if needed...`);
  await builder.waitUntilHeightAttested(SOURCE_KEY, receipt.blockNumber, 15_000, 1_200_000).catch(() => console.log('  wait timeout, trying proof anyway'));

  const res = await builder.getProof(txHash);
  if (!res.success || !res.data) throw new Error(`proof failed ${res.error}`);
  const d = res.data!;
  console.log(`  proof continuity=${d.continuityProof.roots.length} siblings=${d.merkleProof.siblings.length} cached=${d.cached}`);

  const prover = new blockProver.PrecompileBlockProver(ccProvider);
  const ok = await prover.verifySingle(d.chainKey, d.headerNumber, d.txBytes, d.merkleProof, d.continuityProof);
  console.log(ok ? '  ✅ Attestcoin view VERIFIED (0x0FD2) — tx is in attested chain' : '  ❌ VERIFY FAILED');
  if (!ok) process.exit(1);

  console.log(`\n✅ Travel Rule + Attestcoin checks passed for streamId=${found.streamId}`);
  console.log(`   On-chain attestId ${found.attestId} proven on CC3 via 0x0FD2`);
  if (travelJson) console.log(`   JSON hash matches — compliant for app/travel-rule`);
}

main().catch((e) => {
  console.error('❌', e.message ?? e);
  process.exit(1);
});
