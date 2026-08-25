# Plan: GOPass Sepolia Hub → Creditcoin Verifier (trustless) → Sepolia activation

## Decision
- Hub `GOPass` moves to **Sepolia 11155111** (`chainKey 1` via `PrecompileChainInfoProvider`), `GOPassRegistry` (was Verifier) on **Creditcoin 102031** verifies via `PrecompileBlockProver.verifySingle 0x0FD2` trustless (like `hello-bridge`/`custom-contracts` `USCMinter`).
- Sepolia `GToken` RWA stays on `Sepolia` — reads local `GOPass` `isActive` (no cross-chain per transfer). Creditcoin is single source of truth for **approval**, worker syncs status back to `Sepolia`.
- Mint on `Sepolia` is **not active** until `Creditcoin` approves via trustless proof + worker conflict resolve. `dummy 0x01` removed.

## Contracts

### `contracts/src/GOPass.sol` (Sepolia hub, soulbound NFT, pending → active)
- Inherits `ERC721` soulbound `tokenId=uint160(wallet)`, `Record{ tier, countryBitmap, expiry, frozen, active, customerIdHash, kycSource }` where `active=false` pending, `kycSource=""` default (e.g. `"sumsub"` optional via `--kycSource`), `countryBitmap` single bit per wallet (e.g. `US` `1`).
- `function mint(address to, Record r) external onlyOwner` (or `onlyKYC` multisig) — stores `r` with `active=false`, `recordHash=keccak(r)`, emits `PassMinted(wallet, tokenId, recordHash)`, but `isEligible` checks `active && !frozen && now<expiry`.
- `function setActive(address wallet, bool active) external onlyOwnerOrWorker` — worker on `Sepolia` (same `PRIVATE_KEY` as `CC` worker) sets `active=true` after `CC` registry confirms. No proof on `Sepolia` side (trusted back-channel like `loan-flow` `registerLoanFund`).
- `function update/freeze/burn` `onlyOwner` — for KYC changes, emits `PassUpdated`.

### `contracts/src/GOPassRegistry.sol` (Creditcoin verifier, trustless via 0x0FD2)
- `GOPassRegistry` on `CC3` stores `mapping(address=>Record) verified` + `verifiedUntil` with same `Record` (+`kycSource` stored but not in `isEligible`, `active` ignored on `CC`).
- `function syncPassWithTxProof(wallet, Record r, headerNumber, txBytes, merkleRoot, siblings, lowerDigest, roots)` — `verifySingle(CREDITCOIN_CHAIN_KEY=1, headerNumber, txBytes, ...)` via `0x0FD2`, decodes `PassMinted` log from `txBytes` to check `keccak(r)==event.recordHash`, then caches `verified[wallet]=r`, emits `PassVerified`.
- No `worker` role, anyone can submit proof (trustless, like `USCLoanManager`).

### `contracts/src/GToken.sol` (Sepolia, unchanged)
- `isEligible` checks `GOPass.isEligible(wallet, rule)` on same chain (`Sepolia` local read, `5k` gas). No cross-chain per transfer.

## Flow (like `loan-flow` worker.ts:148 → 190 → 222)

1. **Mint pending on Sepolia**: `2_mint.ts --to 0x... --country US --kycSource sumsub --tier 10` (or blank `""`) → `GOPass.mint` `active=false` `kycSource` stored, `hasPass true` but `GToken.mint` still reverts `PassNotEligible` until `CC` + back-sync.
2. **Trustless Sepolia → CC3**: `scripts/gopass/3_worker_sync.ts --wallet 0x... --tx 0x<sepoliaMintTx>` watches `PassMinted`, `ProofBuilder(1, PROOF_BUILDER_URL).waitUntilHeightAttested + getProof`, `PrecompileBlockProver.verifySingle` view, then `GOPassRegistry.syncPassWithTxProof` on `CC3` (anyone, no privileged worker).
3. **Conflict/approval on CC3**: `GOPassRegistry` is single source of truth. If `customerIdHash` duplicate or tier below threshold, `CC` logic can `require` inside `syncPassWithTxProof` (e.g. `tier>=10`, `countryBitmap` allowed, `customerIdHash` not used). Worker can also call `GOPassRegistry.approve/reject` after external KYC check (Sumsub) — emits `PassApproved/PassRejected`.
4. **Back-sync CC3 → Sepolia (trusted worker, like loan-flow CC→Sepolia)**: `worker.ts` polls `GOPassRegistry PassVerified/PassApproved` on `CC3`, then `GOPass.setActive(wallet, true)` on `Sepolia` via `onlyWorkerOrOwner` (same `PRIVATE_KEY`). Now `GToken` `isEligible` passes. If conflict/reject, `setActive(false)` + AI inbox `KYC Rejected`.
5. **RWA transfer**: `GToken.mint/transfer` on `Sepolia` checks `GOPass` local `active`.

## Worker

- `scripts/gopass/worker_gopass.ts` daemon: `pollEvents PassMinted Sepolia` → `ProofBuilder 1` → `GOPassRegistry.syncPassWithTxProof CC3` → `pollEvents PassVerified CC3` → `GOPass.setActive Sepolia`. Handles `MAX_PROCESSED_TXS` like `loan-flow/worker.ts:104,364`.
- Single `WORKER_PRIVATE_KEY` owns both `GOPass` `owner` and `GOPassRegistry` permission (or `onlyOwner` on both for `setActive`).

## Deployment order

1. `GOPass` on `Sepolia` `1_DeployGOPass Sepolia`
2. `GOPassRegistry` on `CC3` `102031` with `GOPASS_ADDR` (Sepolia address, for log check) + `chainKey 1`
3. `GToken` on `Sepolia` with `GOPass` address
4. `scripts/gopass/1_check_chains` verifies `chainKey 1` Sepolia supported, `2_mint` → `3_worker_sync --tx` → `4_check_eligible` on both chains

## Handling CC3 single source of truth & conflict

- `GOPassRegistry` on `CC3` enforces `customerIdHash` uniqueness + `tier` threshold; duplicate `customerIdHash` across wallets reverts `syncPassWithTxProof`.
- Worker on `CC3` can `approve` only once per `wallet` — if two `Sepolia` mints race with same `customerId`, first `syncPassWithTxProof` wins, second reverts `customerId used`, worker then `setActive(false)` + `burn` on `Sepolia` for loser.
- All subsequent `RWA` checks on `Sepolia` trust `GOPass.active` set only after `CC` confirms.

## Multi-chain (when `Creditcoin` adds `chainKey` via `getSupportedChains`)
- Universal pass: keep one `Sepolia` hub (`chainKey 1`); new chain `Base` (`chainKey 2` when `PrecompileChainInfoProvider` adds) deploys `GToken` that still checks `GOPass` via `CC` registry or direct `GOPass` relay — no new `mint` per wallet.
- Per-chain mint: deploy `GOPass` on `Base`, `mint` there with same `customerIdHash` + `ProofBuilder(chainKey 2)` → `GOPassRegistry` on `CC` dedupes `customerIdHash` across `chainKey`s (first wins), worker links wallets.

## Next
- All files self-contained for new Sepolia hub → CC registry arch; old `Creditcoin` hub plan removed (`plan-go-pass-creditcoin.md` deleted).
