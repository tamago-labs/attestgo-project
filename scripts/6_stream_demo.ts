/**
 * 6_stream_demo.ts — AttestGO stream payment demo (uses deployed AttestStream on Sepolia)
 *
 * Assumes AttestStream already deployed via forge:
 *   forge script script/3-DeployAttestStream.s.sol --rpc-url $SOURCE_CHAIN_RPC_URL --broadcast --legacy
 *   Deployed 0x052B3eAC16D43EF792589aae41BaD2205c6CC21C tx 0x53147...
 *
 * Flow:
 *   1. payStream(recipient, amount, attestId, streamId, memo) on Sepolia
 *   2. wait attested + generate proof (like 2_verify_single_view.ts)
 *   3. view verify via 0x0FD2
 *   4. --execute: submit to USCMinter 0x2Be9... on Creditcoin
 *
 * Env:
 *   SOURCE_CHAIN_RPC_URL, CREDITCOIN_RPC_URL, PROOF_BUILDER_URL, SOURCE_CHAIN_KEY
 *   SOURCE_CHAIN_CONTRACT_ADDRESS (0x052B...), CREDITCOIN_WALLET_PRIVATE_KEY
 *   USC_MINTER_CONTRACT_ADDRESS (if --execute), STREAM_RECIPIENT, STREAM_AMOUNT, STREAM_MEMO
 *
 * Usage:
 *   npx tsx scripts/6_stream_demo.ts
 *   npx tsx scripts/6_stream_demo.ts --execute
 *   npx tsx scripts/6_stream_demo.ts --execute 0x052B3eAC16D43EF792589aae41BaD2205c6CC21C
 *   STREAM_RECIPIENT=0x... STREAM_AMOUNT=1000000000000000000 npx tsx scripts/6_stream_demo.ts --execute
 */

import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, InterfaceAbi, keccak256, toUtf8Bytes } from 'ethers';
import { proofProvider, chainInfo, blockProver } from '@gluwa/usc-sdk';

const SOURCE_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1);
const SRC_RPC = process.env.SOURCE_CHAIN_RPC_URL || '';
const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PROVER = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const PK = process.env.CREDITCOIN_WALLET_PRIVATE_KEY || '';
const STREAM_ADDR =
  process.env.SOURCE_CHAIN_CONTRACT_ADDRESS ||
  process.env.SOURCE_CHAIN_CUSTOM_CONTRACT_ADDRESS ||
  '0x052B3eAC16D43EF792589aae41BaD2205c6CC21C';
const MINTER_ADDR =
  process.env.USC_MINTER_CONTRACT_ADDRESS || process.env.USC_CUSTOM_MINTER_CONTRACT_ADDRESS || '0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f';
const RECIPIENT = process.env.STREAM_RECIPIENT || '';
const AMOUNT = process.env.STREAM_AMOUNT || '1000000000000000000';
const MEMO = process.env.STREAM_MEMO || 'AttestGO stream demo — pay as you go';

if (!SRC_RPC) throw new Error('SOURCE_CHAIN_RPC_URL missing (Sepolia)');
if (!PK) throw new Error('CREDITCOIN_WALLET_PRIVATE_KEY missing');
if (!STREAM_ADDR || !STREAM_ADDR.startsWith('0x')) throw new Error('SOURCE_CHAIN_CONTRACT_ADDRESS missing (0x052B...)');

async function main() {
  const args = process.argv.slice(2);
  const doExecute = args.includes('--execute');
  const overrideAddr = args[args.indexOf('--execute') + 1] as string | undefined;
  const streamAddr = overrideAddr && overrideAddr.startsWith('0x') ? overrideAddr : STREAM_ADDR;

  const srcProvider = new JsonRpcProvider(SRC_RPC);
  const ccProvider = new JsonRpcProvider(CC_RPC);
  const wallet = new Wallet(PK, srcProvider);
  const ccWallet = wallet.connect(ccProvider);

  console.log(`\n🔗 Sepolia: ${SRC_RPC.slice(0, 48)}...`);
  console.log(`🔗 Creditcoin: ${CC_RPC}`);
  console.log(`📦 AttestStream: ${streamAddr} (deployed 0x53147...)`);
  console.log(`👛 Payer: ${wallet.address}`);

  const streamAbi = [
    'function payStream(address recipient,uint256 amount,bytes32 attestId,uint256 streamId,string memo) external returns (bool)',
    'function balanceOf(address) view returns (uint256)',
    'event StreamPayment(address indexed payer, address indexed recipient, uint256 amount, bytes32 indexed attestId, uint256 streamId, string memo)',
  ] as const;
  const stream = new Contract(streamAddr, streamAbi as unknown as InterfaceAbi, wallet);

  const bal = await (stream as any).balanceOf(wallet.address);
  console.log(`💰 ASTR balance: ${bal.toString()} ${bal === 0n ? '⚠️  mint first: cast send ... "mint(uint256)" 1000000000000000000000' : ''}`);

  const recipient = RECIPIENT || wallet.address;
  const attestId = keccak256(toUtf8Bytes(`attestgo:demo:${Date.now()}:${Math.random()}`));
  const streamId = Math.floor(Date.now() / 1000) % 100000;

  console.log(`\n💸 payStream(recipient=${recipient}, amount=${AMOUNT}, attestId=${attestId}, streamId=${streamId}, memo="${MEMO}")`);
  const tx = await (stream as any).payStream(recipient, AMOUNT, attestId, streamId, MEMO);
  console.log(`  tx ${tx.hash} waiting...`);
  const receipt = await tx.wait();
  console.log(`  mined block ${receipt.blockNumber} status=${receipt.status}`);
  if (receipt.status !== 1) throw new Error('payStream reverted');

  const txHash: string = tx.hash;
  console.log(`\n⏳ Proving ${txHash} (block ${receipt.blockNumber})...`);
  const builder = new proofProvider.service.ProofBuilder(SOURCE_KEY, PROVER, 5000);
  const info = new chainInfo.PrecompileChainInfoProvider(ccProvider);
  const latest = await info.getLatestAttestedHeightAndHash(SOURCE_KEY);
  console.log(`  latest attested ${latest.height}, waiting for ${receipt.blockNumber}...`);
  await builder.waitUntilHeightAttested(SOURCE_KEY, receipt.blockNumber, 15_000, 1_200_000);
  console.log('  attested, fetching proof...');
  const res = await builder.getProof(txHash);
  if (!res.success || !res.data) throw new Error(String(res.error));
  const d = res.data!;
  console.log(`  ✅ proof continuity=${d.continuityProof.roots.length} siblings=${d.merkleProof.siblings.length} cached=${d.cached}`);
  console.log(`  est CTC ${(2.3e-5 + 2.9e-7 * d.continuityProof.roots.length).toExponential(2)}`);

  const prover = new blockProver.PrecompileBlockProver(ccProvider);
  const ok = await prover.verifySingle(d.chainKey, d.headerNumber, d.txBytes, d.merkleProof, d.continuityProof);
  console.log(ok ? '  ✅ view VERIFIED (0x0FD2)' : '  ❌ view FAILED');

  if (doExecute) {
    console.log(`\n🚀 Submitting to minter ${MINTER_ADDR} (action=0)...`);
    const minterAbi = [
      'function execute(uint8 action,uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,tuple(bytes32 hash, bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots) external returns (bool)',
    ] as const;
    const minter = new Contract(MINTER_ADDR, minterAbi as unknown as InterfaceAbi, ccWallet);
    const iface = minter.interface;
    const frag = iface.getFunction('execute(uint8,uint64,uint64,bytes,bytes32,tuple(bytes32 hash, bool isLeft)[],bytes32,bytes32[])');
    const data = iface.encodeFunctionData(frag!, [0, d.chainKey, d.headerNumber, d.txBytes, d.merkleProof.root, d.merkleProof.siblings, d.continuityProof.lowerEndpointDigest, d.continuityProof.roots]);
    let gasLimit: bigint;
    try {
      const est = await ccProvider.estimateGas({ to: MINTER_ADDR, data, from: ccWallet.address });
      gasLimit = (est * 135n) / 100n;
      console.log(`  gas est=${est} limit=${gasLimit}`);
    } catch (e: any) {
      const fallback = 21000 + d.continuityProof.roots.length * 5000 + 20000;
      console.warn(`  gas est failed ${e.shortMessage}, fallback ${fallback}`);
      gasLimit = BigInt(fallback);
    }
    const resp = await (minter as any).execute(0, d.chainKey, d.headerNumber, d.txBytes, d.merkleProof.root, d.merkleProof.siblings, d.continuityProof.lowerEndpointDigest, d.continuityProof.roots, { gasLimit });
    console.log(`  submitted ${resp.hash} waiting...`);
    const r = await resp.wait();
    console.log(`  mined ${r.blockNumber} status=${r.status}`);
    for (const log of r.logs) {
      try {
        const parsed = minter.interface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'TokensMinted') console.log(`  ✅ TokensMinted`, parsed.args);
      } catch {}
    }
  } else {
    console.log('\nTip: add --execute to also submit to minter (needs CTC).');
    console.log(`  npx tsx scripts/6_stream_demo.ts --execute`);
    console.log(`  Or auto-relay: npx tsx scripts/5_worker.ts`);
  }
  console.log('');
}

main().catch((e) => {
  console.error('❌', e.message ?? e);
  process.exit(1);
});
