# AttestGo — Attestcoin Scripts

Numbered probes for `@gluwa/usc-sdk 0.18.0` on CC3 Testnet (`chainKey=1` Sepolia, minter `0x2Be9...`) + Forge deploys for AttestGO payment streams (Option B vault).

## Deployed (Sepolia / CC3 Testnet)

| Contract | Address | Tx | Notes |
|----------|---------|----|-------|
| `AttestStream` `contracts/src/AttestStream.sol` (payStream) | `0x052B3eAC16D43EF792589aae41BaD2205c6CC21C` | `0x5314787a053480e78810a05e7a199a254b677172c5a21725715d1f06f0bd79a0` | `3-DeployAttestStream` |
| `AttestStream` (createStream, Option B) | `0xD7D6473c91f2e1048C7AF5acEB131f5aa48e5684` | new (with `createStream`) | `3-DeployAttestStream` redeploy |
| `USCMinter` (example CC3) | `0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f` | pre-deployed | `wrappedTokens` map |
| `WrappedASTR` `contracts/src/WrappedASTR.sol` (`wASTR`) | `0x5d03E2e40992194097989c4E73A31cb5a488d774` | via `4-DeployWrappedASTR` | wraps `0x052B`/`0xD7D6` → `wASTR` |
| `StreamVault` `contracts/src/StreamVault.sol` | `0x719948cED7f58d4684E92Df95bEfB70893148039` | via `5-DeployStreamVault` | vest `wASTR` `total*(now-start)/duration` |
| `BTKT` (example) | `0x914Cf96BF28b7b4921db27b264ecEd71aC91134E` | pre-deployed | `wrapOriginToken(0x0F24...,0x914C)` |

Update `.env` after each deploy (`.env` gitignored, `scripts/.env.example` template):

```bash
cp scripts/.env.example .env
# edit .env:
SOURCE_CHAIN_KEY=1
SOURCE_CHAIN_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/..."
CREDITCOIN_RPC_URL="https://rpc.cc3-testnet.creditcoin.network"
PROOF_BUILDER_URL="https://prover.cc3-testnet.creditcoin.network"
SOURCE_CHAIN_CONTRACT_ADDRESS="0xD7D6473c91f2e1048C7AF5acEB131f5aa48e5684" # new with createStream (or 0x052B for payStream)
USC_MINTER_CONTRACT_ADDRESS="0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f"
WRAPPED_ASTR_ADDRESS="0x5d03E2e40992194097989c4E73A31cb5a488d774"
STREAM_VAULT_ADDRESS="0x719948cED7f58d4684E92Df95bEfB70893148039"
CREDITCOIN_WALLET_PRIVATE_KEY="0x..." # 0xB045...
PRIVATE_KEY="0x..." # same for forge scripts/contracts/.env
```

Faucets: Sepolia ETH `https://cloud.google.com/application/web3/faucet/ethereum/sepolia`, CC3 CTC Discord `/faucet address: 0x...` (100 CTC / 24h ≈ 9 queries).

## Setup

```bash
npm install @gluwa/usc-sdk ethers dotenv --save
forge build --root contracts  # solc 0.8.19, OZ v4.9.6, evm_version london (CC3 needs london, not paris/prevrandao)
```

## Forge Deploys (contracts/script)

```bash
# 3 — AttestStream on Sepolia (0x052B, then redeploy for createStream → 0xD7D6)
forge script script/3-DeployAttestStream.s.sol --rpc-url $SOURCE_CHAIN_RPC_URL --broadcast -vvvv

# 4 — WrappedASTR on CC3 (then wrap — split tx, batched wrap reverts NotActivated)
forge script script/4-DeployWrappedASTR.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast -vvvv
cast send --rpc-url $CREDITCOIN_RPC_URL 0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f "wrapOriginToken(address,address)" 0xD7D6473c91f2e1048C7AF5acEB131f5aa48e5684 <wASTR> --private-key $PRIVATE_KEY
cast send --rpc-url $CREDITCOIN_RPC_URL 0x5d03E2e40992194097989c4E73A31cb5a488d774 "grantRole(bytes32,address)" 0x136b4ea814943381b21135619753b49ccdfcafbbaf74ea171e16bd3e3fea7be8 0xB045bbB51f3CE266A506f332EDBDe176C9862Ff3 --private-key $PRIVATE_KEY # for 8_worker mint

# 5 — StreamVault on CC3 (Option B)
forge script script/5-DeployStreamVault.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast -vvvv
# → STREAM_VAULT_ADDRESS=0x7199...

# 1/2 — mocks + oracles for app/pools
forge script script/1-DeployMockTokens.s.sol --rpc-url $RPC_URL --broadcast
forge script script/2-DeployOracles.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast
```

Troubleshooting: `prevrandao not set` → `foundry.toml` `london` (fixed), `NotActivated` in same script → split deploy+wrap (fixed), `encode length mismatch` → use `-vvvv` not `-- --vvv`, `invalid BytesLike null` → `tuple(bytes32 hash` not `root` (fixed in `5`/`6`).

## TS Scripts (scripts/)

### 1 — Chain & attestation status (read-only)
```bash
npx tsx scripts/1_check_chains.ts
```

### 2 — Single proof + view verify (read-only, needs Sepolia RPC)
```bash
cast send --rpc-url $SOURCE_CHAIN_RPC_URL 0xD7D6... "payStream(address,uint256,bytes32,uint256,string)" <recipient> 1000000000000000000 $(cast keccak "attest-1") 1 "salary" --private-key $PRIVATE_KEY
npx tsx scripts/2_verify_single_view.ts 0x<txHash>  # ~8-10 min attest, 2.59e-5 CTC
```

### 3 — Batch verify (read-only, 2-10 txs within 1000 blocks)
```bash
npx tsx scripts/3_verify_batch_view.ts 0x<tx1> 0x<tx2>
```

### 4 — Gas table (read-only)
```bash
npx tsx scripts/4_estimate_gas_table.ts
npx tsx scripts/4_estimate_gas_table.ts 0x<txHash>
```

### 5 — Offchain worker for payStream (send tokens)
```bash
npx tsx scripts/5_worker.ts  # watches StreamPayment → 0x2Be9 mint wASTR
# keep running; trigger payStream in other terminal
```

### 6 — Stream demo (uses deployed AttestStream, no deploy)
```bash
npx tsx scripts/6_stream_demo.ts              # payStream → prove → view
npx tsx scripts/6_stream_demo.ts --execute    # also minter submit (needs wrap)
```

### 7 — Create stream (Option B, single lock)
```bash
npx tsx scripts/7_create_stream.ts --recipient 0x... --total 10000000000000000000 --duration 3600 --memo "salary month"
# → StreamCreated streamId=2 tx 0x...  Use new AttestStream 0xD7D6 with createStream
# needs 8_worker_vault for CC3 vest
```

### 8 — Vault worker (Option B, StreamCreated → vault)
```bash
STREAM_VAULT_ADDRESS=0x7199... WRAPPED_ASTR_ADDRESS=0x5d03... npx tsx scripts/8_worker_vault.ts
# watches StreamCreated on 0xD7D6 → wait attested → view verify → mint wASTR to vault → onStreamProvenAsOwner
# run BEFORE 7_create_stream (polls from current block)
```

### 9 — Withdraw demo (vest polling)
```bash
npx tsx scripts/9_withdraw_demo.ts --streamId 2 --loop 3 --interval 10
RECIPIENT_PRIVATE_KEY=0x... npx tsx scripts/9_withdraw_demo.ts --streamId 2 --withdraw
# cast equivalents:
# cast call --rpc-url $CREDITCOIN_RPC_URL 0x7199... "withdrawable(uint256)(uint256)" 2
# cast send --rpc-url $CREDITCOIN_RPC_URL 0x7199... "withdraw(uint256)" 2 --private-key $RECIPIENT_KEY
```

### 10 — Verify Travel Rule (attestId + 0x0FD2)
```bash
npx tsx scripts/10_verify_travel_rule.ts 0x<txHash> 0x<expectedAttestId>
npx tsx scripts/10_verify_travel_rule.ts 0x<txHash> --travelJson '{"originator":"Alice","beneficiary":"Bob","amount":"10"}'
# checks receiptStatus==1, StreamCreated/StreamPayment attestId match, then ProofBuilder → 0x0FD2
# txHash is from 7_create_stream (StreamCreated) or payStream; attestId = keccak(travelJson)
```

Flow recap:
```
Sepolia payStream(0x052B) → 5_worker → 0x2Be9 mint wASTR
Sepolia createStream(0xD7D6, total, duration) → 8_worker → view verify → mint wASTR to vault 0x7199 → onStreamProven → vested=total*(now-start)/duration → 9 withdraw
```

## Reference
- Precompiles `0x0FD2` `0x0FD3` decoder `0x731c...` testnet
- Docs https://docs.creditcoin.org/attestcoin-protocol
- SDK https://www.npmjs.com/package/@gluwa/usc-sdk prover `https://prover.cc3-testnet.creditcoin.network`
- Forge `solc 0.8.19` `london` `via_ir true` OZ `v4.9.6`
