/**
 * 4_check_eligible.ts — view isEligibleCached + cached record
 * Usage: npx tsx scripts/gopass/4_check_eligible.ts --wallet 0x...
 * Env: SEPOLIA_RPC_URL, VERIFIER_ADDR
 */
import 'dotenv/config';
import { JsonRpcProvider, Contract } from 'ethers';

const RPC = process.env.SEPOLIA_RPC_URL || process.env.SOURCE_CHAIN_RPC_URL || '';
const VERIFIER_ADDR = process.env.VERIFIER_ADDR || '';
if (!RPC) { console.error('SEPOLIA_RPC_URL missing'); process.exit(1); }
if (!VERIFIER_ADDR) { console.error('VERIFIER_ADDR missing'); process.exit(1); }

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const wallet = arg('--wallet') || arg('--to') || '';
  if (!wallet) { console.error('need --wallet 0x...'); process.exit(1); }
  const p = new JsonRpcProvider(RPC);
  const m = new Contract(VERIFIER_ADDR, [
    'function getCached(address) view returns (tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bytes32 customerIdHash))',
    'function isVerified(address) view returns (bool)',
    'function verifiedUntil(address) view returns (uint64)',
    'function isEligibleCached(address wallet, tuple(bytes2 allowed_group,bytes2 allowed_sub_group,uint8 min_tier,uint8 min_sub_tier,bool is_black_list,uint256 countriesBitmap) rule) view returns (bool)',
  ], p);
  const rec: any = await (m as any).getCached(wallet);
  const ver = await (m as any).isVerified(wallet);
  const until = await (m as any).verifiedUntil(wallet);
  console.log(`cached tier=${rec.tier} bitmap=${rec.countryBitmap} expiry=${rec.expiry} frozen=${rec.frozen} verified=${ver} until=${until}`);
  const rule = { allowed_group: '0x0000', allowed_sub_group: '0x0000', min_tier: 10, min_sub_tier: 0, is_black_list: false, countriesBitmap: 3n };
  const ok = await (m as any).isEligibleCached(wallet, rule);
  console.log(`isEligibleCached (US|SG, min 10): ${ok ? '✅ Ready to Receive' : '❌ Not eligible / Syncing...'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
