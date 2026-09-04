/**
 * 4_post_announcement.ts — publish to Discover feed via POST /feed
 * Usage: npx tsx scripts/rwa/4_post_announcement.ts --issuerId <uuid> --text "Nikko AM Nikkei 225 now listed..."
 */
import 'dotenv/config';
import { apiPost } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const issuerProfileId = (arg('--issuerId') || '').trim();
  const tokenProfileId = (arg('--tokenProfileId') || arg('--listingId') || undefined);
  const text = (arg('--text') || 'Nikko AM Nikkei 225 now listed — aN225 live, eligible US/JP/SG only via GO Pass.').trim();
  if (!issuerProfileId) { console.error('need --issuerId <uuid>'); process.exit(1); }
  const body: any = { issuerProfileId, text };
  if (tokenProfileId) body.tokenProfileId = tokenProfileId;
  console.log(`POST /feed issuer=${issuerProfileId}...`);
  const res = await apiPost('/feed', body);
  console.log(JSON.stringify(res, null, 2));
  console.log(`\nannouncement id=${res.id}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
