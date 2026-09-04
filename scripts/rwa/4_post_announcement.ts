/**
 * 4_post_announcement.ts — publish to Discover feed via POST /feed
 * Usage: npx tsx scripts/rwa/4_post_announcement.ts --token nikkei  (or --token tbill)
 *        npx tsx scripts/rwa/4_post_announcement.ts --issuerId <uuid> --tokenProfileId <uuid> --text "..."
 * --token resolves issuer go_asset + listing via GET /issuers + GET /listings
 */
import 'dotenv/config';
import { apiPost, apiGet } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const PRESETS: Record<string, string> = {
  nikkei: 'Nikkei 225 index fund open — trade aN225 with verified GO Pass.',
  tbill: 'T-Bill vault open — stake US dollars into aTBILL via GO Pass.',
};

async function main() {
  let issuerProfileId = (arg('--issuerId') || '').trim();
  let tokenProfileId: string | undefined = (arg('--tokenProfileId') || arg('--listingId') || '').trim() || undefined;
  const tokenKey = (arg('--token') || '').trim().toLowerCase();
  const rawText = arg('--text');
  // resolve via --token nikkei|tbill (issuer is always go_asset)
  if ((tokenKey === 'nikkei' || tokenKey === 'tbill') && (!issuerProfileId || !tokenProfileId)) {
    try {
      const iss = await apiGet(`/issuers?handle=go_asset`);
      issuerProfileId = issuerProfileId || iss.id || '';
      const list = await apiGet(`/listings?issuerProfileId=${issuerProfileId}`);
      const sym = tokenKey === 'nikkei' ? 'aN225' : 'aTBILL';
      // listings don't store symbol directly, need to fetch tokenRecord via GET /tokens and match, but try by desc fallback: pick first matching productUrl
      // For now list items and try to find by tokenRecordId lookup via GET /tokens?issuer=
      const owner = iss.ownerWallet;
      const tokens = await apiGet(`/tokens?issuer=${owner}`);
      const tok = (tokens.items || []).find((t: any) => String(t.symbol).toLowerCase() === sym.toLowerCase());
      if (tok) {
        const found = (list.items || []).find((l: any) => l.tokenRecordId === tok.id || String(l.tokenRecordId).toLowerCase() === String(tok.id).toLowerCase());
        // fallback: if list items have tokenAddress match
        const foundByAddr = !found ? (list.items || []).find((l: any) => String(l.tokenAddress || '').toLowerCase() === String(tok.tokenAddress).toLowerCase()) : found;
        tokenProfileId = tokenProfileId || found?.id || foundByAddr?.id;
        if (tokenProfileId) console.log(`resolved ${tokenKey} -> issuer ${issuerProfileId} listing ${tokenProfileId}`);
      }
    } catch (e: any) { console.warn(`token resolve failed:`, e.message); }
  }
  const text = (rawText || (tokenKey ? PRESETS[tokenKey] : '') || 'Go Asset Management — Nikkei 225 & T-Bill now live on AttestGO.').trim();
  if (!issuerProfileId) { console.error('need --issuerId <uuid>  or  --token nikkei|tbill (issuer go_asset)'); process.exit(1); }
  const body: any = { issuerProfileId, text };
  if (tokenProfileId) body.tokenProfileId = tokenProfileId;
  console.log(`POST /feed issuer=${issuerProfileId}${tokenProfileId ? ` listing=${tokenProfileId}` : ''}...`);
  const res = await apiPost('/feed', body);
  console.log(JSON.stringify(res, null, 2));
  console.log(`\nannouncement id=${res.id}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
