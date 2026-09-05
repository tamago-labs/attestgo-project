// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {GToken} from "../src/GToken.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * 4_MintGToken — mint 1M (default) to owner/recipient via GToken.mint (native) or wrap (wrapped)
 * Usage:
 *   GTOKEN_ADDR=0x... RECIPIENT=0x... AMOUNT=1000000 forge script script/4_MintGToken.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 * Env: PRIVATE_KEY, GTOKEN_ADDR, RECIPIENT (default owner), AMOUNT (human, default 1_000_000)
 */
contract MintGToken is Script {
    function run() external {
        uint256 pk = _parse(vm.envString("PRIVATE_KEY"));
        address sender = vm.addr(pk);
        address gtokenAddr = vm.envAddress("GTOKEN_ADDR");
        address recipient = vm.envOr("RECIPIENT", sender);
        // also support TOKEN_OWNER alias
        if (recipient == sender) {
            address alt = vm.envOr("TOKEN_OWNER", address(0));
            if (alt != address(0)) recipient = alt;
        }
        uint256 amountHuman = vm.envOr("AMOUNT", uint256(1_000_000));

        require(gtokenAddr.code.length > 0, "GTOKEN_ADDR has no code: not a GToken");
        GToken g = GToken(gtokenAddr);
        // safe decimals/underlying with try/catch to give clear error if not a GToken (e.g. mock USDT)
        uint8 dec;
        try g.decimals() returns (uint8 d) { dec = d; } catch { revert("GTOKEN_ADDR not a GToken: decimals() failed - check address is GToken not mock"); }
        address underlying;
        try g.underlying() returns (address u) { underlying = u; } catch { revert("GTOKEN_ADDR not a GToken: underlying() failed - check address is aN225/aTBILL not mock USDT/JPYC"); }
        uint256 amount = amountHuman * 10 ** dec;
        address owner = g.owner();

        console.log("GToken", gtokenAddr);
        console.log("owner", owner);
        console.log("sender", sender);
        console.log("recipient", recipient);
        console.log("underlying", underlying);
        console.log("decimals", dec);
        console.log("amount human", amountHuman);
        console.log("amount raw", amount);
        require(sender == owner, "sender not owner: only owner can mint");

        vm.startBroadcast(pk);
        if (underlying == address(0)) {
            // native: mint directly (checks eligibility via GOPass)
            g.mint(recipient, amount);
            console.log("minted %s to %s", amount, recipient);
        } else {
            // wrapped: need underlying balance + approve + wrap
            // mint underlying to sender via Mock if possible, else require balance
            uint256 bal = IERC20Metadata(underlying).balanceOf(sender);
            console.log("underlying balance", bal);
            require(bal >= amount, "insufficient underlying: fund sender first");
            // approve and wrap
            // use low-level call to support non-standard ERC20
            (bool ok,) = underlying.call(abi.encodeWithSignature("approve(address,uint256)", address(g), amount));
            require(ok, "approve failed");
            g.wrapTo(recipient, amount);
            console.log("wrapped %s to %s", amount, recipient);
        }
        vm.stopBroadcast();

        uint256 balAfter = g.balanceOf(recipient);
        console.log("recipient balance", balAfter);
        console.log("GTOKEN_ADDR %s RECIPIENT %s AMOUNT %s", gtokenAddr, recipient, amountHuman);
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
