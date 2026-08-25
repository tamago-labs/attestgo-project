# Plan: GO Pass Scripts — forge deploy + `scripts/gopass` workers (Sepolia hub → Creditcoin registry)

## Architecture
- Hub `GOPass` **Sepolia 11155111** (`chainKey 1`): soulbound `pending active=false` until `CC` approves, `Record` includes `kycSource ""` default (`--kycSource sumsub` optional), single `country` per wallet (e.g. `US` bitmap `1`).
- Registry `GOPassRegistry` **Creditcoin 102031**: verifies Sepolia mint tx via `PrecompileBlockProver.verifySingle 0x0FD2` (`syncPassWithTxProof`), single source of truth (`customerIdHash` dedupe, `tier` check), `kycSource` stored but not in `isEligible`.
- RWA `GToken` **Sepolia**: reads `GOPass.isEligible` local (requires `active`), no proof per transfer. New chain (e.g. `Base` `chainKey 2` when `getSupportedChains` adds) reuses same Sepolia pass via `CC` registry, or mints per-chain with same `customerIdHash` + `chainKey 2` proof.

## Forge deploy (`contracts/script/`, `0.8.19`, `forge script --broadcast`)
- `1_DeployGOPass.s.sol` — `Sepolia` hub, `BASE_URI`, `require 11155111||84532||31337`, `GOPASS_ADDR` for next.
- `2_DeployGOPassRegistry.s.sol` — `CC3` verifier, `GOPASS_ADDR` (Sepolia) + `chainKey 1` fixed, `require 102031||102030`, `REGISTRY_ADDR` for worker, `CACHE_TTL` optional.
- `3_DeployGToken.s.sol` — `Sepolia` RWA, `GOPASS_ADDR` + `Rule{ min_tier 10, countriesBitmap 1 (US) }`, `require Sepolia`, `GTOKEN_ADDR`.

Env: `PRIVATE_KEY`, `SEPOLIA_RPC_URL`, `CREDITCOIN_RPC_URL`, `GOPASS_ADDR`, `REGISTRY_ADDR`, `GTOKEN_ADDR`, `PROOF_BUILDER_URL`.

## Node workers (`scripts/gopass/`, `@gluwa/usc-sdk` + `ethers` like `cross-chain-bridge`/`loan-flow`)
- `step1_supported_chains.ts` — `PrecompileChainInfoProvider.getSupportedChains()` `chainKey 1 Sepolia` (docs Step 1).
- `1_check_chains.ts` — `CC` + `Sepolia` RPCs, `GOPass`/`GOPassRegistry`/`GToken` code check.
- `2_mint.ts` — `GOPass.mint` on `Sepolia` `pending`, `--to --country US --kycSource ""|sumsub` (one country, `kycSource` blank default), `customerIdHash` dedupe.
- `3_worker_sync.ts` — `Sepolia mint txHash` → `ProofBuilder(1, PROOF_BUILDER_URL).waitUntilHeightAttested + getProof` → `PrecompileBlockProver.verifySingle` view → `GOPassRegistry.syncPassWithTxProof` on `CC3` (trustless), then worker `GOPass.setActive(wallet,true)` on `Sepolia` back-sync (like `loan-flow` `registerLoanFund` CC→Sepolia).
- `4_check_eligible.ts` — `GOPass.isEligible` `GOPassRegistry.isEligible` view.
- `5_gtoken_mint.ts` — `GToken.mint` gated by `GOPass.isEligible` (`active` required).
- `6_freeze.ts` — `GOPass.setFrozen` + `GOPassRegistry.invalidate` (owner).

## Order
Forge once per chain: `1_DeployGOPass Sepolia` → `2_DeployGOPassRegistry CC3` → `3_DeployGToken Sepolia`. Node per wallet: `2_mint --country US` → `3_worker_sync --wallet --tx` (~30-60s attestation) → `4_check_eligible` → `5_gtoken_mint` → `6_freeze` if needed. Universal pass: deploy `GToken` on new chain (e.g. `Base`) that still checks Sepolia `GOPass` via `CC` registry — no new mint.
