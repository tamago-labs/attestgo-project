/**
 * 5_gtoken_mint.ts — demo GToken gated mint (like AuxiliaryAdvance fund)
 * Usage: npx tsx scripts/gopass/5_gtoken_mint.ts --to 0x... --amount 100
 * Env: SEPOLIA_RPC_URL, PRIVATE_KEY (GToken owner), GTOKEN_ADDR
 */
import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, parseUnits } from 'ethers';

const RPC = process.env.SEPOLIA_RPC_URL || process.env.SOURCE_CHAIN_RPC_URL || '';
const PK = process.env.PRIVATE_KEY || '';
const GTOKEN_ADDR = process.env.GTOKEN_ADDR || process.env.GTOKEN_ADDRESS || '';

if (!RPC) { console.error('SEPOLIA_RPC_URL missing'); process.exit(1); }
if (!PK) { console.error('PRIVATE_KEY missing (GToken owner)'); process.exit(1); }
if (!GTOKEN_ADDR) { console.error('GTOKEN_ADDR missing'); process.exit(1); }

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const to = arg('--to') || '';
  const amount = arg('--amount') || '100';
  if (!to) { console.error('need --to 0x...'); process.exit(1); }
  const p = new JsonRpcProvider(RPC);
  const w = new Wallet(PK, p);
  const g = new Contract(GTOKEN_ADDR, [
    'function mint(address to, uint256 amount) external',
    'function balanceOf(address) view returns (uint256)',
    'function symbol() view returns (string)',
  ], w);
  console.log(`mint ${amount} ${(await (g as any).symbol())} to ${to}...`);
  try {
    const tx = await (g as any).mint(to, parseUnits(amount, 18));
    console.log(`tx ${tx.hash} waiting...`);
    const rc = await tx.wait();
    console.log(`mined ${rc.blockNumber} status=${rc.status} balance=${await (g as any).balanceOf(to)}`);
  } catch (e: any) {
    console.error('mint failed:', e.shortMessage ?? e.message);
    if (e.message?.includes('PassNotEligible')) console.log('hint: wallet not verified — run 3_worker_sync.ts first');
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
