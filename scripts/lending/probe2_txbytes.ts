/**
 * probe2_txbytes.ts — dump full SDK d.txBytes hex for both txs + RPC tx/receipt fields
 * so we can map the ABI struct word-by-word.
 * Usage: npx tsx scripts/lending/probe2_txbytes.ts
 */
import 'dotenv/config';
import { JsonRpcProvider } from 'ethers';
import { proofProvider } from '@gluwa/usc-sdk';
import { writeFileSync } from 'fs';

const CHAIN_KEY = 1;
const URL = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const MINT = '0xa14ac9fcd71792977f953877111598359c33e277c542c99480bee4747b50e380';
const LOCK = process.argv[2] || '0xda2c9a9a291a26b572ae735eb126107c40e61c2ef3dbd255678827e58d72d586';
const sepolia = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL || '');
const builder = new proofProvider.service.ProofBuilder(CHAIN_KEY, URL, 5000);

function words(hx: string, label: string) {
  const b = hx.replace(/^0x/, '');
  console.log(`\n===== ${label} total=${b.length / 2} bytes (${b.length / 64} words)`);
  for (let i = 0; i * 64 < b.length; i++) {
    const w = b.slice(i * 64, i * 64 + 64);
    console.log(`  w[${String(i).padStart(2, '0')}] ${w}`);
  }
}

async function main() {
  for (const [name, tx] of [['mint', MINT], ['lock', LOCK]] as const) {
  const t: any = await sepolia.send('eth_getTransactionByHash', [tx]);
  const r: any = await sepolia.send('eth_getTransactionReceipt', [tx]);
  console.log(`\n########## ${name} ${tx}`);
  console.log(`rpc: from=${t.from} to=${t.to} value=${t.value} nonce=${parseInt(t.nonce, 16)} type=${t.type}`);
  console.log(`rpc data=${(t.input ?? t.data).slice(0, 100)} len=${((t.input ?? t.data).length - 2) / 2}`);
  console.log(`rpc status=${parseInt(r.status, 16)} gasUsed=${parseInt(r.cumulativeGasUsed, 16)} bloomHead=${r.logsBloom.slice(0, 20)}`);
  for (const l of r.logs) console.log(`  log: addr=${l.address} topics=${l.topics.length} dataLen=${(l.data.length - 2) / 2} t0=${l.topics[0]?.slice(0, 12)}`);
  const res = await builder.getProof(tx);
  if (!res.success || !res.data) { console.log(`getProof failed: ${res.error}`); continue; }
  const d: any = res.data;
  const tb: string = d.txBytes;
  writeFileSync(`C:\\Users\\pisut\\AppData\\Local\\Temp\\opencode\\txbytes_${name}.hex`, tb);
  words(tb, `SDK txBytes (${name}) — header=${d.headerNumber}`);
  // print any other big fields the SDK returned
  for (const k of Object.keys(d)) {
    const v = (d as any)[k];
    if (typeof v === 'string' && v.startsWith('0x') && v.length > 200 && k !== 'txBytes') words(v, `SDK extra field ${k}`);
  }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
