# gopass scripts — GO Pass hub/mirror + RWA

Reuses `cross-chain-bridge` + `loan-flow` patterns. Forge first, then node.

## Forge (one-time per chain)
```bash
# hub on Creditcoin 102031
forge script contracts/script/1_DeployGOPass.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
# -> set GOPASS_ADDR

# mirror on Sepolia (or Base Sepolia)
GOPASS_ADDR=0x... CREDITCOIN_CHAIN_ID=102031 WORKER=0x... forge script contracts/script/2_DeployGOPassMirror.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
# -> set MIRROR_ADDR

# RWA example
MIRROR_ADDR=0x... forge script contracts/script/3_DeployGToken.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
# -> set GTOKEN_ADDR
```

Env: `PRIVATE_KEY`, `CREDITCOIN_RPC_URL`, `SEPOLIA_RPC_URL`, `GOPASS_ADDR`, `MIRROR_ADDR`, `GTOKEN_ADDR`, `BASE_URI`.

## Node (per wallet)
```bash
npx tsx scripts/gopass/1_check_chains.ts
npx tsx scripts/gopass/2_mint.ts --to 0x2c1A... --tier 10 --countries US,SG --customerId cust123
npx tsx scripts/gopass/3_worker_sync.ts --wallet 0x2c1A...   # B primary (off-chain proof -> markVerified, ~1m)
npx tsx scripts/gopass/4_check_eligible.ts --wallet 0x2c1A...
npx tsx scripts/gopass/5_gtoken_mint.ts --to 0x2c1A... --amount 100
npx tsx scripts/gopass/6_freeze.ts --wallet 0x2c1A... --frozen true
```

Worker `3_worker_sync` is Advance-style: off-chain `getRecord` + `continuityLen=2` check, then `mirror.markVerified` (no on-chain `0x0FD2` decode). The trustless path `syncPassWithTxProof` (ProofBuilder → `0x0FD2 verifySingle`) now also decodes the verified tx on-chain (Attestcoin Phase 4: receipt status + `PassMinted` log recordHash binding), so submission stays permissionless. Fallback `syncPass` (raw storage-proof staticcall, experimental) is worker/owner-gated.
