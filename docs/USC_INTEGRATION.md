# USC Integration Summary

AttestGO uses Attestcoin Protocol to bring verified state from source chains to Creditcoin, allowing smart contracts to trustlessly read and act on identity and collateral events without moving the underlying asset.

AttestGO uses Attestcoin Protocol in two ways:

* **Identity** — The GO Pass hub mints on Sepolia (`chainKey 1`), while the ASC (Attestcoin Smart Contract) `GOPassRegistry` on Creditcoin receives and verifies the mint transaction via `verifySingle`, then decodes the `PassMinted` log on-chain before trusting the record. Once verified, the GO Pass becomes a reusable, soulbound identity credential across the AttestGO flow — enabling cross-chain identity checks via worker-synced mirrors (`GOPassMirror`) without re-submitting KYC, and serving as the credential to interact with GO Assets where compliance rules such as country restrictions and tier requirements are programmed directly into the token.

With a verified GO Pass, users can: send compliant payments with Travel Rule data auto-attached, interact with GO Assets that enforce country/tier rules on every transfer, and access cross-chain DeFi without repeating KYC.

AttestGO enables a DeFi lending market for RWA assets with programmable compliance. * **Cross-chain lending** — Suppliers supply USDC on Creditcoin to earn yield. Borrowers lock RWA collateral (GO Assets) in `SourceVault` on Sepolia, while `CoreVault` verifies the lock transaction through `0x0FD2` and credits the borrower's position on Creditcoin. The borrower can then borrow USDC against the verified collateral. No wrapped token is needed and the collateral never leaves its source chain — liquidation credits claims, while a trusted worker settles the underlying asset.

Together, these integrations create an end-to-end flow where **verified identity and compliant RWAs stay on their source chains, while their proven state can be used across AttestGO and in DeFi on Creditcoin**. Attestcoin Protocol serves as the interoperability layer, making compliance seamless — verified once, usable everywhere.

## How AttestGO Uses USC

### Identity — GO Pass Verification

- **Source**: GO Pass hub mints on Sepolia (`chainKey 1`)
- **USC**: `GOPassRegistry` on Creditcoin calls `0x0FD2.verifySingle` to prove the mint tx
- **Phase 4 decode**: On-chain extraction of the `PassMinted` log from the verified `encodedTransaction` — binds the record hash to the real mint tx
- **Result**: One verified identity works everywhere via worker-synced mirrors (`GOPassMirror`)

```solidity
// GOPassRegistry.sol — trustless mint verification
(bool ok, bytes memory ret) = BLOCK_PROVER.staticcall(
    abi.encodeWithSignature(
        "verifySingle(uint64,uint64,bytes,bytes32,bytes32[],bytes32,bytes32[])",
        SOURCE_CHAIN_KEY, headerNumber, txBytes, merkleRoot, siblings, lowerDigest, roots
    )
);
// Phase 4: decode PassMinted log from verified txBytes
_decodePassMinted(txBytes, wallet, expected, r.expiry);
```

### Cross-Chain Lending — Remote Collateral

- **Source**: RWA collateral locked in `SourceVault` on Sepolia
- **USC**: `CoreVault` on Creditcoin calls `0x0FD2.verifySingle` to prove the lock tx
- **Phase 4 decode**: On-chain extraction of the `Locked` log — validates all proof fields (lockId, amount, marketId)
- **Result**: Borrower's position is credited on a Morpho-based market — no wrapped token, collateral never leaves source

```solidity
// CoreVault.sol — trustless collateral verification
if (block.chainid != 31337 && BLOCK_PROVER.code.length > 0) {
    (bool ok, bytes memory ret) = BLOCK_PROVER.staticcall(
        abi.encodeWithSignature(
            "verifySingle(uint64,uint64,bytes,bytes32,bytes32[],bytes32,bytes32[])",
            SOURCE_CHAIN_KEY, p.headerNumber, ...
        )
    );
}
// Phase 4: decode Locked log, validate fields, credit position
```

## Trust Model

| Direction | Mechanism | Trust |
|---|---|---|
| **ETH → CC** | Permissionless proof submission via `0x0FD2` | **Trustless** — anyone can submit, replay-protected, params bound to verified tx |
| **CC → ETH** | Trusted worker settles unlock/seize | **Trusted** — worker calls `SourceVault.unlock()` on Sepolia |
