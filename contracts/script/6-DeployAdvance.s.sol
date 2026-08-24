// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {AdvanceManager} from "../src/Advance/AdvanceManager.sol";
import {AuxiliaryAdvance} from "../src/Advance/AuxiliaryAdvance.sol";

/**
 * @title DeployAdvance
 * @notice Deploy Advance stack: AuxiliaryAdvance on Sepolia, AdvanceManager on CC3
 * @dev Usage (run twice, once per chain):
 *   # Sepolia: AuxiliaryAdvance (emits AdvanceFunded/AdvanceRepaid)
 *   forge script script/6-DeployAdvance.s.sol --rpc-url $SOURCE_CHAIN_RPC_URL --broadcast -vvvv
 *   # CC3: AdvanceManager (tracks advances, streamId collateral)
 *   forge script script/6-DeployAdvance.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast -vvvv
 *
 *   Env: PRIVATE_KEY
 */
contract DeployAdvance is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parsePrivateKey(pkStr);
        address deployer = vm.addr(pk);

        console.log("===========================================");
        console.log("Deploy Advance Stack");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);

        vm.startBroadcast(pk);

        if (block.chainid == 11155111) {
            // Sepolia
            AuxiliaryAdvance aux = new AuxiliaryAdvance();
            console.log("AuxiliaryAdvance (Sepolia) deployed at:", address(aux));
            console.log("Add to .env: AUXILIARY_ADVANCE_ADDRESS=%s", address(aux));
        } else {
            // Creditcoin CC3 (102031) or other CC3 fork
            AdvanceManager manager = new AdvanceManager();
            console.log("AdvanceManager (CC3) deployed at:", address(manager));
            console.log("Add to .env: ADVANCE_MANAGER_ADDRESS=%s", address(manager));
            console.log("Next: set worker address via manager.setWorker(0x...)");
        }

        vm.stopBroadcast();

        console.log("\n[OK] Advance deploy done");
    }

    function _parsePrivateKey(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
