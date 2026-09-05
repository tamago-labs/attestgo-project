/**
 * probe_proof.ts — diagnostic: dump ProofBuilder txBytes structure for txs and try
 * candidate encodedTransaction formats against the 0x0FD2 precompile off-chain (free staticCall).
 * Usage: npx tsx scripts/lending/probe_proof.ts [lockTxHash] [mintTxHash]
 * Env: SEPOLIA_RPC_URL, PROOF_BUILDER_URL (optional; CREDITCOIN_RPC_URL)
 */
import 'dotenv/config';
import { JsonRpcProvider } from 'ethers';
import { proofProvider, blockProver } from '@gluwa/usc-sdk';

const CHAIN_KEY = 1;
const URL = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const CC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const MINT = '0xa14ac9fcd71792977f953877111598359c33e277c542c99480bee4747b50e380'; // known-working GOPass sync tx
const LOCK = process.argv[2] || '0xda2c9a9a291a26b572ae735eb126107c40e61c2ef3dbd255678827e58d72d586';

const sepolia = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL || '');
const cc = new JsonRpcProvider(CC);
const builder = new proofProvider.service.ProofBuilder(CHAIN_KEY, URL, 5000);

type Head = { byte0: number; kind: string; len: number; prefix: number };
function parseHead(hexNo0x: string): Head {
  const byte0 = parseInt(hexNo0x.slice(0, 2), 16);
  if (byte0 < 0x80) return { byte0, kind: 'scalar', len: 1, prefix: 0 };
  if (byte0 < 0xb8) return { byte0, kind: 'string', len: byte0 - 0x80, prefix: 1 };
  if (byte0 < 0xc0) { const lol = byte0 - 0xb7; return { byte0, kind: 'string-long', len: parseInt(hexNo0x.slice(2, 2 + 2 * lol), 16), prefix: 1 + lol }; }
  if (byte0 < 0xf8) return { byte0, kind: 'list', len: byte0 - 0xc0, prefix: 1 };
  const lol = byte0 - 0xf7; return { byte0, kind: 'list-long', len: parseInt(hexNo0x.slice(2, 2 + 2 * lol), 16), prefix: 1 + lol };
}
function describe(name: string, hx: string) {
  const b = hx.replace(/^0x/, '');
  console.log(`--- ${name}: bytes=${b.length / 2} head=0x${b.slice(0, 18)}`);
  const outer = parseHead(b);
  console.log(`    outer: kind=${outer.kind} payloadLen=${outer.len} prefix=${outer.prefix}`);
  if (outer.kind.startsWith('list')) {
    let ptr = outer.prefix; let i = 0;
    while (i < 4 && ptr < b.length) {
      const sub = parseHead(b.slice(ptr));
      console.log(`    elem[${i}]: kind=${sub.kind} payloadLen=${sub.len} head=0x${b.slice(ptr, ptr + 18)}`);
      ptr += sub.prefix + sub.len; i++;
    }
  }
}

async function rawTypedTx(txHash: string): Promise<string> {
  const rawTx: any = await sepolia.send('eth_getTransactionByHash', [txHash]);
  const clean: any = {
    type: typeof rawTx.type === 'string' ? parseInt(rawTx.type, 16) : rawTx.type,
    chainId: typeof rawTx.chainId === 'string' ? parseInt(rawTx.chainId, 16) : rawTx.chainId,
    nonce: rawTx.nonce, gasLimit: rawTx.gas ?? rawTx.gasLimit,
    maxFeePerGas: rawTx.maxFeePerGas, maxPriorityFeePerGas: rawTx.maxPriorityFeePerGas,
    to: rawTx.to, value: rawTx.value, data: rawTx.input ?? rawTx.data,
    accessList: rawTx.accessList ?? [],
    signature: { r: rawTx.r, s: rawTx.s, yParity: rawTx.yParity ?? (rawTx.v === '0x01' ? 1 : 0) },
  };
  const { Transaction } = await import('ethers');
  return Transaction.from(clean).serialized;
}

async function plainReceiptRlp(txHash: string): Promise<string> {
  const receipt: any = await sepolia.send('eth_getTransactionReceipt', [txHash]);
  const { encodeRlp } = await import('ethers');
  const logs = (receipt.logs as any[]).map((l: any) => [l.address, l.topics, l.data]);
  return encodeRlp(['0x01', receipt.cumulativeGasUsed, receipt.logsBloom, logs]);
}

async function main() {
  const proofs: Record<string, any> = {};
  for (const [name, tx] of [['mint', MINT], ['lock', LOCK]] as const) {
    const t: any = await sepolia.send('eth_getTransactionByHash', [tx]);
    console.log(`\n===== ${name} tx ${tx}`);
    console.log(`    rpc type=${t?.type} to=${t?.to} block=${parseInt(t?.blockNumber ?? '0x0', 16)}`);
    const res = await builder.getProof(tx);
    if (!res.success || !res.data) { console.log(`    getProof failed: ${res.error}`); continue; }
    const d: any = res.data;
    proofs[name] = d;
    console.log(`    proof header=${d.headerNumber} siblings=${d.merkleProof?.siblings?.length} roots=${d.continuityProof?.roots?.length} cached=${d.cached}`);
    describe(`SDK d.txBytes`, String(d.txBytes ?? ''));
    for (const k of Object.keys(d)) {
      const v = (d as any)[k];
      if (typeof v === 'string' && v.startsWith('0x') && v.length > 100 && k !== 'txBytes') console.log(`    extra field ${k}: len=${v.length / 2 - 1} head=${v.slice(0, 18)}`);
    }
  }

  // Try candidates against the precompile off-chain for the lock tx
  const d = proofs['lock'];
  if (!d) return;
  const prover = new blockProver.PrecompileBlockProver(cc);
  const txRlp = await rawTypedTx(LOCK);
  const rlpR = await plainReceiptRlp(LOCK);
  const { encodeRlp, keccak256 } = await import('ethers');
  const typedReceipt = '0x02' + rlpR.slice(2);
  const cands: Record<string, string> = {
    'A concat: rawTx || 0x02||rlpR (current 2c)': txRlp + typedReceipt.slice(2),
    'B concat: rawTx || rlpR': txRlp + rlpR.slice(2),
    'C wrapper: rlp([rawTx, 0x02||rlpR])': encodeRlp([txRlp, typedReceipt]),
    'D wrapper: rlp([rawTx, rlpR])': encodeRlp([txRlp, rlpR]),
    'E tx only: rawTx': txRlp,
    'F SDK original': String(d.txBytes),
  };
  console.log(`\n===== candidate hashes (tx trie leaf = keccak(rawTypedTx) must equal txHash):`);
  console.log(`    keccak(rawTx)=${keccak256(txRlp)} (txHash=${LOCK})`);
  for (const [name, bytes] of Object.entries(cands)) {
    try {
      const ok = await prover.verifySingle(CHAIN_KEY, d.headerNumber, bytes, d.merkleProof, d.continuityProof);
      console.log(`verifySingle [${name}]: ${ok ? 'PASS ✅' : 'fail ❌ (returned false)'}`);
    } catch (e: any) {
      console.log(`verifySingle [${name}]: REVERT ❌ ${e.shortMessage || e.reason || e.message?.slice(0, 120)}`);
    }
  }
  // also sanity: mint SDK bytes should pass
  const dm = proofs['mint'];
  if (dm) {
    try {
      const ok = await prover.verifySingle(CHAIN_KEY, dm.headerNumber, String(dm.txBytes), dm.merkleProof, dm.continuityProof);
      console.log(`verifySingle [mint SDK original]: ${ok ? 'PASS ✅' : 'fail ❌'}`);
    } catch (e: any) {
      console.log(`verifySingle [mint SDK original]: REVERT ❌ ${e.shortMessage || e.reason || e.message?.slice(0, 120)}`);
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
