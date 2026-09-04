// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Morpho} from "../src/Morpho.sol";

/**
 * 5_DeployMorpho — deploy the Morpho lending core on Creditcoin.
 * Idempotent: set MORPHO_ADDR to reuse an existing deployment.
 *
 * Env: PRIVATE_KEY, MORPHO_ADDR (optional reuse), OWNER_ADDR (default = deployer)
 * Usage:
 *   forge script script/5_DeployMorpho.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
 */
contract DeployMorpho is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);

        console.log("DeployMorpho chainId", block.chainid);
        console.log("deployer", deployer);
        require(block.chainid == 102031 || block.chainid == 102030 || block.chainid == 31337, "Wrong chain: Morpho must be on Creditcoin");

        address existing = vm.envOr("MORPHO_ADDR", address(0));
        if (existing != address(0)) {
            require(existing.code.length > 0, "MORPHO_ADDR has no code");
            console.log("Reusing Morpho", existing);
            console.log("MORPHO_ADDR=%s", existing);
            return;
        }

        address owner = vm.envOr("OWNER_ADDR", deployer);
        vm.startBroadcast(pk);
        Morpho morpho = new Morpho(owner);
        vm.stopBroadcast();

        console.log("MORPHO_ADDR=%s", address(morpho));
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
