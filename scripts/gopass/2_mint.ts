/**
 * 2_mint.ts — mint GOPass on Sepolia hub (owner only, pending CC approval) — one wallet = one country
 * Usage: npx tsx scripts/gopass/2_mint.ts --to 0x2c1A... --tier 10 --country US [--customerId cust123]
 *   also accepts --countries US; default US
 * Env: SEPOLIA_RPC_URL, PRIVATE_KEY (owner), GOPASS_ADDR (Sepolia)
 */

// PS C:\projects\attestgo-project> npx tsx scripts/gopass/2_mint.ts --to 0xB045bbB51f3CE266A506f332EDBDe176C9862Ff3 --country US --kycSource sumsub --tier 10
// hasPass 0xB045bbB51f3CE266A506f332EDBDe176C9862Ff3: false
// mint to=0xB045bbB51f3CE266A506f332EDBDe176C9862Ff3 tier=10 countries=US bitmap=1 expiry=1819176071 cid=cust-1787640070840 -> 0x10f4aa7cbc4bd93aad7c0fa1b14efb89afec60faade154531e27f1c5263447f3 kycSource=sumsub (active=false pending CC)
// tx 0xa14ac9fcd71792977f953877111598359c33e277c542c99480bee4747b50e380 waiting...
// mined block 11562361 status=1
// recordHash=0xdccf0bb5635d44df8d48e18e1e9d424fb0c1911cbbd4dd4f34dca4c2b7fb316e


import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from 'ethers';

const RPC = process.env.SEPOLIA_RPC_URL || process.env.SOURCE_CHAIN_RPC_URL || '';
const PK = process.env.PRIVATE_KEY || '';
const GOPASS_ADDR = process.env.GOPASS_ADDR || '';

if (!PK || !PK.startsWith('0x')) { console.error('PRIVATE_KEY missing'); process.exit(1); }
if (!GOPASS_ADDR) { console.error('GOPASS_ADDR missing — deploy 1_DeployGOPass first'); process.exit(1); }

const GOPASS_ABI = [
  'function mint(address to, tuple(uint8 tier, uint8 subTier, bytes2 group, bytes2 subGroup, uint256 countryBitmap, uint64 expiry, bool frozen, bool active, bytes32 customerIdHash, string kycSource) r) external',
  'function hasPass(address) view returns (bool)',
  'function recordHash(address) view returns (bytes32)',
  'function getRecord(address) view returns (tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource))',
  'event PassMinted(address indexed wallet, uint256 indexed tokenId, bytes32 recordHash, uint64 expiry)',
] as const;

const COUNTRY_BIT: Record<string, number> = { US: 0, SG: 1, JP: 2, HK: 3, DE: 4, CN: 5, GB: 6, FR: 7, AE: 8, CH: 9 };

function bitmap(countries: string[]): bigint {
  let b = 0n;
  for (const c of countries) {
    const bit = COUNTRY_BIT[c.toUpperCase()];
    if (bit === undefined) throw new Error(`country not mapped: ${c} (add to COUNTRY_BIT)`);
    b |= 1n << BigInt(bit);
  }
  return b;
}

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (k: string) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const countryArg = get('--country') || get('--countries') || 'US';
  const countries = countryArg.split(',').map((s) => s.trim()).filter(Boolean);
  if (countries.length !== 1) console.warn(`⚠️  expected one country, got ${countries.length} (${countries.join(',')}) — using first only`);
  return {
    to: get('--to') || get('--wallet') || '',
    tier: Number(get('--tier') || 10),
    countries: countries.slice(0, 1),
    customerId: get('--customerId') || `cust-${Date.now()}`,
    kycSource: get('--kycSource') || get('--kyc') || '',
    days: Number(get('--days') || 365),
  };
}

async function main() {
  const { to, tier, countries, customerId, kycSource, days } = parseArgs();
  if (!to || !to.startsWith('0x')) { console.error('need --to 0x...'); process.exit(1); }
  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(PK, provider);
  const hub = new Contract(GOPASS_ADDR, GOPASS_ABI, wallet);
  const has = await (hub as any).hasPass(to);
  console.log(`hasPass ${to}: ${has}`);
  if (has) { console.log('already minted — skip'); return; }
  const expiry = BigInt(Math.floor(Date.now() / 1000) + days * 86400);
  const bm = bitmap(countries);
  const cid = keccak256(toUtf8Bytes(customerId));
  console.log(`mint to=${to} tier=${tier} countries=${countries.join(',')} bitmap=${bm} expiry=${expiry} cid=${customerId} -> ${cid} kycSource=${kycSource || '(blank)'} (active=false pending CC)`);
  const tx = await (hub as any).mint(to, { tier, subTier: 0, group: '0x0000', subGroup: '0x0000', countryBitmap: bm, expiry, frozen: false, active: false, customerIdHash: cid, kycSource: kycSource || '' });
  console.log(`tx ${tx.hash} waiting...`);
  const rc = await tx.wait();
  console.log(`mined block ${rc.blockNumber} status=${rc.status}`);
  console.log(`recordHash=${await (hub as any).recordHash(to)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
