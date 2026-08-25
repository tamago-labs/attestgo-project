# Plan: GO Pass Scripts — forge deploy + `scripts/gopass` node workers

## Forge deploy scripts (`contracts/script/`, `0.8.19`, `forge script --broadcast`)
Keep pattern from `contracts/script/unused/3_DeployAttestStream.s.sol` + `1_DeployMockTokens.s.sol`: `vm.startBroadcast`, env PK, chain RPC.

- `contracts/script/1_DeployGOPass.s.sol` — hub on Creditcoin `102031` (testnet) / `102030` mainnet. Deploys `GOPass` with `baseURI https://attestgo.test/pass/` (or IPFS). `onlyOwner = msg.sender` (Tamago EOA, later Safe). Writes `broadcasts/1_DeployGOPass/<chainId>/run-latest.json` + echo address for `GOPassMirror` param.
- `contracts/script/2_DeployGOPassMirror.s.sol` — dest on Sepolia (`11155111`), Base Sepolia (`84532`), etc. Args `GOPASS_ADDR` + `CREDITCOIN_CHAIN_ID` (from #1). Deploys `GOPassMirror`, calls `setWorker(workerEOA)` + `setCacheTTL(24h)`. One file per dest, use `--chain sepolia` flag or env `GOPASS_ADDR`.
- `contracts/script/3_DeployGToken.s.sol` — dest `GToken` USD T-Bill example on Sepolia. Args `MIRROR_ADDR`, `Rule{allowed_group "", min_tier 10, countries US,SG}` (bitmap via `CountryBitmap.bitmapForTwo("US","SG")`), `icon https://…`. Deploys, `transferOwnership` to `admin`.

Env: `PRIVATE_KEY`, `CREDITCOIN_RPC_URL https://rpc.cc3-testnet.creditcoin.network`, `SEPOLIA_RPC_URL`, `GOPASS_ADDR`, `MIRROR_ADDR`.

## Node scripts (`scripts/gopass/`, reuse `@gluwa/usc-sdk` + `viem` like `cross-chain-bridge/`+`loan-flow/`)
New folder `scripts/gopass/` (parallel to `cross-chain-bridge`/`loan-flow`), `tsconfig` excluded already (`tsconfig.json:26` scripts excluded), `package.json` `tsx` runner.

- `1_check_chains.ts` — verify `CC3 102031` + `Sepolia 11155111` RPCs, `PrecompileChainInfoProvider` (like `cross-chain-bridge/1_check_chains.ts`), print `GOPass`/`Mirror` code existence.
- `2_mint.ts` — hub `mint` via `viem` `writeContract` `GOPass.mint(alice, Record{tier10, bitmap US|SG, expiry +365d, customerIdHash})` with `PK_OWNER`. Emits `PassMinted`, prints `recordHash`. Args `WALLET=0x2c1A…` `TIER=10` `COUNTRIES=US,SG`.
- `3_worker_sync.ts` — **Advance worker** like `loan-flow/2_worker.ts:safeQuery` + `cross-chain-bridge/5_worker.ts`. Does `eth_getProof(GOPass, keccak(wallet, slot))` on CC3, `PrecompileChainInfoProvider` continuityLen=2, then `mirror.markVerified(wallet, Record)` as `WORKER_PK` (B path, sponsored). Fallback to `syncPass` with proof if worker key not set. Polls until `verified`.
- `4_check_eligible.ts` — view `mirror.isEligibleCached(wallet, rule)` + `mirror.getCached`, prints AI inbox style `Ready to Receive` or `Pending`.
- `5_gtoken_mint.ts` — `GToken.mint(to, amount)` gated check, demonstrates `PassNotEligible` revert for untracked wallet vs success for verified.
- `6_freeze.ts` — hub `setFrozen` + worker `mirror.invalidate`, verifies `isEligibleCached` now false and `GToken.transfer` reverts.

## Execution order
Forge first (once per chain): `forge script 1_DeployGOPass --rpc-url $CREDITCOIN_RPC_URL --broadcast` → `2_DeployGOPassMirror --rpc-url $SEPOLIA_RPC_URL` → `3_DeployGToken`. Node after: `pnpm tsx scripts/gopass/2_mint.ts` → `3_worker_sync.ts` (~1m) → `4_check_eligible.ts` → `5_gtoken_mint.ts` → `6_freeze.ts`.

## Notes
- No on-chain `EvmV1Decoder` — worker does off-chain proof like `AdvanceManager` (keeps `0.8.19`). `syncPass` fallback keeps `0x0FD2` staticcall for self-sovereign sync.
- Keep `scripts/gopass/README.md` like `cross-chain-bridge/README.md` with env table and one-liner `pnpm gopass:e2e`.
