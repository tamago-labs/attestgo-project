/**
 * 7_sync_mirror.ts — universal pass: sync CC registry verified record to new chain mirror (e.g. Base)
 * Usage: npx tsx scripts/gopass/7_sync_mirror.ts --wallet 0x... --from-cc --to-mirror 0xMirrorOnBase
 * Env: CREDITCOIN_RPC_URL, BASE_RPC_URL, REGISTRY_ADDR (CC), MIRROR_ADDR (Base), PRIVATE_KEY (worker)
 */
import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const MIRROR_RPC = process.env.BASE_RPC_URL || process.env.NEW_CHAIN_RPC_URL || '';
const REGISTRY_ADDR = process.env.REGISTRY_ADDR || '';
const MIRROR_ADDR = process.env.MIRROR_ADDR || '';
const PK = process.env.PRIVATE_KEY || '';

if (!REGISTRY_ADDR || !MIRROR_ADDR) { console.error('REGISTRY_ADDR/MIRROR_ADDR missing'); process.exit(1); }
if (!MIRROR_RPC) { console.error('BASE_RPC_URL missing'); process.exit(1); }

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const wallet = arg('--wallet') || '';
  if (!wallet) { console.error('need --wallet'); process.exit(1); }
  const cc = new JsonRpcProvider(CC_RPC);
  const mirrorRpc = new JsonRpcProvider(MIRROR_RPC);
  const registry = new Contract(REGISTRY_ADDR, ['function getRecord(address) view returns (tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource))', 'function isEligible(address,tuple(bytes2,bytes2,uint8,uint8,bool,uint256)) view returns (bool)'], cc);
  const rec: any = await (registry as any).getRecord(wallet);
  console.log(`CC registry tier=${rec.tier} active=${rec.active} kyc=${rec.kycSource} expiry=${rec.expiry}`);
  const w = new Wallet(PK, mirrorRpc);
  const mirror = new Contract(MIRROR_ADDR, ['function syncFromCC(address wallet, tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource) r) external'], w);
  console.log(`sync to mirror ${MIRROR_ADDR} on new chain...`);
  const tx = await (mirror as any).syncFromCC(wallet, rec);
  console.log(`tx ${tx.hash} waiting...`);
  await tx.wait();
  console.log('done — GToken on new chain can now check mirror isEligible (universal pass, no new mint)');
}

main().catch((e) => { console.error(e); process.exit(1); });
