# AttestGo — Attestcoin Scripts

Numbered probes for `@gluwa/usc-sdk 0.18.0` on CC3 Testnet (Sepolia `chainKey=1`, minter `0x2Be9...`) plus Forge deploys for AttestGO payment streams.

## Deployed (Sepolia / CC3 Testnet)

| Contract | Address | Tx | Notes |
|----------|---------|----|-------|
| `AttestStream` (`ASTR`) `contracts/src/AttestStream.sol` | `0x052B3eAC16D43EF792589aae41BaD2205c6CC21C` | `0x5314787a053480e78810a05e7a199a254b677172c5a21725715d1f06f0bd79a0` | `forge script 3-DeployAttestStream` |
| `USCMinter` (example, CC3) | `0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f` | pre-deployed | `wrappedTokens` map |
| `WrappedASTR` (`wASTR`) `contracts/src/WrappedASTR.sol` | _deploy via `4-DeployWrappedASTR`, then `cast wrapOriginToken`_ | — | wraps `0x052B` → `wASTR` |
| `BTKT` (example) | `0x914Cf96BF28b7b4921db27b264ecEd71aC91134E` | pre-deployed | `wrapOriginToken(0x0F24...,0x914C)` |

Update `.env` after each deploy (`.env` is gitignored, `scripts/.env.example` is template):

```bash
cp scripts/.env.example .env
# edit .env:
SOURCE_CHAIN_KEY=1
SOURCE_CHAIN_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/..."
CREDITCOIN_RPC_URL="https://rpc.cc3-testnet.creditcoin.network"
PROOF_BUILDER_URL="https://prover.cc3-testnet.creditcoin.network"
SOURCE_CHAIN_CONTRACT_ADDRESS="0x052B3eAC16D43EF792589aae41BaD2205c6CC21C"
USC_MINTER_CONTRACT_ADDRESS="0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f"
# wrappers after 4:
WRAPPED_ASTR_ADDRESS="0x..." 
USC_MINTABLE_TOKEN="0x..." # same as WRAPPED_ASTR
CREDITCOIN_WALLET_PRIVATE_KEY="0x..."
PRIVATE_KEY="0x..." # same key for forge scripts in contracts/.env
```

Faucets: Sepolia ETH `https://cloud.google.com/application/web3/faucet/ethereum/sepolia`, CC3 CTC Discord `/faucet address: 0x...` (100 CTC / 24h ≈ 9 queries).

## Setup

```bash
npm install @gluwa/usc-sdk ethers dotenv --save  # already in package.json
forge build --root contracts  # solc 0.8.19, OZ v4.9.6, evm_version london (CC3 pallet-evm needs london, not paris/prevrandao)
```

## Forge Deploys (contracts/script)

```bash
# 3 — AttestStream on Sepolia (already deployed 0x052B)
forge script script/3-DeployAttestStream.s.sol --rpc-url $SOURCE_CHAIN_RPC_URL --broadcast -vvvv
# env: PRIVATE_KEY, SOURCE_CHAIN_CONTRACT_ADDRESS not needed for 3

# 4 — WrappedASTR on CC3 + wrap (split: deploy then wrap — batched wrap reverts NotActivated on pallet-evm)
forge script script/4-DeployWrappedASTR.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast -vvvv
# → WrappedASTR deployed at: 0x...
cast send --rpc-url $CREDITCOIN_RPC_URL 0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f "wrapOriginToken(address,address)" 0x052B3eAC16D43EF792589aae41BaD2205c6CC21C <wASTR> --private-key $PRIVATE_KEY
cast call --rpc-url $CREDITCOIN_RPC_URL 0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f "wrappedTokens(address)(address)" 0x052B3eAC16D43EF792589aae41BaD2205c6CC21C
# expect <wASTR> not 0x0

# 1/2 — mock tokens + oracles for app/pools (KKUB/KBTC/KUSDT, PriceOracle)
forge script script/1-DeployMockTokens.s.sol --rpc-url $RPC_URL --broadcast
forge script script/2-DeployOracles.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast  # needs KKUB/KUSDT env set
```

Troubleshooting:
- `prevrandao not set` → `contracts/foundry.toml:10` must be `london` (not `paris`) for CC3; already fixed.
- `NotActivated` on `wrapOriginToken`/`wrappedTokens` view in same script → split deploy and wrap into separate txs (fixed in `4`); verify via `cast call` after.
- `encode length mismatch: expected 0 got 1` → `forge script ... -- --vvv` wrong; use `forge script ... --broadcast -vvvv` without `--`.

## TS Scripts (scripts/)

### 1 — Chain & attestation status (read-only, no key)
```bash
npx tsx scripts/1_check_chains.ts
# chainKey=1 Sepolia, chainKey=3 Ethereum Mainnet on testnet, latest attested heights
```

### 2 — Single proof + view verify (read-only, needs Sepolia RPC)
```bash
# burn/payStream on Sepolia first:
cast send --rpc-url $SOURCE_CHAIN_RPC_URL 0x052B3eAC16D43EF792589aae41BaD2205c6CC21C "payStream(address,uint256,bytes32,uint256,string)" <recipient> 1000000000000000000 $(cast keccak "attest-1") 1 "salary" --private-key $PRIVATE_KEY
# attestId: bytes32, e.g. $(cast keccak "travel-rule: ...") or 0x00...00

npx tsx scripts/2_verify_single_view.ts 0x<txHash>
# waits ~8-10 min for attestation (poll 15s), prints continuityLen, siblings, est CTC 2.59e-5 (10) vs 3.13e-4 (1000), ✅ VERIFIED via 0x0FD2
```

### 3 — Batch verify (read-only, 2-10 txs within 1000 blocks, shared continuity)
```bash
npx tsx scripts/3_verify_batch_view.ts 0x<tx1> 0x<tx2>
```

### 4 — Gas table (read-only, no RPC; with tx gives live len)
```bash
npx tsx scripts/4_estimate_gas_table.ts
npx tsx scripts/4_estimate_gas_table.ts 0x<txHash>
# formula CTC ≈ 2.3e-5 + 2.9e-7 * continuityLen
```

### 5 — Offchain worker (needs funded CTC, watches Sepolia)
```bash
npx tsx scripts/5_worker.ts
# env: SOURCE_CHAIN_CONTRACT_ADDRESS=0x052B..., USC_MINTER=0x2Be9..., PRIVATE_KEY=..., POLL_INTERVAL_MS=5000
# watches StreamPayment → fallback TokensBurnedForBridging, auto: wait attested → ProofBuilder.getProof → estimateGas → minter.execute(0,...) → TokensMinted
# keep running; trigger with cast payStream in another terminal (needs ~8-10 min)
```

### 6 — Stream demo (uses deployed 0x052B, no deploy)
```bash
npx tsx scripts/6_stream_demo.ts              # payStream → prove → view verify
npx tsx scripts/6_stream_demo.ts --execute    # also submit to minter (needs wASTR wrapped via 4, else Origin not registered)
# --execute <addr> to override AttestStream
```

Flow recap:
```
Sepolia: payStream(0x052B, attestId) → emits StreamPayment
    ↓ 5_worker polls → ProofBuilder (merkle + continuity) → waits attested (~8-10 min)
CC3:  minter.execute → 0x0FD2 verifyAndEmit → EvmV1Decoder checks receiptStatus==1 + BURN_EVENT → mints wASTR (or BTKT 0x914C for 0x0F24 origin)
```

## Reference

- Precompiles: `0x0FD2` BlockProver, `0x0FD3` ChainInfo, decoder `0x731c...` (testnet)
- Docs: https://docs.creditcoin.org/attestcoin-protocol, https://docs.creditcoin.org/attestcoin-protocol/attestcoin-protocol-chains-environments
- SDK: https://www.npmjs.com/package/@gluwa/usc-sdk, prover `https://prover.cc3-testnet.creditcoin.network`
- Forge: `contracts/foundry.toml` `solc 0.8.19` `evm_version london` `libs ["lib"]` `via_ir true`, OZ `v4.9.6`
