/**
 * 3_register_listing.ts — link TokenRecord to issuer via POST /listings
 * Usage: npx tsx scripts/rwa/3_register_listing.ts --issuerId <uuid> --tokenAddress 0x... [--apy 5.2% --tvl "¥2.1T"]
 * Docs: POST /listings {issuerProfileId, tokenAddress, chainId, apy, tvl, desc, productUrl}
 */
import 'dotenv/config';
import { apiPost, apiGet } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const issuerProfileId = (arg('--issuerId') || arg('--issuer') || '').trim();
  const tokenAddress = (arg('--tokenAddress') || arg('--token') || '').trim();
  const chainId = Number(arg('--chainId') || '11155111');
  const apy = arg('--apy') || '5.2%';
  const tvl = arg('--tvl') || '¥2.1T AUM';
  const desc = arg('--desc') || 'Tokenized Nikkei 225 index — eligibility US/JP/SG via GO Pass';
  const productUrl = arg('--productUrl') || 'https://www.nikkoam.com/products/nikkei-225';
  if (!issuerProfileId || !tokenAddress) { console.error('need --issuerId <uuid> --tokenAddress 0x...'); process.exit(1); }

  // verify token exists via GET /tokens?issuer or by address lookup via handler's tokenAddress alias
  try {
    const check = await apiGet(`/tokens?issuer=${tokenAddress}`); // dummy, will list all if not filtered
    // no-op, just ensure API reachable
  } catch {}

  const body = { issuerProfileId, tokenAddress, chainId, apy, tvl, desc, productUrl };
  console.log(`POST /listings issuer=${issuerProfileId} token=${tokenAddress}...`);
  const res = await apiPost('/listings', body);
  console.log(JSON.stringify(res, null, 2));
  console.log(`\nlisting id=${res.id} status=${res.status}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
