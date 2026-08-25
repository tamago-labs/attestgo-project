# Plan: GO Pass — Soulbound NFT + Registry on Creditcoin, Verified Anywhere via Attestcoin

## 0) Decisions (from you)
- **Option A hybrid accepted:** single source on Creditcoin, verify on dest via Attestcoin prover. **+ soulbound ERC-721** on same contract (not replica). **Adopt `Advance` pattern over simple `AttestStream`/`payStream`**: i.e. hub registry + dest mirror + off-chain worker `markVerifed` (like `AdvanceManager.markAdvanceAsFunded`) not pure on-chain `EvmV1Decoder`/single burn event.
- 10min prover lag OK — mitigated by **AI inbox** + **A+B cache sync** (once per wallet, not per transfer). `continuityLen=2` (≈30-60s) not 1000 (≈10m) for sync. Relayer `B` is the `Advance` worker.
- Reuse **Attestcoin USC infra** maximally: `0x0FD2 BlockProver` + `0x0FD3 ChainInfo`, `@gluwa/usc-sdk 0.18.0` prover, `SOURCE_CHAIN_KEY` pattern from `WrappedASTR/AttestStream`, **but worker does `safeQuery` off-chain proof like `scripts/loan-flow/2_worker.ts`** rather than on-chain decoder (keeps `0.8.19 + OZ 4.9.6` compatible, as `AdvanceManager.sol:9` comment).
- `Pass` must be visible NFT (wallet shows it, `Products.tsx:58` card `tokenURI` + `public/pass-qr.png`).
- `Authorized minter = Tamago/AttestGO operator` (`Ownable` EOA → later `multisig`) — `worker` role separate from `owner` like `AdvanceManager.worker`.

## 1) Architecture — `Advance`-style (not simple `AttestStream.payStream`)
```
// AttestStream = simple burn + event, 1 mapping, no sigs — wrong for compliance lifecycle.
// Advance = hub register + sigs + worker markFunded/markRepaid + auxiliary token vault — right model for GO Pass:
//   hub = source of truth, dest = mirror, lifecycle = Create→Verified→Frozen/Expired, worker verifies off-chain.

Creditcoin (hub, chainId 102031 testnet) — like `AdvanceManager` source side but simpler
  GOPass.sol (ERC721 soulbound + registry)  // = `AttestStream` + `AdvanceTypes.Record` dual flow
    mapping(address => bytes32 recordHash)  // 1 slot/wallet — single storage proof (for worker to query)
    mapping(address => Record) _records     // off-chain view, hash is commitment
    tokenId = uint160(wallet) 1:1 wallet:pass  // soulbound, _beforeTokenTransfer revert like Advance plain NFT
    events PassMinted/PassUpdated/PassFrozen (worker watches, like StreamPayment/StreamCreated:66)

Destination (Ethereum Sepolia/Base/…) — like `AdvanceManager` dest side but for identity
  GOPassMirror.sol (was GOPassVerifier) — **A+B cache, AdvanceManager pattern**
    mapping(address => Record) public cached; mapping(address => uint64) public verifiedUntil
    mapping(address => bool) public isVerified; // like registeredAdvances
    address public worker; // like AdvanceManager.worker, onlyWorkerOrOwner can markVerified (off-chain proof)
    function markVerified(address wallet, Record calldata r) external onlyWorkerOrOwner // B) relayer push — worker did safeQuery off-chain
    function syncPass(address wallet, Record calldata r, bytes calldata proof) external // A) user pull — on-chain proof path (fallback if worker down)
    function isEligibleCached(address wallet, Rule rule) view // like getAdvanceOrder, checks cached tier/bitmap/expiry/frozen
    function invalidate(address wallet) external onlyWorkerOrOwner // freeze propagation like markAdvanceAsExpired
  GToken.sol (RWA, example USD T-Bill) — like `AuxiliaryAdvance` token vault but for RWA
    beforeTransfer checks `mirror.isEligibleCached(to, rule)` — reverts PassNotSynced if not cached/expired (like AuxiliaryAdvance.validateFlow)

Off-chain Worker — like `scripts/loan-flow/2_worker.ts` + `cross-chain-bridge/2_worker.ts`
  Attestcoin prover `https://prover.cc3-testnet.creditcoin.network` (continuityLen=2 for sync)
  worker safeQuery: eth_getProof(GOPass, slot) on CC3 → verify continuityLen → call mirror.markVerified (sponsored, gas ~40k, no on-chain decoder)
  Indexer + AI inbox + Relayer (B):
    on `PassMinted` → DB `pending` → inbox `KYC Approved — Pending verification (~1m, 0x2c1A…8b4f Syncing…)`
    worker polls prover (len=2) until ready → relayer auto markVerified on Sepolia/Base → DB `verified` → inbox `Ready to Receive — Verified 09/29`
    If user tries Send before auto-sync, UI offers A) `Sync my Pass` manual on-chain proof pull (fallback)
```

Why **hash-commitment single slot + worker** (Advance style): `AttestStream`/`payStream` does on-chain burn + event only; good for 1-shot stream. `AdvanceManager` adds `AdvanceOrder/Terms + sigLender/sigBorrower + worker markFunded + deadlineBlockNumber` to handle **lifecycle + off-chain verification without EvmV1Decoder** (`AdvanceManager.sol:9` comment: avoids `USCBase/prevrandao` incompat with `0.8.19`). GO Pass needs same: tier/bitmap/expiry/frozen lifecycle, revocation, cache TTL — so use worker pattern: proof is verified *off-chain* by worker (cheap), `markVerified` writes cache (≈40k gas once per wallet per 24h). Pure on-chain proof (`BlockProver.verifyStorageProof` in verifier) kept only as `A` fallback if worker is down (like Advance fallback to direct proof). Keeps `0.8.19 + OZ 4.9.6` and gas per transfer `~5k` (`isEligibleCached`). `_records` kept for `eth_call` UX but proven via hash.

## 2) Contracts

### 2.1 `contracts/src/GOPass.sol` (hub)
- Inherits `ERC721` (`solc 0.8.19`, `OZ 4.9.6`), soulbound: `_beforeTokenTransfer` revert if `from != address(0) && to != address(0)` (allow mint/burn only). Burn = `onlyOwner` for wallet rotation.
- `struct Record { uint8 tier; uint8 subTier; bytes2 group; bytes2 subGroup; uint256 countryBitmap; uint64 expiry; bool frozen; bytes32 customerIdHash; }` — off-chain `issuingCountryISO2 → bitmap` (e.g. `US=1<<0, SG=1<<1` mapping table to pin).
- `mapping(address => Record) private _records;` + `mapping(address => bytes32) public recordHash;` + `mapping(bytes32 => address) public hashToWallet` for customerId uniqueness.
- `function mint(address to, Record calldata r) external onlyOwner` — require `to != 0`, `tier 0-99`, `expiry > block.timestamp`, `recordHash[to]==0`, `_records[to]==empty`, `hashToWallet[r.customerIdHash]==0`; set `_records[to]=r; recordHash[to]=keccak256(abi.encode(r)); hashToWallet[hash]=to; _mint(to, uint160(to))`.
- `function update(address wallet, Record calldata r) / freeze(address,bool) / setExpiry(address,uint64)` `onlyOwner` — update both mappings, emit `PassUpdated(wallet, recordHash)`.
- `function burn(address wallet) onlyOwner` — delete mappings, `_burn(uint160(wallet))`.
- `tokenURI` → `baseURI + tokenId` JSON with `tier/countryBitmap/expiry` + image `pass-qr.png` style; no PII. Or `data:application/json;base64` on-chain.
- Events: `PassMinted(address indexed wallet, uint256 indexed tokenId, bytes32 recordHash, uint64 expiry)` etc. Indexer depends on these.

### 2.2 `contracts/src/GOPassMirror.sol` (dest) — Advance-style mirror (rename from Verifier)
- Immutable `CREDITCOIN_CHAIN_ID`, `GOPASS_ADDR`, `CACHE_TTL = 24h`, `BLOCK_PROVER=0x0FD2` kept only for fallback `A`.
- `mapping(address => Record) public cached; mapping(address => uint64) public verifiedUntil; mapping(address => bool) public isVerified;` — like `AdvanceManager.registeredAdvances` + `AdvanceOrder`.
- `address public worker; function setWorker(address) onlyOwner` — like `AdvanceManager.setWorker`, separates `owner (Tamago)` from `worker (relayer EOA)`.
- `function markVerified(address wallet, Record calldata r) external onlyWorkerOrOwner` — **B path (primary, Advance pattern)**: worker has already done off-chain `eth_getProof` + `continuityLen=2` check (like `loan-flow/2_worker.ts:safeQuery`), no on-chain decoder, just `require(r.expiry > block.timestamp && !r.frozen)`, `cached[wallet]=r; verifiedUntil=now+CACHE_TTL; isVerified[wallet]=true; emit PassSynced`. Gas `~40k`, trust is worker key (same as Advance).
- `function syncPass(address wallet, Record calldata r, bytes calldata proof) public` — **A path (fallback, pure proof)**: `slot = keccak256(abi.encode(wallet, RECORD_HASH_SLOT))`, `BlockProver.verifyStorageProof` → `onChainHash == keccak256(abi.encode(r))` (kept if worker down or user wants self-sovereign sync). Also updates cache. Callable by anyone.
- `function invalidate(address wallet) external onlyWorkerOrOwner` / `freeze` — like `AdvanceManager.markAdvanceAsExpired`, clears `verifiedUntil`/`isVerified` for `update_status(freeze=2)`.
- `function isEligibleCached(address wallet, Rule calldata rule) public view returns (bool)` — reads `cached`, requires `isVerified && block.timestamp < cached.expiry && !cached.frozen && block.timestamp < verifiedUntil` then `tier>min_tier`, `group` match, `countryBitmap` is_black_list logic (mirrors Cleanverse `is_black_list + countries`). Cost `~5k`. Like `AuxiliaryAdvance.isTokenAuthorized` gate but for identity.
- Gas: `markVerified` once per wallet per `24h` `~40k` (worker sponsored); `syncPass` `~60-90k` only if fallback; `isEligibleCached` every RWA transfer `~5k`; first transfer waits `~30-60s` hidden by AI inbox `Syncing…`.

### 2.3 `contracts/src/GToken.sol` (example RWA, reference) — like `AuxiliaryAdvance` vault
- Minimal `ERC20` with `Rule rule` storage set by `admin_address` (like `atoken/launch.admin_address` → grants `MINTER_ROLE`). `beforeTransfer` calls `mirror.isEligibleCached(to, rule)` — if `!isVerified` or `verifiedUntil expired` or `frozen` → revert `PassNotSynced()` with hint `call syncPass/markVerified first`; UI catches and offers `Sync my Pass` (same as `AuxiliaryAdvance.validateFlow` revert `Token not authorized`).
- `Rule { bytes2 allowed_group; bytes2 allowed_sub_group; uint8 min_tier; uint8 min_sub_tier; bool is_black_list; uint256 countriesBitmap }` matching `atoken/launch.rule` + helper `CountryBitmap.sol`; `GToken` stores `GOPassMirror` address immutably like `AuxiliaryAdvance.authorizedTokens`.

## 3) Storage & Bitmap
- **Slot packing:** `RECORD_HASH_SLOT` is base slot of `recordHash` mapping (foundry `vm.getMappingSlot`). Allocation minimal.
- **Country bitmap table** to freeze in `lib/CountryBitmap.sol:1` — e.g. `US=0, SG=1, JP=2…` sorted ISO2 list; helper `iso2ToBit(string)`.
- **Tier:** 0-99 (Cleanverse `min_tier 0-99`), recommend AttestGO tiers: `1 = basic KYC`, `10 = verified (matches Products.tsx:1 rule min_tier 10)`, `30 = institutional`.

## 4) Attestcoin Reuse
- Keep `contracts/foundry.toml` `evm_version london`, `via_ir true`, chain RPC `https://rpc.cc3-testnet.creditcoin.network`.
- Reuse `scripts/cross-chain-bridge/1_check_chains.ts` chain check, `2_worker.ts` proof fetch, `4_fund.ts` funding pattern + `loan-flow/2_worker.ts` safeQuery+sign pattern for worker. New scripts `scripts/go-pass/1_deploy_gopass.ts` `2_mint.ts` `3_sync.ts` (off-chain getStorageProof continuityLen=2 → call `markVerified` as worker, fallback to `syncPass`) `4_check.ts`.
- Prover API same `creditcoin.getStorageProof(GOPassAddr, [slot], blockNumber)` → `proof` with `continuityLen=2` for B worker path; A fallback verifies on-chain via `0x0FD2` if needed. Like Advance, no on-chain `EvmV1Decoder` to keep `0.8.19` compatible.

## 5) Off-chain / AI Inbox + Relayer (A+B) — worker like `AdvanceManager.worker`
- Indexer watches `PassMinted/Updated` on CC3 → DB `status=pending`. Immediate AI inbox: `KYC Approved — Syncing pass to Ethereum (~1m, 0x2c1A…8b4f)`.
- Worker (relayer EOA = `AdvanceManager.worker`) polls `prover` `continuityLen=2` until ready → does off-chain `safeQuery` (no on-chain decoder) → calls `mirror.markVerified(wallet, r)` on Sepolia/Base (sponsored gas) → `PassSynced` → DB `verified` → inbox `Ready to Receive — Verified 09/29` (as `Inbox.tsx:48`). This is `AdvanceManager.markAdvanceAsFunded` pattern.
- If user taps `Send` before auto-sync: UI calls A) `syncPass` manual pull with on-chain proof (fallback, trustless) as `AuxiliaryAdvance` direct user `fundAdvance` alternative.
- `update_status` (freeze=2) → indexer calls `mirror.invalidate(wallet)`/`markVerified` with `frozen=true` (like `markAdvanceAsExpired`) → `isEligibleCached` fails → `GToken` transfer reverts; AI inbox `Transfer Rejected — Country Not Allowed` as in `Inbox.tsx:48`.

## 6) Deployment Order
1. `GOPass` on Creditcoin testnet (`102031`) via `forge script 1_DeployGOPass.s.sol` `onlyOwner = Tamago EOA`.
2. `GOPassMirror` on Sepolia + Base (param `GOPassAddr` + `CC3 chainId`, `CACHE_TTL=24h`) — set `worker` to relayer EOA (like `AdvanceManager.setWorker`).
3. `GToken` USD T-Bill example on Sepolia with `rule {allowed_group "", min_tier 10, countries [US,SG], is_black_list false}` matching `Products.tsx:134` — uses `mirror.isEligibleCached`.
4. E2E test: `mint 0x2c1A…8b4f tier 10 bitmap US|SG` → relayer auto `markVerified` (~1m off-chain) → `GToken.mint`/`transfer` uses cached (no proof), `transfer` to non-eligible/frozen fails; manual `syncPass` proof pull also tested as fallback.

## 7) Risks & Mitigations
- Proof lag → A+B cache: lag once per wallet (~1m with len=2), then cached 24h; AI inbox shows `Syncing…` not per-transfer wait.
- Storage proof version mismatch (CC3 `london` vs dest) → pin `evm_version london` already.
- Soulbound transfer attempts → revert + UI hide `Send` button.
- Operator key compromise → `Ownable` → migrate to `Gnosis Safe` multisig, add `pendingOwner` 2-step.
- Relayer liveness → fallback A manual pull; relayer funded via `scripts/go-pass/fund-relayer.ts`.

## 8) Open Questions for you (before code)
1. **Expiry default?** 1 year (`2027-08-25`) like `generate_apass.expirationTime` 3 years, or 2 years?
2. **Tier thresholds?** Keep Cleanverse `0-99` and map Sumsub `tier 1/3/9` to AttestGO `1/10/30`?
3. **Country bitmap source of truth?** Use ISO2 list from `cleanverse-docs.txt:164` (2-letter uppercase) — confirm allowed set `["US","SG"]` base rule or broader?
4. **tokenURI image?** Reuse `public/pass-qr.png` 1327B QR + on-chain SVG (`attestGO` pill) or IPFS via `baseURI`?
5. **Wallet rotation?** Allow user to `burn old + mint new` same `customerIdHash` (override) or keep 1 wallet forever?
6. **Cache window?** `CACHE_TTL=24h` in `GOPassVerifier.cached` — ok or prefer `1h`/`7d`? Longer = fewer syncs, shorter = faster freeze propagation.
