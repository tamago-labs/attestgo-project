# AttestGO Contracts

Foundry workspace for AttestGO's onchain stack: GO Pass identity (hub/mirror), RWA tokens with
self-enforcing rules, and a Morpho-based lending market on Creditcoin whose collateral is proven
cross-chain via the [Attestcoin Protocol](https://docs.attestcoin.org/attestcoin-protocol/attestcoin-readability).

**Chains**: Sepolia `11155111` (source chain, Attestcoin chainKey `1`) · Creditcoin CC3 `102031`
(testnet, mainnet `102030`) · any EVM for mirrors/GO Assets.

## Architecture

```
Sepolia (chainKey 1)                 Creditcoin (102031)
────────────────────                 ───────────────────────────────────────
GOPass (hub, pending→verified)  ─▶   GOPassRegistry (ASC, 0x0FD2 verifySingle
                                     + on-chain Phase 4 decode of PassMinted)
GToken (RWA) ─▶ SourceVault     ─▶   CoreVault (ASC) ─▶ Morpho market
             (escrow, lock)           verifyAndSupplyCollateral        (USDC loan /
                                     → remote collateral credit       RWA collateral)
      ▲                                   │ UnlockRequested
      └── unlock() ◀──────────────────────┘  (trusted worker, CC→ETH)
```

- **ETH → CC is trustless**: anyone submits a `CrossChainLockProof` (or pass sync) — the Block
  Prover Precompile (`0x0FD2 verifySingle`) proves tx inclusion + continuity, then the contract
  extracts the expected event log from the verified `encodedTransaction` (ABI-encoded
  transaction + receipt, as returned by the ProofBuilder) on-chain. Replay is
  blocked via `lockId` / record hash bindings.
- **CC → ETH uses a trusted worker** (`onlyWorkerOrOwner`): unlocks after repay, and liquidator
  claim payouts. See [`CROSS_CHAIN_LENDING_PLAN.md`](CROSS_CHAIN_LENDING_PLAN.md).

### Contracts

| Contract | Chain | Purpose |
|---|---|---|
| [`src/GOPass.sol`](src/GOPass.sol) | Sepolia | Soulbound KYC NFT hub; mints `active=false` until Creditcoin verifies |
| [`src/GOPassRegistry.sol`](src/GOPassRegistry.sol) | Creditcoin | Attestcoin Smart Contract: verifies hub mint txs (`0x0FD2` + on-chain Phase 4 log extraction), stores records, eligibility rules |
| [`src/GOPassMirror.sol`](src/GOPassMirror.sol) | Base / any EVM | Worker-synced record cache; GTokens check eligibility locally (~5k gas) |
| [`src/GToken.sol`](src/GToken.sol) | any chain | Compliant ERC20 gated by GOPass eligibility; native or wrapped 1:1 |
| [`src/GTokenFactory.sol`](src/GTokenFactory.sol) | any chain | Operator-paid issuance of native/wrapped GTokens |
| [`src/Morpho.sol`](src/Morpho.sol) | Creditcoin | Morpho Blue fork + remote-collateral patch (`supplyRemoteCollateral`, remote liquidate branch) |
| [`src/PriceOracle.sol`](src/PriceOracle.sol) | Creditcoin | Market oracle: fallback USD price + Chainlink-style feeds, staleness guard |
| [`src/irm/JumpRateIrm.sol`](src/irm/JumpRateIrm.sol) | Creditcoin | Compound-style jump rate IRM (immutable params) |
| [`src/SourceVault.sol`](src/SourceVault.sol) | Sepolia | RWA collateral escrow; `Locked` tx is the proof payload; cumulative FIFO unlocks |
| [`src/CoreVault.sol`](src/CoreVault.sol) | Creditcoin | ASC verifier + Morpho facade + liquidation claims ledger |

### Usage

```shell
forge build
forge test          # 40 tests
forge snapshot
forge fmt
```

### Deploy order

Each lending script deploys exactly one contract and reuses anything already deployed via its
`*_ADDR` env (unset = deploy, set = reuse). `8_DeployCoreVault` validates every upstream address
(code present, `price()` / `borrowRateView()` succeed) **before** broadcasting.

1. **Sepolia** — GO Pass hub: [`script/1_DeployGOPass.s.sol`](script/1_DeployGOPass.s.sol);
   RWA GToken: [`script/3_DeployGToken.s.sol`](script/3_DeployGToken.s.sol);
   collateral escrow: [`script/9_DeploySourceVault.s.sol`](script/9_DeploySourceVault.s.sol)
2. **Creditcoin** — registry: [`script/2_DeployGOPassRegistry.s.sol`](script/2_DeployGOPassRegistry.s.sol);
   mirror: [`script/4_DeployGOPassMirror.s.sol`](script/4_DeployGOPassMirror.s.sol);
   lending primitives: [`script/5_DeployMorpho.s.sol`](script/5_DeployMorpho.s.sol),
   [`script/6_DeployOracle.s.sol`](script/6_DeployOracle.s.sol) (fallback USD prices; feeds
   attachable via `setBkcFeed`), [`script/7_DeployIrm.s.sol`](script/7_DeployIrm.s.sol)
   (omit/zero `IRM_ADDR` in step 3 for a zero-rate market);
   [`script/8_DeployCoreVault.s.sol`](script/8_DeployCoreVault.s.sol) — deploys CoreVault, wires
   `setRemoteCollateralManager` + source token mapping, enables lltv/irm, creates the market
   (USDC loan / GToken collateral, lltv `0.62e18`).
3. Fund + supply USDC on Creditcoin (`scripts/lending/1_lend_setup.ts`), then run the borrower
   E2E (`scripts/lending/2_lend_e2e.ts`) with the unlock worker running
   (`scripts/lending/3_worker_unlock.ts`).

Key env vars: `PRIVATE_KEY`, `SEPOLIA_RPC_URL`, `CREDITCOIN_RPC_URL`, `PROOF_BUILDER_URL`,
`SOURCE_CHAIN_KEY` (Sepolia = `1`), plus the contract addresses printed by the deploy scripts.

### Tests

- `test/GOPass.t.sol` — hub lifecycle + registry tx-proof sync (including tampered-record,
  failed-tx and wrong-wallet reverts)
- `test/CrossChainLending.t.sol` — lock escrow, proof verify + remote collateral credit, replay
  protection, borrow/repay, remote liquidation claims (no token transfer), FIFO unlocks, pause
  semantics, access control
- `test/GTokenFactory.t.sol`, `test/helpers/`, `test/libraries/` — issuance + math helpers
