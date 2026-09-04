# RWA demo scripts — Nikko AM (aN225) + AttestGo Treasury (aTBILL)

REST via `x-platform-api-key`, matches `app/docs/page.tsx` contract.

## Setup
```bash
cp scripts/rwa/.env.example .env
# edit TOKEN_API_URL, PLATFORM_API_KEY, ISSUER_NIKKO_WALLET, ISSUER_TBILL_WALLET
```

## Run
```bash
# stepwise
npx tsx scripts/rwa/1_ensure_issuer.ts --handle nikko_am --wallet 0x... --verify
npx tsx scripts/rwa/2_issue_gtoken.ts --issuer 0x... --symbol aN225 --countries us,jp,sg --name "AttestGO Nikkei 225 Index (Nikko AM)"
npx tsx scripts/rwa/3_register_listing.ts --issuerId <uuid> --tokenAddress 0x...
npx tsx scripts/rwa/4_post_announcement.ts --issuerId <uuid> --tokenProfileId <uuid> --text "Nikko AM ..."

# or seed both sets end-to-end (issuer → token → listing → feed)
npx tsx scripts/rwa/seed_demo.ts
```

Flow per RWA: `POST /issuers` (pending → PATCH /issuers/{id} status=verified) → `POST /tokens` (countries bitmap: us=0 sg=1 jp=2 → nikko `["us","jp","sg"]` bitmap 7, tbill `["us"]` 1) → `POST /listings {issuerProfileId, tokenAddress, chainId, apy,tvl,desc}` → `POST /feed {issuerProfileId, tokenProfileId, text}`.

Verify: `GET /issuers?handle=nikko_am`, `GET /tokens?issuer=0x...`, `GET /feed?handle=nikko_am`.
