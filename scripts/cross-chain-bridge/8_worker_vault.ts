/**
 * 8_worker_vault.ts — Option B worker for StreamCreated → StreamVault vest
 *
 * Keep 5_worker for payStream → wASTR mint (send tokens).
 * This vault worker watches AttestStream.StreamCreated on Sepolia and
 * after Attestcoin view verify, mints wASTR to vault and registers stream for linear vest.
 *
 * Flow: Sepolia createStream(total,duration) → StreamCreated → wait attested → ProofBuilder → view verify 0x0FD2 → wASTR.mint(vault,total) → vault.onStreamProvenAsOwner
 * Recipient then withdraws via vault.withdraw(streamId) over time (app/payment-streams).
 *
 * Env:
 *   SOURCE_CHAIN_RPC_URL, CREDITCOIN_RPC_URL, PROOF_BUILDER_URL, SOURCE_CHAIN_KEY
 *   SOURCE_CHAIN_CONTRACT_ADDRESS (new AttestStream with createStream)
 *   STREAM_VAULT_ADDRESS (from 5-DeployStreamVault), WRAPPED_ASTR_ADDRESS (wASTR)
 *   CREDITCOIN_WALLET_PRIVATE_KEY (must be owner of wASTR + vault, e.g. 0xB045...)
 *   POLL_INTERVAL_MS=5000
 *
 * Usage:
 *   npx tsx scripts/8_worker_vault.ts
 *   # in other terminal:
 *   npx tsx scripts/7_create_stream.ts --recipient 0x... --total 10000000000000000000 --duration 3600
 */

import 'dotenv/config';
import { Contract, JsonRpcProvider, EventLog, InterfaceAbi } from 'ethers';
import { proofProvider, chainInfo, blockProver } from '@gluwa/usc-sdk';

const SOURCE_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1);
const SRC_RPC = process.env.SOURCE_CHAIN_RPC_URL || '';
const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PROVER = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const SRC_ADDR = process.env.SOURCE_CHAIN_CONTRACT_ADDRESS || '';
const VAULT_ADDR = process.env.STREAM_VAULT_ADDRESS || '';
const WASTR_ADDR = process.env.WRAPPED_ASTR_ADDRESS || process.env.WRAPPED_ASTR || process.env.USC_MINTABLE_TOKEN || '';
const PK = process.env.CREDITCOIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);

if (!SRC_RPC) throw new Error('SOURCE_CHAIN_RPC_URL missing');
if (!SRC_ADDR) throw new Error('SOURCE_CHAIN_CONTRACT_ADDRESS missing (new AttestStream with createStream)');
if (!VAULT_ADDR) throw new Error('STREAM_VAULT_ADDRESS missing (deploy 5-DeployStreamVault first)');
if (!WASTR_ADDR) throw new Error('WRAPPED_ASTR_ADDRESS missing');
if (!PK) throw new Error('PRIVATE_KEY missing');

const SRC_ABI = [
  'event StreamCreated(address indexed payer, address indexed recipient, uint256 totalAmount, uint256 duration, bytes32 indexed attestId, uint256 streamId, string memo)',
] as const;

const VAULT_ABI = [
  'function onStreamProvenAsOwner(uint256 streamId, address payer, address recipient, uint256 total, uint256 duration, bytes32 attestId, address token) external',
  'function vested(uint256) view returns (uint256)',
  'function withdrawable(uint256) view returns (uint256)',
  'function streams(uint256) view returns (address payer, address recipient, address token, uint256 total, uint256 duration, uint256 start, uint256 withdrawn, bytes32 attestId, bool exists)',
] as const;

const WASTR_ABI = [
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address) view returns (uint256)',
] as const;

let shuttingDown = false;
process.on('SIGINT', () => (shuttingDown = true));
process.on('SIGTERM', () => (shuttingDown = true));

async function generateProof(txHash: string, chainKey: number, proverUrl: string, ccProvider: JsonRpcProvider, srcProvider: JsonRpcProvider) {
  const tx = await srcProvider.getTransaction(txHash);
  if (!tx?.blockNumber) throw new Error(`tx ${txHash} not mined`);
  console.log(`  tx ${txHash} block ${tx.blockNumber}`);
  const builder = new proofProvider.service.ProofBuilder(chainKey, proverUrl, 5000);
  const info = new chainInfo.PrecompileChainInfoProvider(ccProvider);
  const latest = await info.getLatestAttestedHeightAndHash(chainKey);
  console.log(`  latest attested ${latest.height}, waiting for ${tx.blockNumber}...`);
  await builder.waitUntilHeightAttested(chainKey, tx.blockNumber, 15_000, 1_200_000);
  console.log('  attested, generating proof...');
  return builder.getProof(txHash);
}

async function pollEvents(contract: Contract, eventName: string, fromBlock: number, handler: (e: EventLog) => Promise<void>): Promise<number> {
  try {
    const provider: any = contract.runner?.provider;
    const current = await provider.getBlockNumber();
    if (!current || current < fromBlock) return fromBlock;
    const events = await contract.queryFilter(eventName, fromBlock, current);
    for (const ev of events) if (ev instanceof EventLog) await handler(ev);
    return current + 1;
  } catch (e: any) {
    console.error(`  poll ${eventName} error:`, e.shortMessage ?? e.message);
    await new Promise((r) => setTimeout(r, 10_000));
    return fromBlock;
  }
}

async function main() {
  console.log('\n🏦 Vault Worker (Option B) starting');
  console.log(`  source ${SRC_ADDR} -> StreamCreated`);
  console.log(`  vault ${VAULT_ADDR} wASTR ${WASTR_ADDR} chainKey=${SOURCE_KEY}`);

  const srcProvider = new JsonRpcProvider(SRC_RPC);
  const ccProvider = new JsonRpcProvider(CC_RPC);
  const { Wallet } = await import('ethers');
  const wallet = new Wallet(PK, ccProvider);

  const srcContract = new Contract(SRC_ADDR, SRC_ABI as unknown as InterfaceAbi, srcProvider);
  const vaultContract = new Contract(VAULT_ADDR, VAULT_ABI as unknown as InterfaceAbi, wallet);
  const wastrContract = new Contract(WASTR_ADDR, WASTR_ABI as unknown as InterfaceAbi, wallet);

  let srcFrom = await srcProvider.getBlockNumber();
  console.log(`  from source block ${srcFrom}, watching StreamCreated...`);

  const seen = new Set<string>();

  while (!shuttingDown) {
    srcFrom = await pollEvents(srcContract, 'StreamCreated', srcFrom, async (ev) => {
      const txHash: string = ev.transactionHash;
      if (seen.has(txHash)) return;
      seen.add(txHash);
      const [payer, recipient, totalAmount, duration, attestId, streamId, memo] = ev.args as any;
      console.log(`\n📡 StreamCreated tx=${txHash} block=${ev.blockNumber}`);
      console.log(`   payer=${payer} recipient=${recipient} total=${totalAmount.toString()} duration=${duration.toString()} attestId=${attestId} streamId=${streamId.toString()} memo=${memo}`);

      try {
        const proofRes = await generateProof(txHash, SOURCE_KEY, PROVER, ccProvider, srcProvider);
        if (!proofRes.success || !proofRes.data) {
          console.error('  proof failed', proofRes.error);
          return;
        }
        const d = proofRes.data!;
        console.log(`  proof ok continuity=${d.continuityProof.roots.length} siblings=${d.merkleProof.siblings.length} cached=${d.cached}`);

        const prover = new blockProver.PrecompileBlockProver(ccProvider);
        const ok = await prover.verifySingle(d.chainKey, d.headerNumber, d.txBytes, d.merkleProof, d.continuityProof);
        console.log(ok ? '  ✅ view VERIFIED (0x0FD2)' : '  ❌ view FAILED');
        if (!ok) return;

        // Mint wASTR total to vault (worker is owner of wASTR, e.g. 0xB045)
        const vaultBalBefore = await (wastrContract as any).balanceOf(VAULT_ADDR);
        console.log(`  vault wASTR before ${vaultBalBefore.toString()}`);
        const mintTx = await (wastrContract as any).mint(VAULT_ADDR, totalAmount);
        console.log(`  mint wASTR ${totalAmount.toString()} to vault tx ${mintTx.hash}...`);
        await mintTx.wait();
        console.log('  minted');

        // Register stream in vault for vesting
        const regTx = await (vaultContract as any).onStreamProvenAsOwner(streamId, payer, recipient, totalAmount, duration, attestId, WASTR_ADDR);
        console.log(`  vault.onStreamProvenAsOwner tx ${regTx.hash}...`);
        await regTx.wait();
        console.log(`  ✅ Stream ${streamId.toString()} registered — recipient can withdraw over ${duration.toString()}s`);
        console.log(`     cast call --rpc-url $CREDITCOIN_RPC_URL ${VAULT_ADDR} "withdrawable(uint256)(uint256)" ${streamId.toString()}`);
      } catch (e: any) {
        console.error('  vault worker error', e.shortMessage ?? e.message);
      }
    });

    if (seen.size > 1000) seen.clear();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.log('Vault worker stopped');
}

main().catch((e) => {
  console.error('Fatal', e);
  process.exit(1);
});
