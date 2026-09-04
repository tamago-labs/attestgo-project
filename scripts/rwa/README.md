# RWA demo scripts — Go Asset Management (aN225 + aTBILL)

REST via `x-platform-api-key`, matches `app/docs/page.tsx` contract. One issuer owns both tokens; eligibility at token level.

## Setup
```bash
cp scripts/rwa/.env.example .env
# edit TOKEN_API_URL, PLATFORM_API_KEY, ISSUER_WALLET
```

## Run stepwise
```bash
npx tsx scripts/rwa/1_ensure_issuer.ts --handle go_asset --wallet 0x... --verify
# Nikkei 225 — US/JP/SG eligible
npx tsx scripts/rwa/2_issue_gtoken.ts --issuer 0x... --symbol aN225 --countries us,jp,sg --name "Go Nikkei 225 Index" --icon https://icons.test/go-nikkei.svg
npx tsx scripts/rwa/3_register_listing.ts --issuerId <uuid> --tokenAddress 0x... --apy 5.2% --tvl "¥2.1T AUM" --desc "Nikkei 225 index fund" --productUrl https://attestgo.xyz/go-nikkei
npx tsx scripts/rwa/4_post_announcement.ts --issuerId <uuid> --tokenProfileId <uuid> --text "Go Nikkei 225 now listed — aN225 live"
# T-Bill — US only
npx tsx scripts/rwa/2_issue_gtoken.ts --issuer 0x... --symbol aTBILL --countries us --name "Go T-Bill" --icon https://icons.test/go-tbill.svg
npx tsx scripts/rwa/3_register_listing.ts --issuerId <uuid> --tokenAddress 0x... --apy 4.8% --tvl "$12M" --desc "USD T-Bill vault" --productUrl https://attestgo.xyz/go-tbill
```

Flow: `POST /issuers` (pending → PATCH /issuers/{id} status=verified) → per token `POST /tokens` (bitmap: us=0 sg=1 jp=2 → aN225 `["us","jp","sg"]` 7, aTBILL `["us"]` 1) → `POST /listings {issuerProfileId, tokenAddress, chainId, apy,tvl,desc}` → `POST /feed {issuerProfileId, tokenProfileId, text}`.

Verify: `GET /issuers?handle=go_asset`, `GET /tokens?issuer=0x...`, `GET /feed?handle=go_asset`.
