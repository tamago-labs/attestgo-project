// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {GToken} from "../src/GToken.sol";

/**
 * 3_DeployGToken — RWA example USD T-Bill on Sepolia (same chain as GOPass hub)
 * Usage:
 *   GOPASS_ADDR=0x... forge script script/3_DeployGToken.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 * Env: PRIVATE_KEY, GOPASS_ADDR, TOKEN_NAME/SYMBOL optional, MIN_TIER, COUNTRIES_BITMAP optional
 */
contract DeployGToken is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);
        address gopass = vm.envAddress("GOPASS_ADDR");
        string memory name = vm.envOr("TOKEN_NAME", string("USD T-Bill"));
        string memory symbol = vm.envOr("TOKEN_SYMBOL", string("USD-TBILL"));
        uint8 minTier = uint8(vm.envOr("MIN_TIER", uint256(10)));
        uint256 bitmap = vm.envOr("COUNTRIES_BITMAP", uint256(1)); // US only (one country per pass)

        console.log("Deploy GToken");
        console.log(name);
        console.log(symbol);
        console.log("gopass", gopass);
        console.log("deployer", deployer);
        console.log("chain", block.chainid);
        require(block.chainid == 11155111 || block.chainid == 84532 || block.chainid == 8453 || block.chainid == 31337, "Wrong chain: GToken must be Sepolia/Base");
        require(gopass != address(0), "GOPASS_ADDR zero");

        GToken.Rule memory rule = GToken.Rule({
            allowed_group: bytes2(0),
            allowed_sub_group: bytes2(0),
            min_tier: minTier,
            min_sub_tier: 0,
            is_black_list: false,
            countriesBitmap: bitmap
        });

        vm.startBroadcast(pk);
        GToken g = new GToken(name, symbol, gopass, rule, "https://icons.test/usd-tbill.svg");
        vm.stopBroadcast();

        console.log("GToken at %s", address(g));
        console.log("GTOKEN_ADDR=%s rule min_tier %s bitmap %s", address(g), minTier, bitmap);
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
