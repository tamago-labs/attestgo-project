/**
 * 4b_post_sgd_announcement.ts — publish SGD-GO to Discover feed via POST /feed
 * Usage: npx tsx scripts/rwa/4b_post_sgd_announcement.ts
 *        npx tsx scripts/rwa/4b_post_sgd_announcement.ts --issuerId <uuid> --tokenProfileId <uuid> --text "..."
 */
import 'dotenv/config';
import { apiPost, apiGet } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const PRESET_TEXT = 'GO SGD compliant stablecoin live — Singapore-dollar backed for business & remittance. Verified Singapore users + approved jurisdictions via GO Pass.';

async function main() {
  let issuerProfileId = (arg('--issuerId') || '').trim();
  let tokenProfileId: string | undefined = (arg('--tokenProfileId') || arg('--listingId') || '').trim() || undefined;
  const rawText = arg('--text');

  if (!issuerProfileId || !tokenProfileId) {
    try {
      const iss = await apiGet(`/issuers?handle=go_asset`);
      issuerProfileId = issuerProfileId || iss.id || '';
      const list = await apiGet(`/listings?issuerProfileId=${issuerProfileId}`);
      const owner = iss.ownerWallet;
      const tokens = await apiGet(`/tokens?issuer=${owner}`);
      const tok = (tokens.items || []).find((t: any) => String(t.symbol).toLowerCase() === 'sgd-go');
      if (tok) {
        const found = (list.items || []).find((l: any) => l.tokenRecordId === tok.id || String(l.tokenRecordId).toLowerCase() === String(tok.id).toLowerCase());
        const foundByAddr = !found ? (list.items || []).find((l: any) => String(l.tokenAddress || '').toLowerCase() === String(tok.tokenAddress).toLowerCase()) : found;
        tokenProfileId = tokenProfileId || found?.id || foundByAddr?.id;
        if (tokenProfileId) console.log(`resolved sgd -> issuer ${issuerProfileId} listing ${tokenProfileId}`);
      }
    } catch (e: any) { console.warn(`token resolve failed:`, e.message); }
  }

  const text = (rawText || PRESET_TEXT).trim();
  if (!issuerProfileId) { console.error('need --issuerId <uuid> or issuer go_asset'); process.exit(1); }

  const body: any = { issuerProfileId, text };
  if (tokenProfileId) body.tokenProfileId = tokenProfileId;
  console.log(`POST /feed issuer=${issuerProfileId}${tokenProfileId ? ` listing=${tokenProfileId}` : ''}...`);
  const res = await apiPost('/feed', body);
  console.log(JSON.stringify(res, null, 2));
  console.log(`\nannouncement id=${res.id}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
