/**
 * 2a_issue_sgd_gtoken.ts — issue GO SGD (SGD-GO) Singapore-dollar stablecoin
 * Usage: npx tsx scripts/rwa/2a_issue_sgd_gtoken.ts
 * Countries: us, sg, jp, hk, gb (verified Singapore users + approved regional jurisdictions)
 * Docs: POST /tokens {issuer, name, symbol, minTier, countries, iconURI}
 */
import 'dotenv/config';
import { apiPost, apiGet } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const TOKEN = {
  name: 'GO SGD',
  symbol: 'SGD-GO',
  countries: ['us', 'sg', 'jp', 'hk', 'gb'],
  iconURI: 'https://attestgo.tamagolabs.com/sgd-go-token-icon.png',
  minTier: 10,
};

async function main() {
  let issuer = (arg('--issuer') || arg('--owner') || process.env.ISSUER_WALLET || process.env.ISSUER_NIKKO_WALLET || '').trim();
  if (!issuer) {
    try {
      const iss = await apiGet(`/issuers?handle=go_asset`);
      issuer = iss.ownerWallet || iss.ownerwallet || '';
      console.log(`resolved go_asset -> owner ${issuer}`);
    } catch (e: any) { /* use env ISSUER_WALLET fallback */ }
  }
  if (!issuer) { console.error('need --issuer 0x... or set ISSUER_WALLET / create issuer go_asset first'); process.exit(1); }

  const name = (arg('--name') || TOKEN.name).trim();
  const symbol = (arg('--symbol') || TOKEN.symbol).trim();
  const countriesRaw = (arg('--countries') || TOKEN.countries.join(',')).trim();
  const iconURI = (arg('--icon') || arg('--iconURI') || TOKEN.iconURI).trim();
  const minTier = Number(arg('--minTier') || TOKEN.minTier);
  const countries = countriesRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const body: any = { issuer, name, symbol, minTier, countries, iconURI };

  console.log(`POST /tokens issuer=${issuer} ${symbol} countries=${countries.join(',')}...`);
  const res = await apiPost('/tokens', body);
  console.log(JSON.stringify(res, null, 2));
  console.log(`\ntokenAddress=${res.tokenAddress} txHash=${res.txHash} pending=${res.pending} bitmap=${res.countriesBitmap}`);
  if (!res.tokenAddress) console.warn('no tokenAddress yet — poll GET /tokens?issuer=...');
}
main().catch((e) => { console.error(e); process.exit(1); });
