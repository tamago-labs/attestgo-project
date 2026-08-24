/**
 * 6_deploy_and_stream_demo.ts — Deploy AttestStream (Sepolia) + demo payStream (read/write)
 *
 * Deploys contracts/AttestStream.sol to Sepolia via ethers (no forge needed).
 * Optionally demonstrates a full AttestGO stream payment:
 *   1. deploy or reuse AttestStream on Sepolia
 *   2. mint + payStream(recipient, amount, attestId, streamId, memo)
 *   3. wait attested + generate proof (like 2_verify_single_view.ts)
 *   4. (optional --execute) submit to USCMinter on Creditcoin
 *
 * Env:
 *   SOURCE_CHAIN_RPC_URL, CREDITCOIN_RPC_URL, PROOF_BUILDER_URL, SOURCE_CHAIN_KEY
 *   CREDITCOIN_WALLET_PRIVATE_KEY (deployer + payer, must have Sepolia ETH + CTC)
 *   USC_MINTER_CONTRACT_ADDRESS (if --execute, e.g. 0x2Be9... pre-deployed)
 *   STREAM_RECIPIENT=0x... STREAM_AMOUNT=1000000000000000000 STREAM_MEMO="salary #1"
 *
 * Usage:
 *   npx tsx scripts/6_deploy_and_stream_demo.ts --deploy-only
 *   npx tsx scripts/6_deploy_and_stream_demo.ts --pay-only 0x<AttestStreamSepoliaAddr>
 *   npx tsx scripts/6_deploy_and_stream_demo.ts --execute 0x<AttestStreamSepoliaAddr>
 *   # auto: deploy + pay + prove (no execute):
 *   npx tsx scripts/6_deploy_and_stream_demo.ts
 */

import 'dotenv/config';
import { JsonRpcProvider, Wallet, ContractFactory, Contract, InterfaceAbi, keccak256, toUtf8Bytes, ethers } from 'ethers';
import { readFileSync } from 'fs';
import { proofProvider, chainInfo, blockProver } from '@gluwa/usc-sdk';

const SOURCE_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1);
const SRC_RPC = process.env.SOURCE_CHAIN_RPC_URL || '';
const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PROVER = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const PK = process.env.CREDITCOIN_WALLET_PRIVATE_KEY || '';
const MINTER_ADDR = process.env.USC_MINTER_CONTRACT_ADDRESS || process.env.USC_CUSTOM_MINTER_CONTRACT_ADDRESS || '0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f';
const RECIPIENT = process.env.STREAM_RECIPIENT || '';
const AMOUNT = process.env.STREAM_AMOUNT || '1000000000000000000'; // 1 ASTR (18 dec)
const MEMO = process.env.STREAM_MEMO || 'AttestGO stream #1 — pay as you go';

if (!SRC_RPC) throw new Error('SOURCE_CHAIN_RPC_URL missing (Sepolia)');
if (!PK) throw new Error('CREDITCOIN_WALLET_PRIVATE_KEY missing');

// Minimal compiled artifact fallback: we compile via ethers if foundry artifact not present
// Try load from usc-testnet-bridge-examples cache? Instead use inline bytecode from forge build if available
// For now we expect `yarn build` with hardhat/foundry not needed — we deploy via ContractFactory using ABI + bytecode
// Bytecode is not checked in; script will try to read cache/forge artifact, else print forge command.

async function getAttestStreamFactory(signer: Wallet): Promise<ContractFactory> {
  // Try foundry artifact
  const candidates = [
    'cache/AttestStream.json',
    'out/AttestStream.sol/AttestStream.json',
    'usc-testnet-bridge-examples/cache/AttestStream.json',
  ];
  for (const p of candidates) {
    try {
      const j = JSON.parse(readFileSync(p, 'utf8'));
      const abi = j.abi ?? j;
      const bytecode = j.bytecode ?? j.deployedBytecode;
      if (abi && bytecode) return new ContractFactory(abi as InterfaceAbi, bytecode, signer);
    } catch {}
  }
  // Fallback: instruct user
  console.error(`
❌ AttestStream artifact not found.

Run forge build for contracts/AttestStream.sol:

  forge build --contracts contracts --out out
  # or
  npx tsc --skipLibCheck # not needed
  # then re-run this script

Alternatively deploy manually:
  forge create --rpc-url $SOURCE_CHAIN_RPC_URL --private-key $CREDITCOIN_WALLET_PRIVATE_KEY contracts/AttestStream.sol:AttestStream --broadcast
`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  const deployOnly = args.includes('--deploy-only');
  const payOnlyAddr = args[args.indexOf('--pay-only') + 1] as string | undefined;
  const executeAddr = args[args.indexOf('--execute') + 1] as string | undefined;
  const doExecute = args.includes('--execute');

  const srcProvider = new JsonRpcProvider(SRC_RPC);
  const ccProvider = new JsonRpcProvider(CC_RPC);
  const wallet = new Wallet(PK, srcProvider);
  const ccWallet = wallet.connect(ccProvider);

  console.log(`\n🔗 Sepolia RPC: ${SRC_RPC.slice(0, 48)}...`);
  console.log(`🔗 Creditcoin RPC: ${CC_RPC}`);
  console.log(`👛 Deployer/payer: ${wallet.address}`);

  let streamAddr: string | undefined = payOnlyAddr || executeAddr;

  if (!streamAddr && !payOnlyAddr) {
    console.log('\n⏳ Deploying AttestStream.sol to Sepolia...');
    const factory = await getAttestStreamFactory(wallet);
    const contract = await factory.deploy();
    await contract.waitForDeployment();
    streamAddr = await contract.getAddress();
    console.log(`✅ Deployed AttestStream to ${streamAddr}`);
    console.log(`   Save: SOURCE_CHAIN_CONTRACT_ADDRESS=${streamAddr} in .env`);
  } else if (streamAddr) {
    console.log(`\n📦 Using existing AttestStream ${streamAddr}`);
  }

  if (deployOnly) {
    console.log('\n--deploy-only: stopping. Next:');
    console.log(`  npx tsx scripts/6_deploy_and_stream_demo.ts --pay-only ${streamAddr}`);
    return;
  }

  if (!streamAddr) throw new Error('no streamAddr');

  // Pay stream
  const streamAbi = [
    'function payStream(address recipient,uint256 amount,bytes32 attestId,uint256 streamId,string memo) external returns (bool)',
    'function burn(uint256) external',
    'event StreamPayment(address indexed payer, address indexed recipient, uint256 amount, bytes32 indexed attestId, uint256 streamId, string memo)',
  ] as const;
  const stream = new Contract(streamAddr, streamAbi as unknown as InterfaceAbi, wallet);

  const recipient = RECIPIENT || wallet.address;
  const attestId = keccak256(toUtf8Bytes(`attestgo:${Date.now()}:${Math.random()}`));
  const streamId = Math.floor(Date.now() / 1000) % 100000;

  console.log(`\n💸 payStream(recipient=${recipient}, amount=${AMOUNT}, attestId=${attestId}, streamId=${streamId}, memo="${MEMO}")`);
  const tx = await (stream as any).payStream(recipient, AMOUNT, attestId, streamId, MEMO);
  console.log(`  tx ${tx.hash} waiting...`);
  const receipt = await tx.wait();
  console.log(`  mined block ${receipt.blockNumber} status=${receipt.status}`);
  if (receipt.status !== 1) throw new Error('payStream reverted');

  // Prove
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

  const estCTC = 2.3e-5 + 2.9e-7 * d.continuityProof.roots.length;
  console.log(`  est CTC ${estCTC.toExponential(2)} (view verify next)`);

  const prover = new blockProver.PrecompileBlockProver(ccProvider);
  const ok = await prover.verifySingle(d.chainKey, d.headerNumber, d.txBytes, d.merkleProof, d.continuityProof);
  console.log(ok ? '  ✅ view VERIFIED (0x0FD2)' : '  ❌ view FAILED');

  if (doExecute) {
    console.log(`\n🚀 Submitting to minter ${MINTER_ADDR} (action=0)...`);
    const minterAbi = [
      'function execute(uint8 action,uint64 chainKey,uint64 blockHeight,bytes encodedTransaction,bytes32 merkleRoot,tuple(bytes32 root,bool isLeft)[] siblings,bytes32 lowerEndpointDigest,bytes32[] continuityRoots) external returns (bool)',
    ] as const;
    const minter = new Contract(MINTER_ADDR, minterAbi as unknown as InterfaceAbi, ccWallet);
    const iface = minter.interface;
    const frag = iface.getFunction('execute(uint8,uint64,uint64,bytes,bytes32,tuple(bytes32,bool)[],bytes32,bytes32[])');
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
    // parse TokensMinted
    for (const log of r.logs) {
      try {
        const parsed = minter.interface.parseLog({ topics: [...log.topics], data: log.data });
        if (parsed?.name === 'TokensMinted') console.log(`  ✅ TokensMinted`, parsed.args);
      } catch {}
    }
  } else {
    console.log('\nTip: add --execute to also submit to minter (needs CTC for gas).');
    console.log(`  npx tsx scripts/6_deploy_and_stream_demo.ts --execute ${streamAddr}`);
    console.log('Or let 5_worker.ts auto-submit: npx tsx scripts/5_worker.ts (set SOURCE_CHAIN_CONTRACT_ADDRESS=' + streamAddr + ')');
  }
  console.log('');
}

main().catch((e) => {
  console.error('❌', e.message ?? e);
  process.exit(1);
});
