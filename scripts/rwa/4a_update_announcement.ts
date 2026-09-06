/**
 * 4a_update_announcement.ts — update an existing Discover feed announcement
 * Usage: npx tsx scripts/rwa/4a_update_announcement.ts --token nikkei  (or --token tbill)
 *        npx tsx scripts/rwa/4a_update_announcement.ts --token nikkei --text "..."
 * Resolves issuer go_asset + listing via --token, finds existing feed post, updates it.
 */
import 'dotenv/config';
import { apiGet, apiPost } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const PRESETS: Record<string, string> = {
  nikkei: 'Nikkei 225 borrowing now open — use aN225 as collateral to borrow cUSDT on AttestGo DeFi.',
  tbill: 'T-Bill yield live soon — aTBILL distributions begin this week for verified Pass holders.',
};

async function main() {
  const tokenKey = (arg('--token') || '').trim().toLowerCase();
  const rawText = arg('--text');
  if (tokenKey !== 'nikkei' && tokenKey !== 'tbill') { console.error('need --token nikkei|tbill'); process.exit(1); }
  const text = (rawText || PRESETS[tokenKey] || '').trim();
  if (!text) { console.error('need --text "..."  or  --token nikkei|tbill'); process.exit(1); }
  // resolve issuer + listing
  const iss = await apiGet(`/issuers?handle=go_asset`);
  const issuerProfileId = iss.id || '';
  const list = await apiGet(`/listings?issuerProfileId=${issuerProfileId}`);
  const sym = tokenKey === 'nikkei' ? 'aN225' : 'aTBILL';
  const owner = iss.ownerWallet;
  const tokens = await apiGet(`/tokens?issuer=${owner}`);
  const tok = (tokens.items || []).find((t: any) => String(t.symbol).toLowerCase() === sym.toLowerCase());
  const listing = tok ? (list.items || []).find((l: any) => l.tokenRecordId === tok.id || String(l.tokenRecordId).toLowerCase() === String(tok.id).toLowerCase()) : undefined;
  const tokenProfileId = listing?.id;
  if (!tokenProfileId) { console.error(`could not resolve listing for ${tokenKey}`); process.exit(1); }
  console.log(`POST /feed issuer=${issuerProfileId} listing=${tokenProfileId}...`);
  const res = await apiPost('/feed', { issuerProfileId, tokenProfileId, text });
  console.log(JSON.stringify(res, null, 2));
  console.log(`\nannouncement id=${res.id}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
