// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {JumpRateIrm} from "../src/irm/JumpRateIrm.sol";
import {IIrm} from "../src/interfaces/IIrm.sol";

/**
 * 7_DeployIrm — deploy the JumpRateIrm (Compound V2-style jump rate model) on Creditcoin.
 * All parameters immutable; to change rates, deploy a new IRM and create a new market.
 * Idempotent: set IRM_ADDR to reuse.
 *
 * Env: PRIVATE_KEY, IRM_ADDR (optional reuse),
 *      BASE_RATE (yearly WAD, default 0.02e18 = 2%),
 *      MULTIPLIER (yearly WAD at 100% utilization below kink, default 0.08e18 = 8%),
 *      JUMP_MULTIPLIER (yearly WAD above kink, default 0.40e18 = 40%),
 *      KINK (WAD utilization point, default 0.80e18 = 80%)
 * Usage:
 *   forge script script/7_DeployIrm.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
 */
contract DeployIrm is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);

        console.log("DeployIrm chainId", block.chainid);
        console.log("deployer", deployer);
        require(block.chainid == 102031 || block.chainid == 102030 || block.chainid == 31337, "Wrong chain: IRM must be on Creditcoin");

        address existing = vm.envOr("IRM_ADDR", address(0));
        if (existing != address(0)) {
            require(existing.code.length > 0, "IRM_ADDR has no code");
            console.log("Reusing IRM", existing);
            console.log("IRM_ADDR=%s", existing);
            return;
        }

        uint256 baseRate = vm.envOr("BASE_RATE", uint256(0.02e18));
        uint256 multiplier = vm.envOr("MULTIPLIER", uint256(0.08e18));
        uint256 jumpMultiplier = vm.envOr("JUMP_MULTIPLIER", uint256(0.40e18));
        uint256 kink = vm.envOr("KINK", uint256(0.80e18));
        require(kink > 0 && kink < 1e18, "bad KINK");

        vm.startBroadcast(pk);
        JumpRateIrm irm = new JumpRateIrm(baseRate, multiplier, jumpMultiplier, kink);
        vm.stopBroadcast();

        console.log("IRM_ADDR=%s", address(irm));
        console.log("base/yr", baseRate);
        console.log("multiplier/yr", multiplier);
        console.log("jump/yr", jumpMultiplier);
        console.log("kink", kink);
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
