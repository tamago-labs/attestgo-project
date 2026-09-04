/**
 * 1_ensure_issuer.ts — create or fetch issuer profile via POST /issuers (x-platform-api-key)
 * Usage: npx tsx scripts/rwa/1_ensure_issuer.ts --handle nikko_am --wallet 0x... [--verify]
 * Env: TOKEN_API_URL, PLATFORM_API_KEY
 */
import 'dotenv/config';
import { apiPost, apiGet, apiPatch } from './lib/api';

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const PRESETS: Record<string, { issuerName: string; handle: string; website: string; description: string; logoURI: string }> = {
  nikko_am: {
    issuerName: 'Nikko Asset Management',
    handle: 'nikko_am',
    website: 'https://www.nikkoam.com',
    description: "Japan's leading asset manager — Nikkei 225 index funds & ETFs, tokenized for US/JP/SG via GO Pass",
    logoURI: 'https://icons.test/nikko-am.svg',
  },
  attestgo_treasury: {
    issuerName: 'AttestGo Treasury',
    handle: 'attestgo_treasury',
    website: 'https://attestgo.xyz/treasury',
    description: 'AttestGo in-house US Treasury vault, 1:1 T-Bill backed, US only',
    logoURI: 'https://icons.test/attestgo-treasury.svg',
  },
};

async function main() {
  const handle = (arg('--handle') || 'nikko_am').toLowerCase();
  const wallet = (arg('--wallet') || process.env.ISSUER_NIKKO_WALLET || '').trim();
  const doVerify = process.argv.includes('--verify');
  if (!wallet) { console.error('need --wallet 0x... or ISSUER_*_WALLET'); process.exit(1); }
  const preset = PRESETS[handle] || PRESETS.nikko_am;

  // try GET first
  try {
    const existing = await apiGet(`/issuers?handle=${handle}`);
    console.log(`found ${handle}:`, existing);
    if (doVerify && existing.status !== 'verified') {
      const patched = await apiPatch(`/issuers/${existing.id}`, { status: 'verified' });
      console.log('verified:', patched);
    }
    console.log(`\nissuerId=${existing.id} status=${existing.status} handle=${existing.handle}`);
    return;
  } catch (e: any) {
    if (!String(e.message).includes('404')) console.warn('GET failed', e.message);
  }

  console.log(`creating issuer ${preset.handle} owner ${wallet}...`);
  try {
    const created = await apiPost('/issuers', { ...preset, ownerWallet: wallet });
    console.log('created:', created);
    if (doVerify) {
      const patched = await apiPatch(`/issuers/${created.id}`, { status: 'verified' });
      console.log('verified:', patched);
    }
    console.log(`\nissuerId=${created.id} status=${created.status}`);
  } catch (e: any) {
    if (String(e.message).includes('409')) {
      console.log('handle taken, fetching...');
      const existing = await apiGet(`/issuers?handle=${handle}`);
      console.log(existing);
      if (doVerify && existing.status !== 'verified') {
        const patched = await apiPatch(`/issuers/${existing.id}`, { status: 'verified' });
        console.log('verified:', patched);
      }
    } else throw e;
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
