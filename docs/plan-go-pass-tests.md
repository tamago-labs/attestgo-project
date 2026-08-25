# Plan: GO Pass Tests — forge unit + node.js E2E (Sepolia hub, Creditcoin registry)

## Architecture under test
- Hub `GOPass.sol` on **Sepolia 11155111** (`chainKey 1`): `ERC721` soulbound `tokenId=uint160(wallet)`, `Record{ tier, subTier, group, subGroup, countryBitmap, expiry, frozen, active, customerIdHash, kycSource }` where `kycSource` `""` default (e.g. `"sumsub"`), `active=false` on `mint` pending CC approval, `isEligible` checks `active && !frozen && tier>=min`.
- Registry `GOPassRegistry.sol` on **Creditcoin 102031**: `Record` same (+`kycSource`), `syncPassWithTxProof` trustless via `PrecompileBlockProver.verifySingle 0x0FD2` (`chainKey 1` Sepolia tx inclusion), `syncPass` dummy fallback, `isEligible` same rule.
- RWA `GToken.sol` on **Sepolia**: gated by `GOPass.isEligible` local read (`active` required), `Rule{ allowed_group, min_tier, is_black_list, countriesBitmap }` like `atoken/launch`.

## Forge unit (`contracts/test/GOPass.t.sol`, `0.8.19`, no fork, `forge test`)
- `GOPass` hub: mint pending `active=false` not eligible, `setActive(true)` via worker makes eligible; reverts `onlyOwner`, zero, expiry past, dup wallet/`customerIdHash`, soulbound transfer revert, `update` keeps `active`, `setFrozen`/`setActive` updates `recordHash`, `burn` deletes, `kycSource` `""` or `"sumsub"` both stored in hash.
- `GOPassRegistry` CC: `syncPass` with any `proof 0x01` caches (precompile absent in test), `syncPassWithTxProof` same; `isEligible` matrix `frozen/expiry/verifiedUntil/tier<min/subTier/group/countries` whitelist (`&==0` fail) vs blocklist (`&!=0` fail), `invalidate onlyOwner`.
- `GToken` Sepolia: `mint/transfer` via `GOPass.isEligible` — pending `active=false` reverts `PassNotEligible`, after `setActive true` succeeds, `paused` blocks all, `kycSource` not in eligibility.

## Node.js E2E (`scripts/gopass/`, `sepolia` + `https://rpc.cc3-testnet.creditcoin.network` via `viem`/`usc-sdk`)
1. `1_check_chains.ts` `PrecompileChainInfoProvider` `getSupportedChains` `chainKey 1 Sepolia` (from `step1_supported_chains.ts`)
2. `2_mint.ts` `--to 0x.. --country US --kycSource sumsub` (or blank) → `GOPass.mint` `active=false` on Sepolia, `PassMinted`
3. `3_worker_sync.ts --wallet 0x.. --tx 0x<sepoliaMintTx>` `ProofBuilder(1).waitUntilHeightAttested + getProof` → `GOPassRegistry.syncPassWithTxProof` on CC3 `verifySingle 0x0FD2`
4. Worker back-sync `GOPass.setActive(wallet,true)` on Sepolia (like `loan-flow` `registerLoanFund` CC→Sepolia trusted)
5. `4_check_eligible.ts` `GOPass.isEligible` + `GOPassRegistry.isEligible` both true, `5_gtoken_mint.ts` `GToken.mint` succeeds, `6_freeze.ts` `setFrozen` + `invalidate` makes `isEligible false`.
- For new chain (`chainKey 2 Base` etc. when `Creditcoin` adds via `getSupportedChains`): same Sepolia hub universal pass works via CC registry, or per-chain `GOPass` mint with same `customerIdHash` + `chainKey 2` proof to CC (dedupe on `customerIdHash`).
