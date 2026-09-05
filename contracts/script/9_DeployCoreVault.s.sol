// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CoreVault} from "../src/CoreVault.sol";
import {MarketParams, Market, Id, IMorpho} from "../src/interfaces/IMorpho.sol";
import {MarketParamsLib} from "../src/libraries/MarketParamsLib.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";
import {IIrm} from "../src/interfaces/IIrm.sol";

/**
 * 9_DeployCoreVault — deploy CoreVault on Creditcoin (deploy-only, no wiring).
 *
 * Deploys ONLY CoreVault. All wiring (remote collateral manager, token mapping,
 * LLTV/IRM enables, market creation) is done post-deploy via scripts/lending/1_lend_setup.ts
 * which handles both markets (nikkei + tbill) on the singleton vault.
 *
 * Env: PRIVATE_KEY, MORPHO_ADDR, SOURCE_VAULT_ADDR (Sepolia), WORKER_ADDR (default = deployer),
 *      SOURCE_CHAIN_ID (default 11155111)
 * Usage:
 *   MORPHO_ADDR=0x.. SOURCE_VAULT_ADDR=0x.. \
 *   forge script script/9_DeployCoreVault.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
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

        address morphoAddr = vm.envOr("MORPHO_ADDR", address(0));
        address sourceVault = vm.envOr("SOURCE_VAULT_ADDR", address(0));
        uint64 sourceChainId = uint64(vm.envOr("SOURCE_CHAIN_ID", uint256(11155111)));
        address worker = vm.envOr("WORKER_ADDR", deployer);
        uint64 sourceChainKey = 1; // Sepolia chainKey for 0x0FD2 verifySingle

        require(morphoAddr.code.length > 0, "MORPHO_ADDR missing or has no code (run 5_DeployMorpho)");
        require(sourceVault != address(0), "SOURCE_VAULT_ADDR missing (run 8_DeploySourceVault on Sepolia)");

        // ───────────────────────────── broadcast ──────────────────────────
        vm.startBroadcast(pk);

        CoreVault coreVault = new CoreVault(morphoAddr, sourceVault, sourceChainKey, sourceChainId, worker);
        console.log("CoreVault", address(coreVault));

        vm.stopBroadcast();

        console.log("CORE_VAULT_ADDR=%s", address(coreVault));
        console.log("MORPHO_ADDR=%s", morphoAddr);
        console.log("SOURCE_VAULT_ADDR=%s", sourceVault);
        console.log("Next: wire markets via scripts/lending/1_lend_setup.ts --all");
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
