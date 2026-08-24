/**
 * 9_withdraw_demo.ts — Demo vault withdraw / vest polling (Option B)
 *
 * Polls StreamVault.withdrawable / vested for a streamId, then withdraws as recipient.
 * Pairs with 7_create_stream (streamId 1,2...) + 8_worker_vault (registered Stream 2 at 0x7199...).
 *
 * Env:
 *   CREDITCOIN_RPC_URL, STREAM_VAULT_ADDRESS (0x719948...), WRAPPED_ASTR_ADDRESS (0x5d03...),
 *   CREDITCOIN_WALLET_PRIVATE_KEY or RECIPIENT_PRIVATE_KEY (recipient of stream, e.g. 0xB045 if self)
 *   STREAM_ID=2, POLL_SECS=10, AUTO_WITHDRAW=true/false
 *
 * Usage:
 *   npx tsx scripts/9_withdraw_demo.ts --streamId 2
 *   STREAM_ID=2 RECIPIENT_PRIVATE_KEY=0x... npx tsx scripts/9_withdraw_demo.ts --withdraw
 *   npx tsx scripts/9_withdraw_demo.ts --streamId 2 --loop 5 --interval 15
 */

import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, InterfaceAbi } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const VAULT_ADDR = process.env.STREAM_VAULT_ADDRESS || '0x719948cED7f58d4684E92Df95bEfB70893148039';
const WASTR_ADDR = process.env.WRAPPED_ASTR_ADDRESS || '0x5d03E2e40992194097989c4E73A31cb5a488d774';
const PK = process.env.RECIPIENT_PRIVATE_KEY || process.env.CREDITCOIN_WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const STREAM_ID = Number(process.env.STREAM_ID || 2);

function arg(name: string, def?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : def;
}

async function main() {
  const streamId = Number(arg('streamId', String(STREAM_ID)));
  const doWithdraw = process.argv.includes('--withdraw');
  const loop = Number(arg('loop', '1'));
  const interval = Number(arg('interval', '10'));

  if (!VAULT_ADDR || VAULT_ADDR === '0x...') throw new Error('STREAM_VAULT_ADDRESS missing (0x7199...)');
  console.log(`\n🔗 CC3 ${CC_RPC}`);
  console.log(`🏦 Vault ${VAULT_ADDR} wASTR ${WASTR_ADDR} streamId=${streamId}`);

  const provider = new JsonRpcProvider(CC_RPC);
  const vaultAbi = [
    'function streams(uint256) view returns (address payer, address recipient, address token, uint256 total, uint256 duration, uint256 start, uint256 withdrawn, bytes32 attestId, bool exists)',
    'function vested(uint256) view returns (uint256)',
    'function withdrawable(uint256) view returns (uint256)',
    'function withdraw(uint256) external',
    'event Withdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount)',
  ] as const;
  const erc20Abi = ['function balanceOf(address) view returns (uint256)', 'function symbol() view returns (string)'] as const;

  const vault = new Contract(VAULT_ADDR, vaultAbi as unknown as InterfaceAbi, provider);
  const wastr = new Contract(WASTR_ADDR, erc20Abi as unknown as InterfaceAbi, provider);

  const s: any = await (vault as any).streams(streamId);
  console.log(`  stream exists=${s.exists} payer=${s.payer} recipient=${s.recipient} total=${s.total.toString()} duration=${s.duration.toString()} start=${s.start.toString()} withdrawn=${s.withdrawn.toString()} attestId=${s.attestId}`);
  if (!s.exists) throw new Error(`streamId ${streamId} not found — check vault address and streamId (try 1,2)`);

  const symbol = await (wastr as any).symbol().catch(() => 'wASTR');
  for (let i = 0; i < loop; i++) {
    const vested: bigint = await (vault as any).vested(streamId);
    const withdrawable: bigint = await (vault as any).withdrawable(streamId);
    const recBal: bigint = await (wastr as any).balanceOf(s.recipient);
    const vaultBal: bigint = await (wastr as any).balanceOf(VAULT_ADDR);
    console.log(`\n[${i + 1}/${loop}] ${new Date().toISOString()}`);
    console.log(`  vested ${vested.toString()} withdrawable ${withdrawable.toString()} withdrawn ${s.withdrawn.toString()} vaultBal ${vaultBal.toString()} recipientBal ${recBal.toString()} ${symbol}`);
    console.log(`  progress ${(Number(vested) / Number(s.total) * 100).toFixed(2)}%`);

    if (doWithdraw && withdrawable > 0n) {
      if (!PK) throw new Error('RECIPIENT_PRIVATE_KEY missing for withdraw');
      const wallet = new Wallet(PK, provider);
      if (wallet.address.toLowerCase() !== (s.recipient as string).toLowerCase()) {
        console.warn(`  ⚠️ wallet ${wallet.address} != recipient ${s.recipient} — withdraw will revert "only recipient"`);
      }
      const vaultWithSigner = new Contract(VAULT_ADDR, vaultAbi as unknown as InterfaceAbi, wallet);
      console.log(`  → withdraw ${withdrawable.toString()} as ${wallet.address}...`);
      const tx = await (vaultWithSigner as any).withdraw(streamId);
      console.log(`    tx ${tx.hash} waiting...`);
      const receipt = await tx.wait();
      console.log(`    mined ${receipt.blockNumber} status=${receipt.status}`);
      for (const log of receipt.logs) {
        try {
          const p = vaultWithSigner.interface.parseLog({ topics: [...log.topics], data: log.data });
          if (p?.name === 'Withdrawn') console.log(`    ✅ Withdrawn amount=${p.args.amount.toString()}`);
        } catch {}
      }
      break;
    }

    if (i < loop - 1) {
      console.log(`  sleeping ${interval}s...`);
      await new Promise((r) => setTimeout(r, interval * 1000));
    }
  }

  if (!doWithdraw) {
    console.log(`\nTip: to withdraw now (if withdrawable >0):`);
    console.log(`  RECIPIENT_PRIVATE_KEY=0x... npx tsx scripts/9_withdraw_demo.ts --streamId ${streamId} --withdraw`);
    console.log(`  # or: cast send --rpc-url $CREDITCOIN_RPC_URL ${VAULT_ADDR} "withdraw(uint256)" ${streamId} --private-key \\$RECIPIENT_KEY`);
  }
}

main().catch((e) => {
  console.error('❌', e.message ?? e);
  process.exit(1);
});
