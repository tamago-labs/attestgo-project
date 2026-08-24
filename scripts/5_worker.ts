/**
 * 5_worker.ts — AttestGO offchain readability worker (polls Sepolia -> proves -> submits to Creditcoin ASC)
 *
 * Adapted from usc-testnet-bridge-examples/bridge-offchain-worker/worker.ts
 * but self-contained in attestgo-project/scripts (no dependency on that repo's utils).
 *
 * Watches: SOURCE_CHAIN_CONTRACT_ADDRESS for StreamPayment or TokensBurnedForBridging
 * Submits: to USC_MINTER_CONTRACT_ADDRESS via USCBase.execute(action=0)
 * Flow: poll source blocks --(event)--> wait attested --(ProofBuilder)--> estimate gas --(execute)--> TokensMinted
 *
 * Env:
 *   SOURCE_CHAIN_RPC_URL, CREDITCOIN_RPC_URL, PROOF_BUILDER_URL, SOURCE_CHAIN_KEY
 *   SOURCE_CHAIN_CONTRACT_ADDRESS (or SOURCE_CHAIN_CUSTOM_CONTRACT_ADDRESS, or SOURCE contracts/AttestStream.sol address)
 *   USC_MINTER_CONTRACT_ADDRESS (or USC_CUSTOM_MINTER_CONTRACT_ADDRESS, or pre-deployed 0x2Be9...)
 *   CREDITCOIN_WALLET_PRIVATE_KEY (worker signer, pays CTC gas)
 *   WORKER_EVENT_NAME=StreamPayment | TokensBurnedForBridging (default: StreamPayment, falls back to TokensBurnedForBridging)
 *   POLL_INTERVAL_MS=5000
 *
 * Usage:
 *   npx tsx scripts/5_worker.ts
 *   # in another terminal, trigger: cast send ... "payStream(address,uint256,bytes32,uint256,string)" <recipient> 1000000000000000000 0x... 1 "salary"
 *   # or burn: cast send ... "burn(uint256)" 50000000000000000000 --private-key $KEY
 */

import 'dotenv/config';
import { Contract, JsonRpcProvider, EventLog, InterfaceAbi } from 'ethers';
import { proofProvider, chainInfo } from '@gluwa/usc-sdk';

// Minimal ABIs — only events we poll
const SOURCE_ABI = [
  'event StreamPayment(address indexed payer, address indexed recipient, uint256 amount, bytes32 indexed attestId, uint256 streamId, string memo)',
  'event TokensBurnedForBridging(address indexed from, uint256 value)',
] as const;

const MINTER_ABI = [
  'event TokensMinted(address indexed wrappedTokenAddress, address indexed burntFrom, uint256 amount, bytes32 indexed queryId)',
  'function execute(uint8 action, uint64 chainKey, uint64 blockHeight, bytes calldata encodedTransaction, bytes32 merkleRoot, tuple(bytes32 root, bool isLeft)[] siblings, bytes32 lowerEndpointDigest, bytes32[] continuityRoots) external returns (bool)',
] as const;

const SOURCE_CHAIN_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1);
const SOURCE_CHAIN_RPC_URL = process.env.SOURCE_CHAIN_RPC_URL || '';
const CREDITCOIN_RPC_URL = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PROOF_BUILDER_URL = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const SOURCE_ADDR =
  process.env.SOURCE_CHAIN_CONTRACT_ADDRESS ||
  process.env.SOURCE_CHAIN_CUSTOM_CONTRACT_ADDRESS ||
  process.env.SOURCE_CHAIN_STREAM_ADDRESS ||
  '';
const MINTER_ADDR = process.env.USC_MINTER_CONTRACT_ADDRESS || process.env.USC_CUSTOM_MINTER_CONTRACT_ADDRESS || '';
const PRIVATE_KEY = process.env.CREDITCOIN_WALLET_PRIVATE_KEY || '';
const EVENT_NAME = process.env.WORKER_EVENT_NAME || 'StreamPayment';
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);

const MAX_PROCESSED = 1000;

if (!SOURCE_CHAIN_RPC_URL) throw new Error('SOURCE_CHAIN_RPC_URL missing');
if (!CREDITCOIN_RPC_URL) throw new Error('CREDITCOIN_RPC_URL missing');
if (!SOURCE_ADDR) throw new Error('SOURCE_CHAIN_CONTRACT_ADDRESS missing (AttestStream or TestERC20 on Sepolia)');
if (!MINTER_ADDR) throw new Error('USC_MINTER_CONTRACT_ADDRESS missing (USCMinter on Creditcoin)');
if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith('0x')) throw new Error('CREDITCOIN_WALLET_PRIVATE_KEY missing (0x...)');

let shuttingDown = false;
process.on('SIGINT', () => {
  console.log('\nSIGINT — draining...');
  shuttingDown = true;
});
process.on('SIGTERM', () => {
  console.log('\nSIGTERM — draining...');
  shuttingDown = true;
});

async function generateProofFor(
  txHash: string,
  chainKey: number,
  proverUrl: string,
  ccProvider: JsonRpcProvider,
  srcProvider: JsonRpcProvider,
): Promise<proofProvider.ProofResult> {
  const tx = await srcProvider.getTransaction(txHash);
  if (!tx) throw new Error(`tx ${txHash} not found`);
  if (!tx.blockNumber) throw new Error(`tx ${txHash} not mined`);
  console.log(`  tx ${txHash} in block ${tx.blockNumber}`);
  const builder = new proofProvider.service.ProofBuilder(chainKey, proverUrl, 5000);
  const info = new chainInfo.PrecompileChainInfoProvider(ccProvider);
  const latest = await info.getLatestAttestedHeightAndHash(chainKey);
  console.log(`  latest attested ${latest.height}, waiting for ${tx.blockNumber}...`);
  await builder.waitUntilHeightAttested(chainKey, tx.blockNumber, 15_000, 1_200_000);
  console.log('  attested, generating proof...');
  return builder.getProof(txHash);
}

async function pollEvents(
  contract: Contract,
  eventName: string,
  fromBlock: number,
  handler: (e: EventLog) => Promise<void>,
): Promise<number> {
  try {
    const provider: any = contract.runner?.provider ?? (contract as any).provider;
    const current = await provider.getBlockNumber();
    if (!current || current < fromBlock) return fromBlock;
    const events = await contract.queryFilter(eventName, fromBlock, current);
    for (const ev of events) if (ev instanceof EventLog) await handler(ev as EventLog);
    return current + 1;
  } catch (e: any) {
    console.error(`  poll ${eventName} error:`, e.shortMessage ?? e.message);
    await new Promise((r) => setTimeout(r, 10_000));
    return fromBlock;
  }
}

async function main() {
  console.log('\n🤖 AttestGO Worker starting');
  console.log(`  source ${SOURCE_ADDR} -> event ${EVENT_NAME}`);
  console.log(`  minter ${MINTER_ADDR} on CC3 chainKey=${SOURCE_CHAIN_KEY}`);
  console.log(`  poll ${POLL_INTERVAL_MS}ms prover=${PROOF_BUILDER_URL}`);

  const srcProvider = new JsonRpcProvider(SOURCE_CHAIN_RPC_URL);
  const ccProvider = new JsonRpcProvider(CREDITCOIN_RPC_URL);
  const wallet = (await import('ethers')).Wallet ? new (await import('ethers')).Wallet(PRIVATE_KEY, ccProvider) : null;
  // ethers v6 Wallet
  const { Wallet } = await import('ethers');
  const w = new Wallet(PRIVATE_KEY, ccProvider);

  const sourceContract = new Contract(SOURCE_ADDR, SOURCE_ABI as unknown as InterfaceAbi, srcProvider);
  const minterContract = new Contract(MINTER_ADDR, MINTER_ABI as unknown as InterfaceAbi, w);

  let srcFrom = await srcProvider.getBlockNumber();
  let minterFrom = await ccProvider.getBlockNumber();
  console.log(`  from blocks: source=${srcFrom} minter=${minterFrom}`);

  const seen = new Set<string>();
  console.log(`  watching for ${EVENT_NAME}... (send payStream/burn on Sepolia to trigger)\n`);

  // Check event exists on source ABI, fallback
  let activeEvent = EVENT_NAME;
  try {
    sourceContract.interface.getEvent(activeEvent);
  } catch {
    console.warn(`  event ${activeEvent} not in ABI, falling back to TokensBurnedForBridging`);
    activeEvent = 'TokensBurnedForBridging';
  }

  while (!shuttingDown) {
    const [nextMinter, nextSrc] = await Promise.all([
      pollEvents(minterContract, 'TokensMinted', minterFrom, async (ev) => {
        const [wrapped, from, amount, queryId] = ev.args as any;
        console.log(`✅ TokensMinted wrapped=${wrapped} from=${from} amount=${amount.toString()} queryId=${queryId}`);
      }),
      pollEvents(sourceContract, activeEvent, srcFrom, async (ev) => {
        const txHash: string = ev.transactionHash;
        if (seen.has(txHash)) return;
        // filter: only our wallet's events if we can, else accept all
        seen.add(txHash);
        console.log(`\n📡 Detected ${activeEvent} tx=${txHash} block=${ev.blockNumber}`);
        if (activeEvent === 'StreamPayment') {
          const [payer, recipient, amount, attestId, streamId, memo] = ev.args as any;
          console.log(`   payer=${payer} recipient=${recipient} amount=${amount.toString()} attestId=${attestId} streamId=${streamId} memo=${memo}`);
        } else {
          const [from, value] = ev.args as any;
          console.log(`   from=${from} value=${value.toString()}`);
          if (from.toLowerCase() !== w.address.toLowerCase()) {
            console.log(`   (skip: from != worker wallet ${w.address})`);
            // still allow — comment out skip if you want to relay for any user
            // return;
          }
        }

        try {
          const proofRes = await generateProofFor(txHash, SOURCE_CHAIN_KEY, PROOF_BUILDER_URL, ccProvider, srcProvider);
          if (!proofRes.success || !proofRes.data) {
            console.error('  proof failed:', proofRes.error);
            return;
          }
          const d = proofRes.data!;
          console.log(`  proof ok continuity=${d.continuityProof.roots.length} siblings=${d.merkleProof.siblings.length} cached=${d.cached}`);

          // estimate gas with fallback
          const iface = minterContract.interface;
          const frag = iface.getFunction('execute(uint8,uint64,uint64,bytes,bytes32,tuple(bytes32,bool)[],bytes32,bytes32[])');
          const params = [0, d.chainKey, d.headerNumber, d.txBytes, d.merkleProof.root, d.merkleProof.siblings, d.continuityProof.lowerEndpointDigest, d.continuityProof.roots] as const;
          const data = iface.encodeFunctionData(frag!, params as any);
          let gasLimit: bigint;
          try {
            const est = await ccProvider.estimateGas({ to: MINTER_ADDR, data, from: w.address });
            gasLimit = (est * 135n) / 100n;
            console.log(`  gas est=${est} limit=${gasLimit}`);
          } catch (e: any) {
            const fallback = 21000 + d.continuityProof.roots.length * 5000 + 20000;
            console.warn(`  gas est failed (${e.shortMessage}), fallback ${fallback}`);
            gasLimit = BigInt(fallback);
          }

          const txResp = await (minterContract as any).execute(
            0,
            d.chainKey,
            d.headerNumber,
            d.txBytes,
            d.merkleProof.root,
            d.merkleProof.siblings,
            d.continuityProof.lowerEndpointDigest,
            d.continuityProof.roots,
            { gasLimit },
          );
          console.log(`  submitted ${txResp.hash}, waiting...`);
          const receipt = await txResp.wait();
          console.log(`  mined block ${receipt.blockNumber} status=${receipt.status}`);
        } catch (e: any) {
          console.error('  submit error:', e.shortMessage ?? e.message);
        }
      }),
    ]);

    minterFrom = nextMinter;
    srcFrom = nextSrc;
    if (seen.size > MAX_PROCESSED) {
      console.log(`  clearing seen cache (${seen.size})`);
      seen.clear();
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.log('Worker stopped.');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
