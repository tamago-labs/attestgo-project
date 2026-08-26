// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {GToken} from "../src/GToken.sol";
import {GTokenFactory} from "../src/GTokenFactory.sol";

/**
 * 3_DeployGToken — via factory if FACTORY_ADDR set, else direct. Supports native vs wrapped via UNDERLYING_ADDR.
 * Usage:
 *   FACTORY_ADDR=0x... UNDERLYING_ADDR=0x... forge script script/3_DeployGToken.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 *   GOPASS_ADDR=0x... (if no factory) — legacy direct deploy
 * Env: PRIVATE_KEY, FACTORY_ADDR | GOPASS_ADDR, TOKEN_NAME/SYMBOL, MIN_TIER, COUNTRIES_BITMAP, UNDERLYING_ADDR
 */
contract DeployGToken is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);
        address gopass = vm.envOr("GOPASS_ADDR", address(0));
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
        address factoryCheck = vm.envOr("FACTORY_ADDR", address(0));
        require(factoryCheck != address(0) || gopass != address(0), "need FACTORY_ADDR or GOPASS_ADDR");

        GToken.Rule memory rule = GToken.Rule({
            allowed_group: bytes2(0),
            allowed_sub_group: bytes2(0),
            min_tier: minTier,
            min_sub_tier: 0,
            is_black_list: false,
            countriesBitmap: bitmap
        });

        address underlying = vm.envOr("UNDERLYING_ADDR", address(0));
        // prefer factory if set
        address factoryAddr = vm.envOr("FACTORY_ADDR", address(0));
        if (factoryAddr != address(0)) {
            console.log("via factory", factoryAddr, "underlying", underlying);
            GTokenFactory f = GTokenFactory(factoryAddr);
            vm.startBroadcast(pk);
            address token;
            if (underlying != address(0)) {
                token = f.createWrappedGToken(underlying, name, symbol, rule, "https://icons.test/usd-tbill.svg");
            } else {
                token = f.createGToken(name, symbol, rule, "https://icons.test/usd-tbill.svg");
            }
            vm.stopBroadcast();
            console.log("GToken via factory at %s", token);
            console.log("GTOKEN_ADDR %s factory %s underlying %s", token, factoryAddr, underlying);
        } else {
            // legacy direct (no factory index)
            console.log("direct deploy underlying", underlying);
            vm.startBroadcast(pk);
            GToken g = new GToken(name, symbol, gopass, rule, "https://icons.test/usd-tbill.svg", underlying);
            vm.stopBroadcast();
            console.log("GToken at %s", address(g));
            console.log("GTOKEN_ADDR %s", address(g));
            console.log("rule min_tier %s bitmap %s underlying %s", minTier, bitmap, underlying);
        }
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
