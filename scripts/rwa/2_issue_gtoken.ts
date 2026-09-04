/**
 * 2_issue_gtoken.ts — issue GToken via POST /tokens (platform pays gas)
 * Usage: npx tsx scripts/rwa/2_issue_gtoken.ts --token nikkei  (or --token tbill)
 *         npx tsx scripts/rwa/2_issue_gtoken.ts --issuer 0x... --name "Go Nikkei 225" --symbol aN225 --countries us,jp,sg
 * Docs: POST /tokens {issuer, name, symbol, minTier, countries, iconURI, underlying?}
 * --token picks preset (nikkei aN225 us,jp,sg | tbill aTBILL us), issuer defaults to go_asset via ISSUER_WALLET or GET /issuers?handle=go_asset
 */
import 'dotenv/config';
import { apiPost, apiGet } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const TOKENS: Record<string, { name: string; symbol: string; countries: string[]; iconURI: string; minTier: number }> = {
  nikkei: { name: 'Go Nikkei 225 Index', symbol: 'aN225', countries: ['us','jp','sg'], iconURI: 'https://attestgo.tamagolabs.com/nekkei-token-icon.png', minTier: 10 },
  tbill: { name: 'Go T-Bill', symbol: 'aTBILL', countries: ['us'], iconURI: 'https://attestgo.tamagolabs.com/t-bill-token-icon.png', minTier: 10 },
};

async function main() {
  let tokenKey = (arg('--token') || '').trim().toLowerCase();
  // shorthand: --handle tbill|nikkei still accepted as token
  const handleArg = (arg('--handle') || '').trim().toLowerCase();
  if (handleArg && !tokenKey && (handleArg === 'nikkei' || handleArg === 'tbill' || handleArg === 'an225' || handleArg === 'atbill')) {
    tokenKey = handleArg === 'an225' ? 'nikkei' : handleArg === 'atbill' ? 'tbill' : handleArg;
  }
  let issuer = (arg('--issuer') || arg('--owner') || process.env.ISSUER_WALLET || process.env.ISSUER_NIKKO_WALLET || '').trim();
  if (!issuer) {
    try {
      const iss = await apiGet(`/issuers?handle=go_asset`);
      issuer = iss.ownerWallet || iss.ownerwallet || '';
      console.log(`resolved go_asset -> owner ${issuer}`);
    } catch (e: any) { /* use env ISSUER_WALLET fallback */ }
  }
  const preset = tokenKey ? TOKENS[tokenKey] : undefined;
  const name = (arg('--name') || preset?.name || 'Go Nikkei 225 Index').trim();
  const symbol = (arg('--symbol') || preset?.symbol || 'aN225').trim();
  const countriesRaw = (arg('--countries') || (preset ? preset.countries.join(',') : 'us,jp,sg')).trim();
  const iconURI = (arg('--icon') || arg('--iconURI') || preset?.iconURI || 'https://attestgo.tamagolabs.com/go-asset-logo.png').trim();
  const minTier = Number(arg('--minTier') || preset?.minTier || 10);
  const underlying = arg('--underlying') || undefined;
  if (!issuer) { console.error('need --issuer 0x... or set ISSUER_WALLET / create issuer go_asset first'); process.exit(1); }
  const countries = countriesRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const body: any = { issuer, name, symbol, minTier, countries, iconURI };
  if (underlying) body.underlying = underlying;

  console.log(`POST /tokens issuer=${issuer} ${symbol} countries=${countries.join(',')}...`);
  const res = await apiPost('/tokens', body);
  console.log(JSON.stringify(res, null, 2));
  console.log(`\ntokenAddress=${res.tokenAddress} txHash=${res.txHash} pending=${res.pending} bitmap=${res.countriesBitmap}`);
  if (!res.tokenAddress) console.warn('no tokenAddress yet — poll GET /tokens?issuer=...');
}
main().catch((e) => { console.error(e); process.exit(1); });
