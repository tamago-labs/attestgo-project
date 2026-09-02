/**
 * 3_worker_unlock.ts — trusted worker for CC → Sepolia unlock settlement
 * Watches CoreVault.UnlockRequested on Creditcoin and calls SourceVault.unlock(recipient, token, amount)
 * on Sepolia. Handles both borrower unlocks (after repay/requestUnlock) and liquidator payouts
 * (requestLiquidationPayout). Only trust boundary in the system (same pattern as gopass mirror sync).
 *
 * Usage: npx tsx scripts/lending/3_worker_unlock.ts
 * Env:
 *   CREDITCOIN_RPC_URL, SEPOLIA_RPC_URL, PRIVATE_KEY (must be SourceVault worker or owner)
 *   CORE_VAULT_ADDR, SOURCE_VAULT_ADDR
 *   POLL_INTERVAL_MS=5000
 */
import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet, EventLog, InterfaceAbi } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || '';
const PK = process.env.PRIVATE_KEY || '';
const CORE = process.env.CORE_VAULT_ADDR || '';
const SOURCE_VAULT = process.env.SOURCE_VAULT_ADDR || '';
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 5000);

if (!SEPOLIA_RPC || !CORE || !SOURCE_VAULT) {
  console.error('need SEPOLIA_RPC_URL CORE_VAULT_ADDR SOURCE_VAULT_ADDR');
  process.exit(1);
}
if (!PK || !PK.startsWith('0x')) { console.error('PRIVATE_KEY missing'); process.exit(1); }

const CORE_ABI = ['event UnlockRequested(address indexed recipient, address indexed creditcoinCollateral, address sourceCollateral, uint256 amount, bytes32 marketId)'] as const;
const SOURCE_ABI = [
  'function unlock(address recipient, address collateralToken, uint256 amount) external',
  'function available(address,address) view returns (uint256)',
] as const;

let shuttingDown = false;
process.on('SIGINT', () => (shuttingDown = true));
process.on('SIGTERM', () => (shuttingDown = true));

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
  console.log('\n🔓 Unlock worker starting (CC UnlockRequested → Sepolia SourceVault.unlock)');
  const cc = new JsonRpcProvider(CC_RPC);
  const sepolia = new JsonRpcProvider(SEPOLIA_RPC);
  const wSepolia = new Wallet(PK, sepolia);
  const wCC = new Wallet(PK, cc);

  const core = new Contract(CORE, CORE_ABI as unknown as InterfaceAbi, wCC);
  const sourceVault = new Contract(SOURCE_VAULT, SOURCE_ABI as unknown as InterfaceAbi, wSepolia);

  let from = await cc.getBlockNumber();
  console.log(`  from CC block ${from}`);

  const seen = new Set<string>();

  while (!shuttingDown) {
    from = await pollEvents(core, 'UnlockRequested', from, async (ev) => {
      const txHash: string = ev.transactionHash;
      if (seen.has(txHash)) return;
      seen.add(txHash);
      const [recipient, creditcoinCollateral, sourceCollateral, amount, marketId] = ev.args as any;
      console.log(`\n📡 UnlockRequested tx=${txHash}`);
      console.log(`   recipient=${recipient} ccToken=${creditcoinCollateral} srcToken=${sourceCollateral} amount=${amount} marketId=${marketId}`);
      try {
        const avail: bigint = await (sourceVault as any).available(recipient, sourceCollateral);
        if (avail < amount) {
          console.error(`   ⚠️ available ${avail} < amount ${amount} — skipping (will retry on next request)`);
          return;
        }
        const tx = await (sourceVault as any).unlock(recipient, sourceCollateral, amount);
        console.log(`   unlock tx ${tx.hash}...`);
        const rc = await tx.wait();
        console.log(`   ✅ unlocked ${amount} to ${recipient} (block ${rc.blockNumber})`);
      } catch (e: any) {
        console.error('   unlock error', e.shortMessage ?? e.message);
      }
    });

    if (seen.size > 1000) seen.clear();
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.log('Unlock worker stopped');
}

main().catch((e) => {
  console.error('Fatal', e);
  process.exit(1);
});
