// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {GOPassMirror} from "../src/GOPassMirror.sol";

/**
 * 4_DeployGOPassMirror — universal pass mirror on new chain (e.g. Base chainKey 2) synced from CC registry
 * Usage:
 *   forge script contracts/script/4_DeployGOPassMirror.s.sol --rpc-url $BASE_RPC_URL --broadcast --legacy
 * Env: PRIVATE_KEY, WORKER (optional)
 */
contract DeployGOPassMirror is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);
        address worker = vm.envOr("WORKER", deployer);
        console.log("Deploy GOPassMirror on new chain", block.chainid);
        console.log("deployer", deployer);
        console.log("worker", worker);
        // require(block.chainid != 102031 && block.chainid != 102030, "Mirror must not be on Creditcoin");
        require(deployer.balance > 0.001 ether, "insufficient");
        vm.startBroadcast(pk);
        GOPassMirror m = new GOPassMirror();
        m.setWorker(worker);
        vm.stopBroadcast();
        console.log("GOPassMirror at %s", address(m));
        console.log("MIRROR_ADDR=%s (use for GToken on new chain)", address(m));
    }
    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
