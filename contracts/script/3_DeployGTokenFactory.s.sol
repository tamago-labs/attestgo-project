// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {GTokenFactory} from "../src/GTokenFactory.sol";

/**
 * Deploy GTokenFactory — one per chain, holds eligibleProvider (GOPass or Mirror)
 * Usage: GOPASS_ADDR=0x... forge script script/3_DeployGTokenFactory.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 */
contract DeployGTokenFactory is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address gopass = vm.envAddress("GOPASS_ADDR");
        console.log("Deploy GTokenFactory provider", gopass, "chain", block.chainid);
        require(gopass != address(0), "GOPASS_ADDR zero");
        vm.startBroadcast(pk);
        GTokenFactory f = new GTokenFactory(gopass);
        vm.stopBroadcast();
        console.log("GTokenFactory at %s", address(f));
        console.log("FACTORY_ADDR=%s", address(f));
    }
    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
