// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CoreVault} from "../src/CoreVault.sol";
import {MarketParams, Market, Id, IMorpho} from "../src/interfaces/IMorpho.sol";
import {MarketParamsLib} from "../src/libraries/MarketParamsLib.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";
import {IIrm} from "../src/interfaces/IIrm.sol";

/**
 * 8_DeployCoreVault — deploy CoreVault on Creditcoin and create the lending market.
 *
 * Deploys NOTHING else. All primitives must already exist:
 *   - Morpho        (script/5_DeployMorpho.s.sol)
 *   - PriceOracle   (script/6_DeployOracle.s.sol)
 *   - JumpRateIrm   (script/7_DeployIrm.s.sol) — or leave IRM_ADDR unset/0 for a zero-rate market
 * Validates every address (code present + interface calls succeed) BEFORE broadcasting —
 * the script fails without spending gas if anything is missing.
 *
 * Env: PRIVATE_KEY,
 *      MORPHO_ADDR, ORACLE_ADDR, SOURCE_VAULT_ADDR (Sepolia),   [required]
 *      USDC_CC (loan token), GTOKEN_CC (collateral mirror), GTOKEN_SOURCE, [required]
 *      IRM_ADDR (optional; unset or 0 = zero-rate market),
 *      LLTV (default 0.62e18), WORKER_ADDR (default = deployer),
 *      SOURCE_CHAIN_ID (default 11155111)
 * Usage:
 *   MORPHO_ADDR=0x.. ORACLE_ADDR=0x.. SOURCE_VAULT_ADDR=0x.. USDC_CC=0x.. GTOKEN_CC=0x.. GTOKEN_SOURCE=0x.. \
 *   forge script script/8_DeployCoreVault.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
 */
contract DeployCoreVault is Script {
    using MarketParamsLib for MarketParams;

    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);

        console.log("DeployCoreVault chainId", block.chainid);
        console.log("deployer", deployer);
        require(block.chainid == 102031 || block.chainid == 102030 || block.chainid == 31337, "Wrong chain: CoreVault must be on Creditcoin");

        // ────────────────────────── collect envs ──────────────────────────
        address morphoAddr = vm.envOr("MORPHO_ADDR", address(0));
        address oracleAddr = vm.envOr("ORACLE_ADDR", address(0));
        address irmAddr = vm.envOr("IRM_ADDR", address(0)); // 0 = zero-rate market
        address sourceVault = vm.envOr("SOURCE_VAULT_ADDR", address(0));
        address usdc = vm.envOr("USDC_CC", address(0));
        address gtokenCC = vm.envOr("GTOKEN_CC", address(0));
        address gtokenSource = vm.envOr("GTOKEN_SOURCE", address(0));
        uint256 lltv = vm.envOr("LLTV", uint256(0.62e18));
        uint64 sourceChainId = uint64(vm.envOr("SOURCE_CHAIN_ID", uint256(11155111)));
        address worker = vm.envOr("WORKER_ADDR", deployer);
        uint64 sourceChainKey = 1; // Sepolia chainKey for 0x0FD2 verifySingle

        // ────────────────────── validation (no gas spent) ─────────────────
        require(morphoAddr.code.length > 0, "MORPHO_ADDR missing or has no code (run 5_DeployMorpho)");
        try IMorpho(morphoAddr).owner() returns (address o) {
            console.log("Morpho ok, owner", o);
        } catch {
            revert("MORPHO_ADDR is not a Morpho (owner() failed)");
        }

        require(oracleAddr.code.length > 0, "ORACLE_ADDR missing or has no code (run 6_DeployOracle)");
        try IOracle(oracleAddr).price() returns (uint256 p) {
            require(p > 0, "oracle price() returned 0");
            console.log("Oracle ok, price", p);
        } catch {
            revert("ORACLE_ADDR is not an IOracle (price() failed)");
        }

        MarketParams memory mp = MarketParams({
            loanToken: usdc,
            collateralToken: gtokenCC,
            oracle: oracleAddr,
            irm: irmAddr,
            lltv: lltv
        });

        if (irmAddr != address(0)) {
            require(irmAddr.code.length > 0, "IRM_ADDR set but has no code (run 7_DeployIrm)");
            Market memory emptyMarket;
            try IIrm(irmAddr).borrowRateView(mp, emptyMarket) returns (uint256 rate) {
                console.log("Irm ok, base rate/s", rate);
            } catch {
                revert("IRM_ADDR is not an IIrm (borrowRateView failed)");
            }
        } else {
            console.log("IRM_ADDR unset: zero-rate market (no interest accrual)");
        }

        require(sourceVault.code.length > 0, "SOURCE_VAULT_ADDR missing or has no code (run 9_DeploySourceVault on Sepolia)");
        require(usdc != address(0) && usdc.code.length > 0, "USDC_CC missing or has no code");
        require(gtokenCC != address(0) && gtokenCC.code.length > 0, "GTOKEN_CC missing or has no code (deploy GToken on Creditcoin)");
        require(gtokenSource != address(0), "GTOKEN_SOURCE required (Sepolia RWA token for mapping)");
        require(lltv > 0 && lltv < 1e18, "bad LLTV");

        IMorpho morpho = IMorpho(morphoAddr);

        // ───────────────────────────── broadcast ──────────────────────────
        vm.startBroadcast(pk);

        CoreVault coreVault = new CoreVault(morphoAddr, sourceVault, sourceChainKey, sourceChainId, worker);
        console.log("CoreVault", address(coreVault));

        morpho.setRemoteCollateralManager(address(coreVault));
        coreVault.setSourceTokenMapping(gtokenSource, gtokenCC);

        if (!morpho.isLltvEnabled(lltv)) morpho.enableLltv(lltv);
        if (!morpho.isIrmEnabled(irmAddr)) morpho.enableIrm(irmAddr);

        Market memory m = morpho.market(mp.id());
        if (m.lastUpdate == 0) {
            morpho.createMarket(mp);
            console.log("Market created", vm.toString(Id.unwrap(mp.id())));
        } else {
            console.log("Market already exists", vm.toString(Id.unwrap(mp.id())));
        }

        vm.stopBroadcast();

        console.log("CORE_VAULT_ADDR=%s", address(coreVault));
        console.log("MORPHO_ADDR=%s", morphoAddr);
        console.log("ORACLE_ADDR=%s", oracleAddr);
        console.log("IRM_ADDR=%s", irmAddr);
        console.log("MARKET_ID=%s", vm.toString(Id.unwrap(mp.id())));
        console.log("Next: fund+supply USDC via coreVault.supply; worker: scripts/lending/3_worker_unlock.ts");
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
