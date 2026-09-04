/**
 * seed_demo.ts — end-to-end issuer → token → listing → announcement for two demo RWAs
 * Usage: npx tsx scripts/rwa/seed_demo.ts
 * Env: TOKEN_API_URL, PLATFORM_API_KEY, ISSUER_NIKKO_WALLET, ISSUER_TBILL_WALLET
 * Flow per RWA: 1_ensure_issuer (verified) → 2_issue_gtoken → 3_register_listing → 4_post_announcement
 */
import 'dotenv/config';
import { apiPost, apiGet, apiPatch } from './lib/api';

const ISSUER_NIKKO = (process.env.ISSUER_NIKKO_WALLET || '').trim();
const ISSUER_TBILL = (process.env.ISSUER_TBILL_WALLET || '').trim();

const SETS = [
  {
    key: 'nikko',
    issuer: { issuerName: 'Nikko Asset Management', handle: 'nikko_am', website: 'https://www.nikkoam.com', description: "Japan's leading asset manager — Nikkei 225 index funds & ETFs, tokenized for US/JP/SG via GO Pass", logoURI: 'https://icons.test/nikko-am.svg', ownerWallet: ISSUER_NIKKO },
    token: { name: 'AttestGO Nikkei 225 Index (Nikko AM)', symbol: 'aN225', countries: ['us','jp','sg'], iconURI: 'https://icons.test/nikko-am.svg', minTier: 10, apy: '5.2%', tvl: '¥2.1T AUM', desc: 'Tokenized Nikkei 225 index mutual fund mirrored from Nikko AM, eligibility US/JP/SG via GO Pass', productUrl: 'https://www.nikkoam.com/products/nikkei-225' },
    announcement: 'Nikko AM Nikkei 225 now listed — aN225 live, eligible US/JP/SG only via GO Pass. Daily NAV attested.',
  },
  {
    key: 'tbill',
    issuer: { issuerName: 'AttestGo Treasury', handle: 'attestgo_treasury', website: 'https://attestgo.xyz/treasury', description: 'AttestGo in-house US Treasury vault, 1:1 T-Bill backed, US only', logoURI: 'https://icons.test/attestgo-treasury.svg', ownerWallet: ISSUER_TBILL },
    token: { name: 'AttestGO T-Bill', symbol: 'aTBILL', countries: ['us'], iconURI: 'https://icons.test/tbill.svg', minTier: 10, apy: '4.8%', tvl: '$12M', desc: 'USD T-Bill vault — US persons only via GO Pass', productUrl: 'https://attestgo.xyz/treasury/tbill' },
    announcement: 'AttestGo Treasury T-Bill live — aTBILL yield from US T-Bills, US-only compliance enforced.',
  },
] as const;

async function ensureIssuer(p: typeof SETS[number]['issuer']) {
  if (!p.ownerWallet) throw new Error(`ownerWallet missing for ${p.handle} — set ISSUER_*_WALLET`);
  try {
    const existing = await apiGet(`/issuers?handle=${p.handle}`);
    console.log(`[issuer] found ${p.handle}: ${existing.id} status=${existing.status}`);
    if (existing.status !== 'verified') {
      const patched = await apiPatch(`/issuers/${existing.id}`, { status: 'verified' });
      console.log(`[issuer] verified ${p.handle}:`, patched.status);
      return patched;
    }
    return existing;
  } catch (e: any) {
    if (!String(e.message).includes('404')) throw e;
  }
  const created = await apiPost('/issuers', p);
  console.log(`[issuer] created ${p.handle}: ${created.id} status=${created.status}`);
  const patched = await apiPatch(`/issuers/${created.id}`, { status: 'verified' });
  console.log(`[issuer] verified ${p.handle}`);
  return patched;
}

async function issueGToken(issuerWallet: string, t: typeof SETS[number]['token']) {
  const res = await apiPost('/tokens', { issuer: issuerWallet, name: t.name, symbol: t.symbol, minTier: t.minTier, countries: t.countries, iconURI: t.iconURI });
  console.log(`[token] ${t.symbol} -> ${res.tokenAddress} tx=${res.txHash} pending=${res.pending}`);
  return res as { tokenAddress: string; txHash: string };
}

async function registerListing(issuerId: string, tokenAddress: string, t: typeof SETS[number]['token']) {
  const res = await apiPost('/listings', { issuerProfileId: issuerId, tokenAddress, chainId: 11155111, apy: t.apy, tvl: t.tvl, desc: t.desc, productUrl: t.productUrl });
  console.log(`[listing] ${t.symbol} -> ${res.id} status=${res.status}`);
  return res as { id: string };
}

async function postAnnouncement(issuerId: string, listingId: string, text: string) {
  const res = await apiPost('/feed', { issuerProfileId: issuerId, tokenProfileId: listingId, text });
  console.log(`[feed] ${res.id}: ${text.slice(0,60)}`);
  return res;
}

async function main() {
  if (!ISSUER_NIKKO || !ISSUER_TBILL) {
    console.error('Set ISSUER_NIKKO_WALLET and ISSUER_TBILL_WALLET in .env (checksummed addresses)');
    process.exit(1);
  }
  for (const s of SETS) {
    console.log(`\n=== ${s.key}: ${s.issuer.handle} / ${s.token.symbol} ===`);
    const issuer = await ensureIssuer(s.issuer as any);
    const token = await issueGToken(s.issuer.ownerWallet, s.token as any);
    // small delay for TokenRecord propagation before listing
    await new Promise(r => setTimeout(r, 2000));
    const listing = await registerListing(issuer.id, token.tokenAddress, s.token as any);
    await postAnnouncement(issuer.id, listing.id, s.announcement);
  }
  console.log('\nDone — verify via GET /issuers?handle=nikko_am, GET /tokens?issuer=..., GET /feed?handle=nikko_am');
}
main().catch((e)=>{ console.error(e); process.exit(1); });
