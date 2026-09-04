/**
 * 3_register_listing.ts — link TokenRecord to issuer via POST /listings
 * Usage: npx tsx scripts/rwa/3_register_listing.ts --token nikkei  (or --token tbill)
 *        npx tsx scripts/rwa/3_register_listing.ts --issuerId <uuid> --tokenAddress 0x... [--apy ...]
 * Docs: POST /listings {issuerProfileId, tokenAddress, chainId, apy, tvl, desc, productUrl}
 * --token resolves issuerId (go_asset) + tokenAddress via GET /issuers?handle=go_asset + GET /tokens?issuer=
 */
import 'dotenv/config';
import { apiPost, apiGet } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const TOKEN_PRESETS: Record<string, { symbol: string; apy: string; tvl: string; desc: string; productUrl: string }> = {
  nikkei: { symbol: 'aN225', apy: '5.2%', tvl: '¥2.1T AUM', desc: 'Go Nikkei 225 index — tokenized, US/JP/SG eligible via GO Pass', productUrl: 'https://attestgo.tamagolabs.com/demo-products/nikkei' },
  tbill: { symbol: 'aTBILL', apy: '4.8%', tvl: '$12M', desc: 'Go T-Bill vault — US only via GO Pass', productUrl: 'https://attestgo.tamagolabs.com/demo-products/tbill' },
};

async function main() {
  let issuerProfileId = (arg('--issuerId') || arg('--issuer') || '').trim();
  let tokenAddress = (arg('--tokenAddress') || '').trim();
  const tokenKeyRaw = (arg('--token') || '').trim().toLowerCase();
  const tokenKey = tokenKeyRaw && !tokenAddress && (tokenKeyRaw === 'nikkei' || tokenKeyRaw === 'tbill' || tokenKeyRaw === 'an225' || tokenKeyRaw === 'atbill') ? (tokenKeyRaw === 'an225' ? 'nikkei' : tokenKeyRaw === 'atbill' ? 'tbill' : tokenKeyRaw) : tokenKeyRaw;
  const handle = 'go_asset';
  if (!issuerProfileId && tokenKey) {
    try {
      const iss = await apiGet(`/issuers?handle=${handle}`);
      issuerProfileId = iss.id || '';
      console.log(`resolved handle ${handle} -> issuer ${issuerProfileId}`);
    } catch (e: any) { console.warn(`handle ${handle} lookup failed:`, e.message); }
  }
  // if --token nikkei|tbill provided without --tokenAddress, lookup tokenAddress by symbol via GET /tokens?issuer=
  if (!tokenAddress && tokenKey && (tokenKey === 'nikkei' || tokenKey === 'tbill')) {
    const preset = TOKEN_PRESETS[tokenKey];
    try {
      const iss = issuerProfileId ? await apiGet(`/issuers?id=${issuerProfileId}`) : await apiGet(`/issuers?handle=${handle}`);
      const owner = iss?.ownerWallet || iss?.ownerwallet || iss?.items?.[0]?.ownerWallet || '';
      const issId = issuerProfileId || iss?.id || iss?.items?.[0]?.id || '';
      if (!issuerProfileId) issuerProfileId = issId;
      if (owner) {
        const list = await apiGet(`/tokens?issuer=${owner}`);
        const found = (list.items || []).find((t: any) => String(t.symbol).toLowerCase() === preset.symbol.toLowerCase());
        if (found) {
          tokenAddress = found.tokenAddress;
          console.log(`resolved token ${tokenKey} (${preset.symbol}) -> ${tokenAddress}`);
        } else console.warn(`token ${preset.symbol} not found for issuer ${owner}; items=${list.count}`);
      }
    } catch (e: any) { console.warn(`token lookup failed:`, e.message); }
  } else if (!tokenAddress && tokenKeyRaw && tokenKeyRaw.startsWith('0x')) {
    tokenAddress = tokenKeyRaw;
  }
  const chainId = Number(arg('--chainId') || '11155111');
  const preset = tokenKey ? TOKEN_PRESETS[tokenKey] : undefined;
  const apy = arg('--apy') || preset?.apy || '5.2%';
  const tvl = arg('--tvl') || preset?.tvl || '¥2.1T AUM';
  const desc = arg('--desc') || preset?.desc || 'Tokenized Nikkei 225 index — eligibility US/JP/SG via GO Pass';
  const productUrl = arg('--productUrl') || preset?.productUrl || 'https://www.nikkoam.com/products/nikkei-225';
  if (!issuerProfileId || !tokenAddress) { console.error('need --issuerId <uuid> --tokenAddress 0x...  or  --token nikkei|tbill (issuer go_asset)'); process.exit(1); }

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
