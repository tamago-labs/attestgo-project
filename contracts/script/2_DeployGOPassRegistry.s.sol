// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {GOPassRegistry} from "../src/GOPassRegistry.sol";

/**
 * 2_DeployGOPassRegistry — verifier on Creditcoin (102031) for Sepolia GOPass (chainKey 1)
 * Usage:
 *   GOPASS_ADDR=0x... forge script script/2_DeployGOPassRegistry.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
 * Env: PRIVATE_KEY, GOPASS_ADDR (Sepolia), CACHE_TTL (optional seconds)
 */
contract DeployGOPassRegistry is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);
        address gopass = vm.envAddress("GOPASS_ADDR");
        uint64 sepoliaChainKey = 1; // Sepolia chainKey for 0x0FD2 verifySingle
        uint64 ttl = uint64(vm.envOr("CACHE_TTL", uint256(24 * 3600)));

        console.log("Deploy GOPassRegistry chainId", block.chainid);
        console.log("deployer", deployer);
        console.log("GOPASS_ADDR (Sepolia)", gopass);
        console.log("Sepolia chainKey (fixed 1)", sepoliaChainKey);
        console.log("ttl", ttl);
        require(block.chainid == 102031 || block.chainid == 102030 || block.chainid == 31337, "Wrong chain: GOPassRegistry must be on Creditcoin 102031 testnet");
        require(gopass != address(0), "GOPASS_ADDR zero");
        require(deployer.balance > 0.001 ether, "insufficient");

        vm.startBroadcast(pk);
        GOPassRegistry m = new GOPassRegistry(gopass, sepoliaChainKey);
        if (ttl != 24 * 3600) m.setCacheTTL(ttl);
        vm.stopBroadcast();

        console.log("GOPassRegistry at %s", address(m));
        console.log("REGISTRY_ADDR=%s", address(m));
        console.log("Set REGISTRY_ADDR for worker");
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
