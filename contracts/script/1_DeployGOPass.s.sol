// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {GOPass} from "../src/GOPass.sol";

/**
 * 1_DeployGOPass — hub on Creditcoin (102031 testnet)
 * Usage:
 *   forge script contracts/script/1_DeployGOPass.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
 * Env: PRIVATE_KEY, BASE_URI (optional)
 */
contract DeployGOPass is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);
        string memory baseURI = vm.envOr("BASE_URI", string("https://attestgo.test/pass/"));

        console.log("Deploy GOPass (hub) chainId %s deployer %s", block.chainid, deployer);
        console.log("baseURI %s", baseURI);
        require(deployer.balance > 0.001 ether, "insufficient native");

        vm.startBroadcast(pk);
        GOPass hub = new GOPass(baseURI);
        vm.stopBroadcast();

        console.log("GOPass at %s", address(hub));
        console.log("owner %s", hub.owner());
        console.log("Set GOPASS_ADDR=%s for 2_DeployGOPassMirror", address(hub));
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
