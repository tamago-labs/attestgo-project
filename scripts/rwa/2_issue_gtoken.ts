/**
 * 2_issue_gtoken.ts — issue GToken via POST /tokens (platform pays gas)
 * Usage: npx tsx scripts/rwa/2_issue_gtoken.ts --issuer 0x... --name "AttestGO Nikkei 225 Index" --symbol aN225 --countries us,jp,sg
 * Docs: POST /tokens {issuer, name, symbol, minTier, countries, iconURI, underlying?}
 */
import 'dotenv/config';
import { apiPost } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const issuer = (arg('--issuer') || arg('--owner') || process.env.ISSUER_NIKKO_WALLET || '').trim();
  const name = (arg('--name') || 'AttestGO Nikkei 225 Index (Nikko AM)').trim();
  const symbol = (arg('--symbol') || 'aN225').trim();
  const countriesRaw = (arg('--countries') || 'us,jp,sg').trim();
  const iconURI = (arg('--icon') || arg('--iconURI') || 'https://icons.test/nikko-am.svg').trim();
  const minTier = Number(arg('--minTier') || '10');
  const underlying = arg('--underlying') || undefined;
  if (!issuer) { console.error('need --issuer 0x...'); process.exit(1); }
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
