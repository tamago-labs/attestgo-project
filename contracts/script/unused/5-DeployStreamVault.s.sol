// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {StreamVault} from "../../src/unused/StreamVault.sol";

/**
 * @title DeployStreamVault
 * @notice Deploy StreamVault (Option B) on Creditcoin for linear vest of wASTR
 * @dev Usage:
 *   forge script script/5-DeployStreamVault.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast -vvvv
 *   Env: PRIVATE_KEY, USC_MINTER_CONTRACT_ADDRESS=0x2Be9...
 */
contract DeployStreamVault is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parsePrivateKey(pkStr);
        address deployer = vm.addr(pk);
        address minter = vm.envAddress("USC_MINTER_CONTRACT_ADDRESS");

        console.log("===========================================");
        console.log("Deploy StreamVault (Option B) on Creditcoin");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Minter:", minter);

        vm.startBroadcast(pk);
        StreamVault vault = new StreamVault(minter);
        vm.stopBroadcast();

        console.log("\n[1/1] StreamVault deployed at:", address(vault));
        console.log("      minter:", vault.minter());
        console.log("      owner:", vault.owner());

        console.log("\n[OK] StreamVault deployed");

        console.log("\n===========================================");
        console.log("Update .env:");
        console.log("===========================================");
        console.log("STREAM_VAULT_ADDRESS=%s", address(vault));
        console.log("===========================================");
        console.log("\nNext: update USC minter wrapper to call vault.onStreamProven on StreamCreated proof");
        console.log("  Worker 5 should watch StreamCreated and call vault via minter (action=1)");
    }

    function _parsePrivateKey(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
