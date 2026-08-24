# AttestGo — Attestcoin Scripts

Numbered runnable probes for `usc-testnet-bridge-examples` + `@gluwa/usc-sdk 0.18.0`.

## Setup
```bash
# from attestgo-project/
npm install @gluwa/usc-sdk ethers dotenv --save
# already have tsx ^4.19.0, else: npm i -D tsx

cp scripts/.env.example .env
# edit .env: set SOURCE_CHAIN_RPC_URL (Infura Sepolia), keep defaults for CC3 Testnet
```

Get faucets:
- Sepolia ETH: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
- CC3 Testnet CTC: Discord `/faucet address: 0x...` (100 CTC / 24h ≈ 9 queries, testnet gas is intentionally high)

## Run

### 1 — Chain & attestation status (read-only, no key)
```bash
npx tsx scripts/1_check_chains.ts
# → lists chainKey=1 Sepolia, latest attested height, prover URL
```

### 2 — Single proof + view verify (read-only, needs Sepolia RPC)
```bash
# first create a burn tx on Sepolia (from usc-testnet-bridge-examples/hello-bridge README):
cast wallet new # save 0x...
# .env: CREDITCOIN_WALLET_PRIVATE_KEY=<key>, SOURCE_CHAIN_RPC_URL=...
cast send --rpc-url $SOURCE_CHAIN_RPC_URL $SOURCE_CHAIN_CONTRACT_ADDRESS "mint(uint256)" 50000000000000000000 --private-key $CREDITCOIN_WALLET_PRIVATE_KEY
cast send --rpc-url $SOURCE_CHAIN_RPC_URL $SOURCE_CHAIN_CONTRACT_ADDRESS "burn(uint256)" 50000000000000000000 --private-key $CREDITCOIN_WALLET_PRIVATE_KEY
# → copy txHash 0x...
npx tsx scripts/2_verify_single_view.ts 0xbc1aefc42f7bc5897e7693e815831729dc401877df182b137ab3bf06edeaf0e1
# waits ~8-10 min for attestation, then prints continuityLen, siblings, est CTC, and ✅ VERIFIED
```

Write path (needs funded key) after 2 succeeds:
```bash
yarn --cwd usc-testnet-bridge-examples hello_bridge:submit_query <same txHash>
# → estimates gas (5000 per continuity block), submits to 0x2Be9..., awaits TokensMinted, check balance:
# yarn --cwd usc-testnet-bridge-examples utils:check_balance $USC_MINTABLE_TOKEN <wallet>
```

### 3 — Batch verify (read-only, needs 2 txs within 1000 blocks)
```bash
npx tsx scripts/3_verify_batch_view.ts 0x<tx1> 0x<tx2>
# shares one continuity proof, cheaper than 2 singles
```

### 4 — Gas table (read-only, no RPC; with tx gives live len)
```bash
npx tsx scripts/4_estimate_gas_table.ts
npx tsx scripts/4_estimate_gas_table.ts 0x<txHash>
```

### 5 — Offchain worker (needs funded CTC, watches Sepolia)
```bash
# .env: SOURCE_CHAIN_CONTRACT_ADDRESS=<AttestStream or 0x0F24...>, USC_MINTER_CONTRACT_ADDRESS=0x2Be9..., PRIVATE_KEY=...
npx tsx scripts/5_worker.ts
# watches StreamPayment (fallback TokensBurnedForBridging), auto-proves + submits; poll 5s,handles attest lag
```

### 6 — Stream demo (uses deployed 0x052B, no deploy)
```bash
# payStream on Sepolia + prove + view verify (no CTC):
npx tsx scripts/6_stream_demo.ts
# with on-chain submit to minter 0x2Be9... (needs CTC):
npx tsx scripts/6_stream_demo.ts --execute
npx tsx scripts/6_stream_demo.ts --execute 0x052B3eAC16D43EF792589aae41BaD2205c6CC21C
# compare with auto-relay: npx tsx scripts/5_worker.ts
```

Contracts:
- `contracts/src/AttestStream.sol` (0x052B3eAC16D43EF792589aae41BaD2205c6CC21C, tx 0x53147...) — `payStream(recipient,amount,attestId,streamId,memo)` → `StreamPayment`. Deploy via Forge: `forge script script/3-DeployAttestStream.s.sol --rpc-url $SOURCE_CHAIN_RPC_URL --broadcast --legacy`
- `contracts/src/PriceOracle.sol` etc. for `app/pools`/`app/borrow`

See `usc-testnet-bridge-examples/README.md` tutorials: `custom-contracts-bridging`, `bridge-offchain-worker`, `loan-flow`

## Reference
- Precompiles: `0x0FD2` BlockProver, `0x0FD3` ChainInfo, decoder `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` (testnet)
- Docs: https://docs.creditcoin.org/attestcoin-protocol, https://docs.creditcoin.org/attestcoin-protocol/attestcoin-protocol-chains-environments
- SDK: https://www.npmjs.com/package/@gluwa/usc-sdk , prover `https://prover.cc3-testnet.creditcoin.network`
