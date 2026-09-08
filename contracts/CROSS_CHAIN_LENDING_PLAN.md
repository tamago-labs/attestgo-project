# Cross-Chain Lending Plan — Morpho Split via Attestcoin (0x0FD2) — v3

## Objective
RWA GToken on source chain (ETH Sepolia 11155111, chainKey 1; mainnet later) as collateral, USDC on Creditcoin CC3 (102031) as loan. No mint, no wrapped transfer. Morpho core intact; collateral accounting split across chains. Liquidation = credit-based (Option A).
**Trust model: ETH→CC — fully trustless (canonical Attestcoin ASC pattern): 0x0FD2 verifySingle + on-chain decode of encodedTransaction (tx + receipt data) validating `status == success` and `SourceVault.Locked` event fields. CC→ETH — trusted worker (unlock/seize settlement).** CoreVault is our ASC; submission permissionless.

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
- `lock(recipient, collateralToken, amount, marketId, nonce)` → require `nonce == vault nonce` (calldata-complete, enables on-chain lockId recomputation), escrow, `lockId = keccak256(abi.encode(block.chainid, collateralToken, recipient, amount, marketId, nonce))`, `nonce++`, `lockedTotal += amount`, emit `Locked(lockId, recipient, collateralToken, amount, marketId, nonce, blockNumber)` — this **tx** is the 0x0FD2 proof payload.
- `unlock(recipient, collateralToken, amount) onlyWorkerOrOwner` → require `lockedTotal - unlockedTotal >= amount` (amount-based, FIFO across multiple locks), `unlockedTotal += amount`, `safeTransfer(recipient)` emit `Unlocked`. No Morpho logic.

### 3. `src/CoreVault.sol` (CC 102031) — verifier + Morpho facade + claims
- State: `morpho` `worker owner` `BLOCK_PROVER = 0x0FD2` `SOURCE_CHAIN_KEY = 1` `sourceVault` `isProofUsed(lockId)` `sourceToCreditcoinToken(sourceCollateral → mirrorGToken)` `isRemoteMarket(id)` `claims(liquidator)`.
- Struct `CrossChainLockProof { lockId, sourceCollateral, amount, recipient, marketId, nonce, headerNumber, txBytes, merkleRoot, siblings, lowerDigest, roots }` (same shape as `syncPassWithTxProof` args, `GOPassRegistry.sol:84`).
- `verifyAndSupplyCollateral(p, mp)` — **permissionless** (canonical log extraction pattern: validate "expected event found" from verified bytes):
  `require !isProofUsed[p.lockId]`; `require mp.collateralToken == sourceToCreditcoinToken[p.sourceCollateral]`; `require MarketParamsLib.id(mp) == p.marketId`;
  if `block.chainid != 31337` → 0x0FD2 `verifySingle(SOURCE_CHAIN_KEY, ...)` (skip on anvil, `GOPassRegistry.sol:71` pattern);
  **On-chain decode**: the encodedTransaction is the ProofBuilder's **ABI-encoded (transaction, receipt) blob** (confirmed against the live CC3 precompile + SDK output). Word-scan the blob for the `Locked` log pattern `[emitter, offTopics, offData, topicCount=4, topic0, topic1..3, dataLen=96, amount, marketId, nonce]` → require log **emitted by sourceVault** AND the tx head (fixed-shape ABI words preceding the calldata section) to target sourceVault — a forged log pattern inside calldata of a tx not calling SourceVault is thereby rejected. Receipt `status == 1` is implied by log presence (a reverted tx emits no events). Require fields == p fields and `lockId == p.lockId` (SourceVault.lock takes explicit `nonce`, enforced == vault nonce, so lockId fully determined by calldata).
  `isProofUsed[p.lockId] = true`; `isRemoteMarket[id(mp)] = true`; `morpho.supplyRemoteCollateral(mp, p.amount, p.recipient)`; emit `CollateralSupplied`.
  Impl note (resolved): SDK `getProof` `txBytes` must be passed to the precompile **verbatim** — any re-encoding (RLP or otherwise) fails `verifySingle` with "Merkle proof validation failed". Scripts must never rebuild it (see `scripts/lending/2c_prove_and_borrow.ts` + `probe_proof.ts`).
- `onRemoteSeized(id, borrower, liquidator, assets)` — only callable by morpho; `claims[liquidator] += assets`; emit.
- Passthrough `supply` `borrow` `repay` (+ optional per-market KYC gate: `GOPassMirror.isEligible(borrower, rule)` in `borrow`) — local, health via oracle + lltv; suppliers earn as plain Morpho.
- `requestUnlock(mp, amount)` — position owner after repay: `morpho.withdrawRemoteCollateral(mp, amount, msg.sender)` then emit `UnlockRequested(recipient=msg.sender, collateralToken, amount, marketId)`.
- `requestLiquidationPayout(amount)` — liquidator: require `claims[msg.sender] >= amount`, decrement, emit `UnlockRequested(recipient, ...)` → same worker path; real GToken sent to liquidator on Sepolia.
- Pause: `paused` blocks `verifyAndSupplyCollateral` + `borrow` + unlock *requests*; repay/withdrawCollateral passthrough stay open (users can always exit).
- Unlock granularity: worker settles `UnlockRequested` via `SourceVault.unlock(recipient, token, amount)` cumulative FIFO.

## Worker Scripts (`scripts/lending/`)
- `1_lend_setup.ts` — deploy checks, setSourceTokenMapping, createMarket, fund/supply USDC.
- `2a_supply_liquidity.ts` — supplier: approve + supply USDC into a market.
- `2b_lock_collateral.ts` — borrower: lock RWA on Sepolia (records lockId).
- `2c_prove_and_borrow.ts` — submit proof (SDK `txBytes` verbatim) → collateral credited → borrow (`--borrow-only` skips proof).
- `2d_repay_and_unlock.ts` — repay + `requestUnlock` (worker settles on Sepolia).
- `3_worker_unlock.ts` — trusted worker: poll `UnlockRequested` on CC → call `SourceVault.unlock(recipient, token, amount)` on Sepolia. Handles both borrower unlocks and liquidation payouts.
- `probe_proof.ts` / `probe2_txbytes.ts` — proof-format diagnostics (Attestcoin precompile ABI-blob format).
- `4_check_borrow_power.ts` — check borrow power for a given position.
- `5_fix_tbill_oracle.ts` / `6_setup_tbill_market.ts` — TBill market oracle setup.

## Files to Create
`src/Morpho.sol` (vendored + 4 patches) · `src/SourceVault.sol` · `src/CoreVault.sol` · `src/irm/JumpRateIrm.sol` + `src/PriceOracle.sol` (promoted from kilolend-v2) · `script/{5_DeployMorpho,6_DeployOracle,7_DeployIrm,8_DeployCoreVault,9_DeploySourceVault}.s.sol` · `test/CrossChainLending.t.sol` · `scripts/lending/{1_lend_setup,2a_supply_liquidity,2b_lock_collateral,2c_prove_and_borrow,2d_repay_and_unlock,3_worker_unlock,probe_proof,probe2_txbytes}.ts`.

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
- Confirm SDK `getProof` encodedTransaction includes receipt data; else calldata-parse fallback (already specified in CoreVault impl note).
- PriceOracle fallback staleness: `price()` fallback mode ignores `lastPriceUpdateTime` (PriceOracle.sol:91-99) — add freshness check.
- Unlock timelock for RWA T+ settlement; multi-worker quorum.
- KYC rule per market wired into `borrow` passthrough (identity differentiator).
