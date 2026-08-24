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

## Next scripts planned
- `3_verify_batch_view.ts` — `getBatchProof([tx1,tx2])` + `verifyBatch` (10 max, 1000-block range)
- `4_estimate_gas_table.ts` — table recent vs 24h-old cost (2.59e-5 vs 3.13e-4 CTC)
- `5_worker_skeleton.ts` — offchain worker polling your AttestGo `StreamPayment` events (copy `bridge-offchain-worker/worker.ts` + `utils/pollEvents`)
- `6_attestGO_stream.ts` — custom source contract emitting payment-stream event for `app/payment-streams`
- See `usc-testnet-bridge-examples/README.md` tutorials: `custom-contracts-bridging`, `bridge-offchain-worker`, `loan-flow`

## Reference
- Precompiles: `0x0FD2` BlockProver, `0x0FD3` ChainInfo, decoder `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` (testnet)
- Docs: https://docs.creditcoin.org/attestcoin-protocol, https://docs.creditcoin.org/attestcoin-protocol/attestcoin-protocol-chains-environments
- SDK: https://www.npmjs.com/package/@gluwa/usc-sdk , prover `https://prover.cc3-testnet.creditcoin.network`
