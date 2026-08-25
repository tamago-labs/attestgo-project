/**
 * 4_check_eligible.ts — view isEligible on Sepolia GOPass hub (checks active)
 * Usage: npx tsx scripts/gopass/4_check_eligible.ts --wallet 0x...
 * Env: SEPOLIA_RPC_URL, GOPASS_ADDR (Sepolia hub), REGISTRY_ADDR (CC, optional check)
 */

// PS C:\projects\attestgo-project> npx tsx scripts/gopass/4_check_eligible.ts --wallet 0xB045bbB51f3CE266A506f332EDBDe176C9862Ff3
// GOPass hub tier=10 bitmap=1 expiry=1819176071 frozen=false active=true kyc=sumsub customerIdHash=0x10f4aa7cbc4bd93aad7c0fa1b14efb89afec60faade154531e27f1c5263447f3
// isEligible Sepolia GOPass (US, min 10, active required): ✅ Ready to Receive

import 'dotenv/config';
import { JsonRpcProvider, Contract } from 'ethers';

const RPC = process.env.SEPOLIA_RPC_URL || process.env.SOURCE_CHAIN_RPC_URL || '';
const GOPASS_ADDR = process.env.GOPASS_ADDR || '';
const REGISTRY_ADDR = process.env.REGISTRY_ADDR || process.env.VERIFIER_ADDR || '';
if (!RPC) { console.error('SEPOLIA_RPC_URL missing'); process.exit(1); }
if (!GOPASS_ADDR) { console.error('GOPASS_ADDR missing'); process.exit(1); }

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const wallet = arg('--wallet') || arg('--to') || '';
  if (!wallet) { console.error('need --wallet 0x...'); process.exit(1); }
  const p = new JsonRpcProvider(RPC);
  const hub = new Contract(GOPASS_ADDR, [
    'function getRecord(address) view returns (tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource))',
    'function isEligible(address wallet, tuple(bytes2 allowed_group,bytes2 allowed_sub_group,uint8 min_tier,uint8 min_sub_tier,bool is_black_list,uint256 countriesBitmap) rule) view returns (bool)',
  ], p);
  const rec: any = await (hub as any).getRecord(wallet);
  console.log(`GOPass hub tier=${rec.tier} bitmap=${rec.countryBitmap} expiry=${rec.expiry} frozen=${rec.frozen} active=${rec.active} kyc=${rec.kycSource || '(blank)'} customerIdHash=${rec.customerIdHash}`);
  const rule = { allowed_group: '0x0000', allowed_sub_group: '0x0000', min_tier: 10, min_sub_tier: 0, is_black_list: false, countriesBitmap: 1n } as any;
  const ok = await (hub as any).isEligible(wallet, rule);
  console.log(`isEligible Sepolia GOPass (US, min 10, active required): ${ok ? '✅ Ready to Receive' : '❌ Not eligible / Pending CC approval...'}`);
  if (REGISTRY_ADDR) {
    const cc = new JsonRpcProvider(process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network');
    const reg = new Contract(REGISTRY_ADDR, ['function isEligible(address,tuple(bytes2,bytes2,uint8,uint8,bool,uint256)) view returns (bool)'], cc);
    try {
      const okCc = await (reg as any).isEligible(wallet, rule);
      console.log(`isEligible CC registry: ${okCc ? '✅ verified' : '❌ not yet verified on CC'}`);
    } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
