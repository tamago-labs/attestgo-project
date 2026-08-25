# Plan: GO Pass Tests — forge unit + node.js E2E

## Forge unit (next file, local `anvil`/`forge test` — no RPC)
Target: `contracts/test/GOPass.t.sol` single file covers hub+mirror+token. Keep `0.8.19`, no fork.

### GOPass.sol (hub, Creditcoin mock)
- mint success: `onlyOwner`, expiry>now, new wallet, emits `PassMinted`, `tokenId==uint160(wallet)`, `recordHash==keccak(Record)`, `hasPass` true, `ownerOf` correct.
- mint reverts: non-owner, zero address, expiry past, duplicate wallet, duplicate `customerIdHash` (non-zero).
- soulbound: `transferFrom`/`safeTransferFrom` reverts `soulbound: non-transferable` (from!=0 && to!=0), but `burn` still works; `approve` blocked? keep allow but transfer still reverts via `_beforeTokenTransfer`.
- update: success overwrites `_records`+`recordHash`+`hashToWallet` if `customerIdHash` changed, emits `PassUpdated`; revert if not minted / expiry past / dup hash.
- setFrozen/setExpiry: toggle frozen then `recordHash` updates, `isEligible` reflects; burn deletes all + `ownerOf` reverts.
- baseURI: `setBaseURI` onlyOwner, `tokenURI` returns `base+tokenId`.

### GOPassMirror.sol (dest cache, Advance-style)
- constructor sets `GOPASS_ADDR`+`CREDITCOIN_CHAIN_ID`, `worker` initially zero.
- setWorker/setCacheTTL onlyOwner, `markVerified` onlyWorkerOrOwner, `invalidate` onlyWorkerOrOwner.
- markVerified: success caches `Record`, `verifiedUntil=now+TTL`, `isVerified true`, emits `PassSynced`; revert if wallet zero / expiry past; worker vs owner vs stranger.
- syncPass fallback: `proof empty` revert, on local (no `0x0FD2` code) skips precompile but still caches (test mode); emits.
- isEligibleCached rule matrix (like Cleanverse `atoken/launch.rule`):
  - frozen → false; expiry past → false; verifiedUntil expired → false (warp); tier <= min_tier → false; subTier; allowed_group mismatch; allowed_sub_group; countries whitelist (bitmap & ==0 → false), blacklist (bitmap & !=0 → false); happy path true.
- getCached returns stored Record.

### GToken.sol (RWA gated by mirror, like AuxiliaryAdvance vault)
- constructor binds `mirror` immutably, initial `Rule`; setRule/setPaused onlyOwner.
- mint/burn/transfer gating via `isEligibleCached`:
  - mint to ineligible (no pass / frozen / tier too low / wrong country) reverts `PassNotEligible`; eligible succeeds.
  - transfer from ineligible reverts; transfer to ineligible reverts (both ends checked in `_beforeTokenTransfer`).
  - paused blocks all (mint/burn/transfer) revert `paused`.
  - owner exempt? No — owner must also be eligible (strict Cleanverse); test both ways.
- warp expiry: after `verifiedUntil` expires, transfer fails until `markVerified` refresh.

## Node.js E2E (not in this PR — separate plan)
- `scripts/go-pass/` hub+mirror deploy, fork against `https://rpc.cc3-testnet.creditcoin.network` + `sepolia` via `viem`.
  1. `1_deploy_hub.ts` GOPass on CC3 102031
  2. `2_deploy_mirror.ts` GOPassMirror on Sepolia with `GOPASS_ADDR`, `setWorker`
  3. `3_mint.ts` hub `mint(0x2c1A…, tier10 US|SG)` → indexer watches `PassMinted`
  4. `4_worker_sync.ts` off-chain `eth_getProof(GOPass, slot)` + `PrecompileChainInfoProvider` continuityLen=2 → `mirror.markVerified`
  5. `5_gtoken.ts` deploy GToken `rule {allowed_group "", min_tier 10, countries US,SG}` → `mint/transfer` success for eligible, fail for frozen/untracked
  6. `6_invalidate.ts` hub `setFrozen(true)` → worker `invalidate` → transfer reverts `PassNotEligible`, AI inbox `Transfer Rejected`
- Full test = `pnpm go-pass:e2e` runs 1-6 sequentially, asserts on-chain `isEligibleCached` + `GToken` balances.
