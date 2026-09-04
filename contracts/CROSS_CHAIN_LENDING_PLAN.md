# Cross-Chain Lending Plan — Morpho Split via Attestcoin (0x0FD2) — v3

## Objective
RWA GToken on source chain (ETH Sepolia 11155111, chainKey 1; mainnet later) as collateral, USDC on Creditcoin CC3 (102031) as loan. No mint, no wrapped transfer. Morpho core intact; collateral accounting split across chains. Liquidation = credit-based (Option A).
**Trust model: ETH→CC — fully trustless (canonical Attestcoin ASC pattern): 0x0FD2 verifySingle + on-chain decode of encodedTransaction (tx + receipt data) validating `status == success` and `SourceVault.Locked` event fields. CC→ETH — trusted worker (unlock/seize settlement).** CoreVault is our ASC; `2_lend_e2e.ts` is the Oracle Query Worker (docs provisioning steps 3a–3c); submission permissionless.

## Vendored Morpho (from kilolend-v2) — 3 small patches
Copy `C:\projects\kilolend-v2\contracts\src\Morpho.sol:1` → `attestgo-project/contracts/src/Morpho.sol`, then:
1. `address public remoteCollateralManager; setRemoteCollateralManager() onlyOwner` — set to CoreVault.
2. `supplyRemoteCollateral(MarketParams mp, uint256 assets, address onBehalf)` — require `msg.sender == remoteCollateralManager`; `position[id][onBehalf].collateral += assets`; **no token transfer** (vendored `supplyCollateral` does `safeTransferFrom` — kilolend Morpho.sol:301 — which we do NOT use for remote markets). Emit `SupplyRemoteCollateral`.
3. `withdrawRemoteCollateral(mp, assets, onBehalf)` — only remoteCollateralManager; decrement + `_isHealthy` check; no transfer.
4. `liquidate` remote branch: if `remoteCollateralManager != 0 && msg-sender-agnostic && market is remote` (flag via `isRemoteMarket[id]` set by manager) → after debt math + bad-debt logic, **skip** `IERC20(collateralToken).safeTransfer(msg.sender, seizedAssets)` (kilolend Morpho.sol:389); instead emit `RemoteCollateralSeized(id, borrower, msg.sender, seizedAssets)` and call `IRemoteCollateralManager(remoteCollateralManager).onRemoteSeized(id, borrower, msg.sender, seizedAssets)`. Everything else (health check, incentive factor, bad debt) unchanged.
Plain non-remote markets behave exactly as kilolend-v2.

## Contracts (all in `attestgo-project/contracts`)

### 1. `src/Morpho.sol` (CC 102031) — vendored + patches above
Market = one supply token (USDC_CC) + one collateral token (GToken mirror, identity/compliance marker). `lltv 0.62e18`. JumpRateIrm + PriceOracle from `src/unused/`.

### 2. `src/SourceVault.sol` (Sepolia 11155111) — escrow only, cumulative accounting
- `owner worker`; `lockedTotal(recipient, token)`; `unlockedTotal(recipient, token)`; `nonce`; `Lock {amount, marketId}` per lockId for traceability.
- `lock(recipient, collateralToken, amount, marketId, nonce)` → require `nonce == vault nonce` (calldata-complete, enables on-chain RLP lockId recomputation), escrow, `lockId = keccak256(abi.encode(block.chainid, collateralToken, recipient, amount, marketId, nonce))`, `nonce++`, `lockedTotal += amount`, emit `Locked(lockId, recipient, collateralToken, amount, marketId, nonce, blockNumber)` — this **tx** is the 0x0FD2 proof payload.
- `unlock(recipient, collateralToken, amount) onlyWorkerOrOwner` → require `lockedTotal - unlockedTotal >= amount` (amount-based, FIFO across multiple locks), `unlockedTotal += amount`, `safeTransfer(recipient)` emit `Unlocked`. No Morpho logic.

### 3. `src/CoreVault.sol` (CC 102031) — verifier + Morpho facade + claims
- State: `morpho` `worker owner` `BLOCK_PROVER = 0x0FD2` `SOURCE_CHAIN_KEY = 1` `sourceVault` `isProofUsed(lockId)` `sourceToCreditcoinToken(sourceCollateral → mirrorGToken)` `isRemoteMarket(id)` `claims(liquidator)`.
- Struct `CrossChainLockProof { lockId, sourceCollateral, amount, recipient, marketId, nonce, headerNumber, txBytes, merkleRoot, siblings, lowerDigest, roots }` (same shape as `syncPassWithTxProof` args, `GOPassRegistry.sol:84`).
- `verifyAndSupplyCollateral(p, mp)` — **permissionless** (canonical Phase 4 Data Extraction pattern; docs: validate "receipt status = success, expected event found" from verified bytes):
  `require !isProofUsed[p.lockId]`; `require mp.collateralToken == sourceToCreditcoinToken[p.sourceCollateral]`; `require MarketParamsLib.id(mp) == p.marketId`;
  if `block.chainid != 31337` → 0x0FD2 `verifySingle(SOURCE_CHAIN_KEY, ...)` (skip on anvil, `GOPassRegistry.sol:71` pattern);
  **On-chain decode (Phase 4)**: RLPReader decode `p.txBytes` (encodedTransaction = tx + receipt data) → require receipt `status == 1` (inclusion alone doesn't prove success) → find `Locked(lockId, recipient, collateralToken, amount, marketId, nonce, ...)` log **emitted by sourceVault** → require fields == p fields and `lockId == p.lockId` (SourceVault.lock takes explicit `nonce`, enforced == vault nonce, so lockId fully determined by calldata).
  `isProofUsed[p.lockId] = true`; `isRemoteMarket[id(mp)] = true`; `morpho.supplyRemoteCollateral(mp, p.amount, p.recipient)`; emit `CollateralSupplied`.
  Impl note: verify exact encodedTransaction RLP layout from `@gluwa/usc-sdk getProof` response (legacy/EIP-1559 + receipt encoding) on day 1; if SDK payload lacks receipt data, fall back to calldata-parse binding + worker status check (worker-gated) until receipt proofs land.
- `onRemoteSeized(id, borrower, liquidator, assets)` — only callable by morpho; `claims[liquidator] += assets`; emit.
- Passthrough `supply` `borrow` `repay` (+ optional per-market KYC gate: `GOPassMirror.isEligible(borrower, rule)` in `borrow`) — local, health via oracle + lltv; suppliers earn as plain Morpho.
- `requestUnlock(mp, amount)` — position owner after repay: `morpho.withdrawRemoteCollateral(mp, amount, msg.sender)` then emit `UnlockRequested(recipient=msg.sender, collateralToken, amount, marketId)`.
- `requestLiquidationPayout(amount)` — liquidator: require `claims[msg.sender] >= amount`, decrement, emit `UnlockRequested(recipient, ...)` → same worker path; real GToken sent to liquidator on Sepolia.
- Pause: `paused` blocks `verifyAndSupplyCollateral` + `borrow` + unlock *requests*; repay/withdrawCollateral passthrough stay open (users can always exit).
- Unlock granularity: worker settles `UnlockRequested` via `SourceVault.unlock(recipient, token, amount)` cumulative FIFO.

## Worker Scripts (`scripts/lending/`)
- `1_lend_setup.ts` — deploy checks, setSourceTokenMapping, createMarket, fund/supply USDC.
- `2_lend_e2e.ts` — `lock` on Sepolia → ProofBuilder proof (reuse `3_worker_sync.ts:86-113`) → verify tx content off-chain → `verifyAndSupplyCollateral` → `borrow` → `repay` → `requestUnlock`.
- `3_worker_unlock.ts` — trusted worker (adapted from `8_worker_vault.ts:77-155` poll loop): poll `UnlockRequested` on CC → call `SourceVault.unlock(recipient, token, amount)` on Sepolia. Handles both borrower unlocks and liquidation payouts.
- Liquidation demo: unhealthy position → anyone `liquidate` on CC → `onRemoteSeized` credits claims → liquidator `requestLiquidationPayout` → worker unlocks real RWA on Sepolia to liquidator.

## Files to Create
`src/Morpho.sol` (vendored + 4 patches) · `src/SourceVault.sol` · `src/CoreVault.sol` · `src/irm/JumpRateIrm.sol` + `src/PriceOracle.sol` (promoted from kilolend-v2) · `script/{5_DeployMorpho,6_DeployOracle,7_DeployIrm,8_DeployCoreVault,9_DeploySourceVault}.s.sol` · `test/CrossChainLending.t.sol` — 13 tests: lock escrow + nonce, verifySupply credits remote position, replay reverts, supply USDC, borrow healthy/unhealthy, repay + requestUnlock, worker unlock FIFO, liquidate credits claims (no token transfer), onlyWorkerOrOwner/onlyMorpho reverts, pause semantics, access control · `scripts/lending/{1_lend_setup,2_lend_e2e,3_worker_unlock}.ts`.

## Deploy Order (scripts are granular + idempotent; unset ADDR env = deploy, set = reuse)
1. CC `5_DeployMorpho` — Morpho core (owner = deployer).
2. CC `6_DeployOracle` — `PriceOracle` bound to the collateral/loan pair (fallback USD prices at deploy; feeds attachable later).
3. CC `7_DeployIrm` — `JumpRateIrm` (2%/8% yearly, 40% jump, kink 80% defaults).
4. CC `8_DeployCoreVault` — validates all upstream addresses (code present + `price()`/`borrowRateView()` succeed) BEFORE broadcasting, then deploys `CoreVault`, wires `setRemoteCollateralManager` + `setSourceTokenMapping`, enables lltv/irm, creates the market (USDC / mirror GToken, lltv 0.62e18). `IRM_ADDR` unset = zero-rate market.
5. Sepolia `9_DeploySourceVault` — collateral escrow (worker = CC→ETH settler).
6. Sepolia GToken RWA (`3_DeployGToken.s.sol`) + CC mirror GToken (via `GTokenFactory`).
7. Fund + supply USDC (`scripts/lending/1_lend_setup.ts`).
8. E2E: `lock 10 RWA` → proof → `verifyAndSupplyCollateral 10` → `borrow 6 USDC` → `repay` → `requestUnlock` → worker `unlock`; liquidation path separately.

## Hardening Backlog (v2, non-blocking)
- Confirm SDK `getProof` encodedTransaction includes receipt data (docs say yes); else calldata-parse fallback (already specified in CoreVault impl note).
- PriceOracle fallback staleness: `price()` fallback mode ignores `lastPriceUpdateTime` (PriceOracle.sol:91-99) — add freshness check.
- Unlock timelock for RWA T+ settlement; multi-worker quorum.
- KYC rule per market wired into `borrow` passthrough (identity differentiator).
