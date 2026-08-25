// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {GOPassVerifier} from "../src/GOPassVerifier.sol";

/**
 * 2_DeployGOPassVerifier — dest on Sepolia/Base (11155111/84532)
 * Usage:
 *   GOPASS_ADDR=0x... CREDITCOIN_CHAIN_ID=102031 WORKER=0x... forge script contracts/script/2_DeployGOPassVerifier.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 * Env: PRIVATE_KEY, GOPASS_ADDR, CREDITCOIN_CHAIN_ID, WORKER (optional), CACHE_TTL (optional seconds)
 */
contract DeployGOPassVerifier is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);
        address gopass = vm.envAddress("GOPASS_ADDR");
        uint64 ccChainId = uint64(vm.envUint("CREDITCOIN_CHAIN_ID"));
        address worker = vm.envOr("WORKER", deployer);
        uint64 ttl = uint64(vm.envOr("CACHE_TTL", uint256(24 * 3600)));

        console.log("Deploy GOPassVerifier chainId", block.chainid);
        console.log("deployer", deployer);
        console.log("GOPASS_ADDR", gopass);
        console.log("CC chain", ccChainId);
        console.log("worker", worker);
        console.log("ttl", ttl);
        require(gopass != address(0), "GOPASS_ADDR zero");
        require(deployer.balance > 0.001 ether, "insufficient");

        vm.startBroadcast(pk);
        GOPassVerifier m = new GOPassVerifier(gopass, ccChainId);
        m.setWorker(worker);
        if (ttl != 24 * 3600) m.setCacheTTL(ttl);
        vm.stopBroadcast();

        console.log("GOPassVerifier at %s", address(m));
        console.log("MIRROR_ADDR=%s", address(m));
        console.log("Set MIRROR_ADDR for 3_DeployGToken");
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
