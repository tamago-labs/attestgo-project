# AttestGo Advance — Practical Loan-Flow for Payment Streams (separate)

Standalone copy of `usc-testnet-bridge-examples/loan-flow` but AttestGo `Advance against Stream` (not basic `payStream→mint`). Uses `wASTR`/`StreamVault` as collateral, `AdvanceManager` CC3 + `AuxiliaryAdvance` Sepolia, reuses mock tokens `KKUB`/`KUSDT` without wrap (Sepolia-only, like loan-flow).

## Contracts (separate from streams 1-10)

- `contracts/src/Advance/AdvanceManager.sol` (CC3, `Ownable`, `ReentrancyGuard`, ECDSA) — `registerAdvance` (lender/borrower sigs, `collateralStreamId`), `markAdvanceAsFunded`/`noteAdvanceRepayment` (worker after `0x0FD2` view), `wrappedTokens` map not needed.
- `contracts/src/Advance/AuxiliaryAdvance.sol` (Sepolia) — `addAuthorizedToken`/`registerAdvanceFund`/`fundAdvance`/`repayAdvance` → emits `AdvanceFunded`/`AdvanceRepaid` (trusted via `registerSourceAdvanceContract`).
- Reuse: `TestERC20` `KKUB`/`KUSDT` from `1-DeployMockTokens`, `PriceOracle` for `advance/` LTV checks (optional).

Deploy (separate, run per chain):
```bash
forge script script/6-DeployAdvance.s.sol --rpc-url $SOURCE_CHAIN_RPC_URL --broadcast -vvvv  # AuxiliaryAdvance Sepolia
forge script script/6-DeployAdvance.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast -vvvv   # AdvanceManager CC3
# env: PRIVATE_KEY, SOURCE_CHAIN_CONTRACT_ADDRESS not needed for advance
# → AUXILIARY_ADVANCE_ADDRESS=0x...  ADVANCE_MANAGER_ADDRESS=0x...
```

## Setup (like loan-flow 1.2-1.5, but ADVANCE_*)

```bash
cp scripts/.env.example .env
# add:
ADVANCE_MANAGER_ADDRESS=0x...
AUXILIARY_ADVANCE_ADDRESS=0x...
SOURCE_CHAIN_ERC20_CONTRACT_ADDRESS=0x... # KKUB/KUSDT mock from 1-DeployMockTokens
LENDER_WALLET_PRIVATE_KEY=0x... # 0xB045...
BORROWER_WALLET_PRIVATE_KEY=0x... # new
```

## Run (isolated from 5/8 workers)

```bash
# authorize token for advances (Sepolia, owner 0xB045)
npx tsx scripts/advance/1_authorize.ts 0xKKUB

# register AuxiliaryAdvance as trusted source on CC3 AdvanceManager (owner)
npx tsx scripts/advance/1_register.ts 0xAuxiliaryAdvance

# worker (own terminal, separate from 5/8)
npx tsx scripts/advance/2_worker.ts

# in other terminal:
npx tsx scripts/advance/3_create_advance.ts --streamId 2 --amount 1000 --bps 500 --deadline 10000  # collateral Stream 2
npx tsx scripts/advance/3_inspect.ts 1

npx tsx scripts/advance/4_fund.ts 1 500; npx tsx scripts/advance/4_fund.ts 1 500  # lender funds 2x
npx tsx scripts/advance/4_repay.ts 1 525  # borrower repays 500+25
npx tsx scripts/advance/3_inspect.ts 1  # Repaid
```

Worker watches `AdvanceRegistered` CC3 → `registerAdvanceFund` Sepolia → `AdvanceFunded` Sepolia → `markAdvanceAsFunded` CC3 → `AdvanceRepaid` Sepolia → `noteAdvanceRepayment` CC3.

See `usc-testnet-bridge-examples/loan-flow/README.md` for full loan-flow narrative; this is its AttestGo `advance/` clone.
