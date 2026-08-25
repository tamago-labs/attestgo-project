/**
 * 6_freeze.ts — hub freeze + verifier invalidate
 * Usage: npx tsx scripts/gopass/6_freeze.ts --wallet 0x... --frozen true
 * Env: CREDITCOIN_RPC_URL, SEPOLIA_RPC_URL, GOPASS_ADDR, VERIFIER_ADDR, PRIVATE_KEY (owner), WORKER_PRIVATE_KEY
 */
import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || process.env.SOURCE_CHAIN_RPC_URL || '';
const GOPASS_ADDR = process.env.GOPASS_ADDR || '';
const VERIFIER_ADDR = process.env.VERIFIER_ADDR || '';
const PK_OWNER = process.env.PRIVATE_KEY || '';
const PK_WORKER = process.env.WORKER_PRIVATE_KEY || PK_OWNER;

if (!GOPASS_ADDR || !VERIFIER_ADDR) { console.error('GOPASS_ADDR/VERIFIER_ADDR missing'); process.exit(1); }
if (!PK_OWNER) { console.error('PRIVATE_KEY missing'); process.exit(1); }

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const wallet = arg('--wallet') || '';
  const frozen = (arg('--frozen') || 'true') === 'true';
  if (!wallet) { console.error('need --wallet 0x...'); process.exit(1); }
  const cc = new JsonRpcProvider(CC_RPC);
  const owner = new Wallet(PK_OWNER, cc);
  const hub = new Contract(GOPASS_ADDR, ['function setFrozen(address wallet, bool frozen) external'], owner);
  console.log(`hub setFrozen ${wallet} -> ${frozen}...`);
  const tx1 = await (hub as any).setFrozen(wallet, frozen);
  await tx1.wait();
  console.log(`hub mined ${tx1.hash}`);
  if (SEPOLIA_RPC && PK_WORKER) {
    const se = new JsonRpcProvider(SEPOLIA_RPC);
    const worker = new Wallet(PK_WORKER, se);
    const verifier = new Contract(VERIFIER_ADDR, ['function invalidate(address) external', 'function markVerified(address, tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bytes32 customerIdHash)) external', 'function getCached(address) view returns (tuple(uint8 tier,uint8,uint256,uint64,bool,bytes32))'], worker);
    if (frozen) {
      console.log('verifier invalidate...');
      const tx2 = await (verifier as any).invalidate(wallet);
      await tx2.wait();
      console.log(`verifier invalidated ${tx2.hash}`);
    } else {
      console.log('unfrozen — re-sync via 3_worker_sync.ts to re-verify');
    }
  }
  console.log('done — check with 4_check_eligible.ts');
}

main().catch((e) => { console.error(e); process.exit(1); });
