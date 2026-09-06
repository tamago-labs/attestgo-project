/**
 * 4a_update_announcement.ts — update an existing Discover feed announcement
 * Usage: npx tsx scripts/rwa/4a_update_announcement.ts --id <uuid> --token nikkei  (or --token tbill)
 *        npx tsx scripts/rwa/4a_update_announcement.ts --id <uuid> --text "..."
 */
import 'dotenv/config';
import { apiPut, apiGet } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const PRESETS: Record<string, string> = {
  nikkei: 'Nikkei 225 borrowing now open — use aN225 as collateral to borrow cUSDT on AttestGo DeFi.',
  tbill: 'T-Bill yield live soon — aTBILL distributions begin this week for verified Pass holders.',
};

async function main() {
  const id = (arg('--id') || '').trim();
  const tokenKey = (arg('--token') || '').trim().toLowerCase();
  const rawText = arg('--text');
  if (!id) { console.error('need --id <uuid>'); process.exit(1); }
  const text = (rawText || (tokenKey ? PRESETS[tokenKey] : '') || '').trim();
  if (!text) { console.error('need --text "..."  or  --token nikkei|tbill'); process.exit(1); }
  // fetch existing to preserve issuerProfileId / tokenProfileId
  let body: any = { text };
  try {
    const existing = await apiGet(`/feed/${id}`);
    if (existing.issuerProfileId) body.issuerProfileId = existing.issuerProfileId;
    if (existing.tokenProfileId) body.tokenProfileId = existing.tokenProfileId;
  } catch { /* proceed with text-only */ }
  console.log(`PUT /feed/${id}...`);
  const res = await apiPut(`/feed/${id}`, body);
  console.log(JSON.stringify(res, null, 2));
  console.log(`\nupdated announcement id=${res.id}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
