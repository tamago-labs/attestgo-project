// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {SourceVault} from "../src/SourceVault.sol";

/**
 * 9_DeploySourceVault — deploy the RWA collateral escrow on Sepolia.
 * The Locked event emitted by lock() is the payload proven via Attestcoin
 * (ProofBuilder -> 0x0FD2 verifySingle -> CoreVault.verifyAndSupplyCollateral).
 *
 * Env: PRIVATE_KEY, WORKER_ADDR (default = deployer; the CC->ETH settlement worker)
 * Usage:
 *   forge script script/9_DeploySourceVault.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 */
contract DeploySourceVault is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);

        console.log("DeploySourceVault chainId", block.chainid);
        console.log("deployer", deployer);
        require(block.chainid == 11155111 || block.chainid == 31337, "Wrong chain: SourceVault must be on Sepolia");

        address worker = vm.envOr("WORKER_ADDR", deployer);

        vm.startBroadcast(pk);
        SourceVault v = new SourceVault(worker);
        vm.stopBroadcast();

        console.log("SOURCE_VAULT_ADDR=%s", address(v));
        console.log("Next: deploy core side (8_DeployCoreVault) with SOURCE_VAULT_ADDR");
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
