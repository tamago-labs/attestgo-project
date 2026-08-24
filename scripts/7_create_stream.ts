/**
 * 7_create_stream.ts — Option B: single createStream lock on Sepolia (no per-drip)
 *
 * Calls AttestStream.createStream(recipient, totalAmount, duration, attestId, memo) on Sepolia 0x052B...
 * Emits StreamCreated + TokensBurnedForBridging; 5_worker / 6_stream_demo will prove it on CC3.
 * On CC3, StreamVault (contracts/src/StreamVault.sol) vests linearly: vested = total*(now-start)/duration
 *
 * Requires: AttestStream with createStream (redeploy 0x052B if old version without it: forge script 3-DeployAttestStream)
 *           .env: SOURCE_CHAIN_RPC_URL, PRIVATE_KEY, SOURCE_CHAIN_CONTRACT_ADDRESS=0x052B..., STREAM_VAULT_ADDRESS (for info)
 *
 * Usage:
 *   npx tsx scripts/7_create_stream.ts --recipient 0x... --total 10000000000000000000 --duration 3600 --memo "salary month"
 *   npx tsx scripts/7_create_stream.ts  # defaults: recipient=self, total=10 ASTR, duration=1h, attestId=keccak(memo)
 */

import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, InterfaceAbi, keccak256, toUtf8Bytes } from 'ethers';

const SRC_RPC = process.env.SOURCE_CHAIN_RPC_URL || '';
const PK = process.env.CREDITCOIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const STREAM_ADDR = process.env.SOURCE_CHAIN_CONTRACT_ADDRESS || '0x052B3eAC16D43EF792589aae41BaD2205c6CC21C';
const VAULT_ADDR = process.env.STREAM_VAULT_ADDRESS || '';
const WASTR_ADDR = process.env.WRAPPED_ASTR_ADDRESS || '';

if (!SRC_RPC) throw new Error('SOURCE_CHAIN_RPC_URL missing');
if (!PK) throw new Error('PRIVATE_KEY missing');

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : def;
}

async function main() {
  const provider = new JsonRpcProvider(SRC_RPC);
  const wallet = new Wallet(PK, provider);
  const recipient = arg('recipient', wallet.address)!;
  const total = arg('total', '10000000000000000000')!; // 10 ASTR
  const duration = Number(arg('duration', '3600')); // 1h
  const memo = arg('memo', 'AttestGO stream B — single lock, CC3 vest')!;
  const attestId = arg('attestId', keccak256(toUtf8Bytes(`attestgo:b:${memo}:${Date.now()}`)))!;

  console.log(`\n🔗 Sepolia ${SRC_RPC.slice(0,48)}...`);
  console.log(`👛 Payer ${wallet.address}`);
  console.log(`📦 AttestStream ${STREAM_ADDR} → vault ${VAULT_ADDR || '<deploy 5-DeployStreamVault first>'} wASTR ${WASTR_ADDR || '0x5d03...'}`);
  console.log(`→ createStream(recipient=${recipient}, total=${total}, duration=${duration}s, attestId=${attestId}, memo="${memo}")`);

  const abi = [
    'function createStream(address recipient,uint256 totalAmount,uint256 duration,bytes32 attestId,string memo) external returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function nextStreamId() view returns (uint256)',
    'event StreamCreated(address indexed payer, address indexed recipient, uint256 totalAmount, uint256 duration, bytes32 indexed attestId, uint256 streamId, string memo)',
  ] as const;
  const c = new Contract(STREAM_ADDR, abi as unknown as InterfaceAbi, wallet);

  const bal = await (c as any).balanceOf(wallet.address);
  console.log(`  ASTR balance ${bal.toString()} ${bal < BigInt(total) ? '⚠️ low' : ''}`);
  const nextId = await (c as any).nextStreamId();
  console.log(`  nextStreamId ${nextId.toString()}`);

  const tx = await (c as any).createStream(recipient, total, duration, attestId, memo);
  console.log(`  tx ${tx.hash} waiting...`);
  const receipt = await tx.wait();
  console.log(`  mined block ${receipt.blockNumber} status=${receipt.status}`);

  const iface = c.interface;
  for (const log of receipt.logs) {
    try {
      const p = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (p?.name === 'StreamCreated') {
        console.log(`  ✅ StreamCreated streamId=${p.args.streamId.toString()} payer=${p.args.payer} recipient=${p.args.recipient} total=${p.args.totalAmount.toString()} duration=${p.args.duration.toString()} attestId=${p.args.attestId}`);
        console.log(`\nNext: wait attested (~8-10 min) then:`);
        console.log(`  npx tsx scripts/2_verify_single_view.ts ${tx.hash}`);
        if (VAULT_ADDR) {
          console.log(`  # vault worker 8 will auto-mint wASTR to vault and register:`);
          console.log(`  STREAM_VAULT_ADDRESS=${VAULT_ADDR} WRAPPED_ASTR_ADDRESS=${WASTR_ADDR} npx tsx scripts/8_worker_vault.ts`);
          console.log(`  # check vest: cast call --rpc-url $CREDITCOIN_RPC_URL ${VAULT_ADDR} "withdrawable(uint256)(uint256)" ${p.args.streamId}`);
          console.log(`  # withdraw: cast send --rpc-url $CREDITCOIN_RPC_URL ${VAULT_ADDR} "withdraw(uint256)" ${p.args.streamId} --private-key $RECIPIENT_KEY`);
        } else {
          console.log(`  # deploy vault first: forge script script/5-DeployStreamVault.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast -vvvv`);
          console.log(`  # then run 8_worker_vault`);
        }
      }
    } catch {}
  }
}

main().catch(e => { console.error('❌', e.message ?? e); process.exit(1); });
