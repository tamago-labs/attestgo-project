/**
 * 3a_register_sgd_listing.ts — link SGD-GO TokenRecord to issuer via POST /listings
 * Usage: npx tsx scripts/rwa/3a_register_sgd_listing.ts
 *        npx tsx scripts/rwa/3a_register_sgd_listing.ts --issuerId <uuid> --tokenAddress 0x... [--apy ...]
 * Docs: POST /listings {issuerProfileId, tokenAddress, chainId, apy, tvl, desc, productUrl}
 */
import 'dotenv/config';
import { apiPost, apiGet } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const TOKEN_PRESET = {
  symbol: 'SGD-GO',
  apy: '0%',
  tvl: 'S$50M',
  desc: 'GO SGD — Singapore-dollar compliant stablecoin for business & remittance. Available to verified Singapore users and approved jurisdictions via GO Pass.',
  productUrl: 'https://attestgo.tamagolabs.com/demo-products/sgd-go',
};

async function main() {
  let issuerProfileId = (arg('--issuerId') || arg('--issuer') || '').trim();
  let tokenAddress = (arg('--tokenAddress') || '').trim();
  const handle = 'go_asset';

  if (!issuerProfileId) {
    try {
      const iss = await apiGet(`/issuers?handle=${handle}`);
      issuerProfileId = iss.id || '';
      console.log(`resolved handle ${handle} -> issuer ${issuerProfileId}`);
    } catch (e: any) { console.warn(`handle ${handle} lookup failed:`, e.message); }
  }

  if (!tokenAddress) {
    try {
      const iss = issuerProfileId ? await apiGet(`/issuers?id=${issuerProfileId}`) : await apiGet(`/issuers?handle=${handle}`);
      const owner = iss?.ownerWallet || iss?.ownerwallet || iss?.items?.[0]?.ownerWallet || '';
      const issId = issuerProfileId || iss?.id || iss?.items?.[0]?.id || '';
      if (!issuerProfileId) issuerProfileId = issId;
      if (owner) {
        const list = await apiGet(`/tokens?issuer=${owner}`);
        const found = (list.items || []).find((t: any) => String(t.symbol).toLowerCase() === TOKEN_PRESET.symbol.toLowerCase());
        if (found) {
          tokenAddress = found.tokenAddress;
          console.log(`resolved token sgd (${TOKEN_PRESET.symbol}) -> ${tokenAddress}`);
        } else console.warn(`token ${TOKEN_PRESET.symbol} not found for issuer ${owner}; items=${list.count}`);
      }
    } catch (e: any) { console.warn(`token lookup failed:`, e.message); }
  }

  const chainId = Number(arg('--chainId') || '11155111');
  const apy = arg('--apy') || TOKEN_PRESET.apy;
  const tvl = arg('--tvl') || TOKEN_PRESET.tvl;
  const desc = arg('--desc') || TOKEN_PRESET.desc;
  const productUrl = arg('--productUrl') || TOKEN_PRESET.productUrl;

  if (!issuerProfileId || !tokenAddress) { console.error('need --issuerId <uuid> --tokenAddress 0x...  or  --token sgd (issuer go_asset)'); process.exit(1); }

  const body = { issuerProfileId, tokenAddress, chainId, apy, tvl, desc, productUrl };
  console.log(`POST /listings issuer=${issuerProfileId} token=${tokenAddress} apy=${apy}...`);
  const res = await apiPost('/listings', body);
  console.log(JSON.stringify(res, null, 2));
  console.log(`\nlisting id=${res.id} status=${res.status}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
