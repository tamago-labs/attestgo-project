/**
 * 2_mint.ts — mint GOPass on Creditcoin hub (owner only)
 * Usage: npx tsx scripts/gopass/2_mint.ts --to 0x2c1A... --tier 10 --countries US,SG [--customerId cust123]
 * Env: CREDITCOIN_RPC_URL, PRIVATE_KEY (owner), GOPASS_ADDR
 */
import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes } from 'ethers';

const RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PK = process.env.PRIVATE_KEY || process.env.CREDITCOIN_WALLET_PRIVATE_KEY || '';
const GOPASS_ADDR = process.env.GOPASS_ADDR || '';

if (!PK || !PK.startsWith('0x')) { console.error('PRIVATE_KEY missing'); process.exit(1); }
if (!GOPASS_ADDR) { console.error('GOPASS_ADDR missing — deploy 1_DeployGOPass first'); process.exit(1); }

const GOPASS_ABI = [
  'function mint(address to, tuple(uint8 tier, uint8 subTier, bytes2 group, bytes2 subGroup, uint256 countryBitmap, uint64 expiry, bool frozen, bytes32 customerIdHash) r) external',
  'function hasPass(address) view returns (bool)',
  'function recordHash(address) view returns (bytes32)',
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
  return {
    to: get('--to') || get('--wallet') || '',
    tier: Number(get('--tier') || 10),
    countries: (get('--countries') || 'US,SG').split(',').map((s) => s.trim()).filter(Boolean),
    customerId: get('--customerId') || `cust-${Date.now()}`,
    days: Number(get('--days') || 365),
  };
}

async function main() {
  const { to, tier, countries, customerId, days } = parseArgs();
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
  console.log(`mint to=${to} tier=${tier} countries=${countries.join(',')} bitmap=${bm} expiry=${expiry} cid=${customerId} -> ${cid}`);
  const tx = await (hub as any).mint(to, { tier, subTier: 0, group: '0x0000', subGroup: '0x0000', countryBitmap: bm, expiry, frozen: false, customerIdHash: cid });
  console.log(`tx ${tx.hash} waiting...`);
  const rc = await tx.wait();
  console.log(`mined block ${rc.blockNumber} status=${rc.status}`);
  console.log(`recordHash=${await (hub as any).recordHash(to)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
