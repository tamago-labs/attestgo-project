// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {GToken} from "../src/GToken.sol";
import {GOPass} from "../src/GOPass.sol";
import {PrimaryMarket} from "../src/mocks/PrimaryMarket.sol";

/**
 * 11_DeploySGDMarket — deploy GO Asset Primary Market for SGD-GO/USDT
 * - SGD-GO: 1 USDT = 1 SGD-GO (Singapore-dollar compliant stablecoin, 1:1 pegged to USD)
 * Usage:
 *   PRIVATE_KEY=0x... SEPOLIA_RPC_URL=... \
 *   SGD_GO=0x... USDT=0x8d1A... GOPASS_ADDR=0x... \
 *   forge script script/11_DeploySGDMarket.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 * Env overrides: SGD_PRICE (default 1e18), DEPOSIT (default 100k)
 */
contract DeploySGDMarket is Script {
    function run() external {
        uint256 pk = _parse(vm.envString("PRIVATE_KEY"));
        address deployer = vm.addr(pk);

        address sgdGo = vm.envOr("SGD_GO", vm.envOr("GTOKEN_SGD_GO", address(0)));
        address usdt = vm.envOr("USDT", address(0));
        if (usdt == address(0)) usdt = 0x8d1A804D73CA595A8538C805Daef6FE8Ec68137B;
        require(sgdGo != address(0), "SGD_GO required");

        uint256 priceSgd = vm.envOr("SGD_PRICE", uint256(1 ether)); // 1e18 USDT per SGD-GO (1:1)
        uint256 deposit = vm.envOr("DEPOSIT", uint256(1_000_000));

        console.log("Deployer", deployer);
        console.log("SGD-GO", sgdGo, "price", priceSgd);
        console.log("USDT", usdt);

        address gopassAddr = vm.envOr("GOPASS_ADDR", address(0x0a6aD3b8B8D1A69Ba44002983e64e4824cB63334));
        console.log("GOPass", gopassAddr);
        try GOPass(gopassAddr).owner() returns (address o) { console.log("GOPass owner", o); } catch {}
        try GOPass(gopassAddr).worker() returns (address w) { console.log("GOPass worker", w); } catch {}

        vm.startBroadcast(pk);

        PrimaryMarket mSGD = new PrimaryMarket(sgdGo, usdt, priceSgd);
        console.log("PrimaryMarket SGD (SGD-GO/USDT) at", address(mSGD), "price 1.0 USDT");

        // give market GO Pass so GToken transfer to market passes eligibility
        {
            GOPass hub = GOPass(gopassAddr);
            uint64 exp = uint64(block.timestamp + 365 days);
            try hub.mint(address(mSGD), GOPass.Record(10, 0, bytes2(0), bytes2(0), 7, exp, false, false, keccak256(abi.encodePacked(address(mSGD))), "")) {
                console.log("minted pass for SGD market");
            } catch Error(string memory r) { console.log("mint SGD market failed:", r); } catch { console.log("mint SGD market failed low-level"); }
            try hub.setActive(address(mSGD), true) { console.log("activated SGD market"); } catch {}
        }

        // deposit if owner holds SGD-GO
        uint256 depSGD = deposit * 10 ** GToken(sgdGo).decimals();
        if (GToken(sgdGo).balanceOf(deployer) >= depSGD) {
            GToken(sgdGo).approve(address(mSGD), depSGD);
            mSGD.deposit(depSGD);
            console.log("Deposited", depSGD, "SGD-GO to SGD market");
        } else {
            console.log("Skip SGD deposit: balance", GToken(sgdGo).balanceOf(deployer), "need", depSGD);
        }

        vm.stopBroadcast();

        console.log("MARKET_SGD", address(mSGD));
        console.log("Done - wire frontend BuyDrawer to market.buy() with USDT");
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
