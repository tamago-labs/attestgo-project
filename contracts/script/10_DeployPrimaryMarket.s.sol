// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {GToken} from "../src/GToken.sol";
import {GOPass} from "../src/GOPass.sol";
import {PrimaryMarket} from "../src/mocks/PrimaryMarket.sol";

/**
 * 10_DeployPrimaryMarket — deploy GO Asset Primary Markets for aN225/JPYC and aTBILL/USDT with real NAV prices
 * - aN225: 38,500 JPYC = 1 aN225 (mirrors Nikkei 225 index ~38.5k)
 * - aTBILL: 1.0247 USDT = 1 aTBILL (yield accrual)
 * Usage:
 *   PRIVATE_KEY=0x... SEPOLIA_RPC_URL=... \
 *   AN225=0xc55d... ATBILL=0x266f... JPYC=0xB871... USDT=0x8d1A... \
 *   forge script script/10_DeployPrimaryMarket.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 * Env overrides: AN225_PRICE (default 38500e18), ATBILL_PRICE (default 1.0247e18), DEPOSIT (default 100k)
 */
contract DeployPrimaryMarket is Script {
    function run() external {
        uint256 pk = _parse(vm.envString("PRIVATE_KEY"));
        address deployer = vm.addr(pk);

        address an225 = vm.envOr("AN225", vm.envOr("GTOKEN_A_N225", address(0)));
        address atbill = vm.envOr("ATBILL", vm.envOr("GTOKEN_A_TBILL", address(0)));
        address jpyc = vm.envOr("JPYC", address(0));
        address usdt = vm.envOr("USDT", address(0));
        // fallback to deployment.txt defaults (Sepolia mocks)
        if (jpyc == address(0)) jpyc = 0xB8712751fFBe66DA15f2aCCCf0DFE8071Cc2E5D0;
        if (usdt == address(0)) usdt = 0x8d1A804D73CA595A8538C805Daef6FE8Ec68137B;
        if (an225 == address(0)) an225 = 0xc55D7821b6e0D8AC162e5b672aa9eA87A066B5a8;
        if (atbill == address(0)) atbill = 0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db;

        uint256 priceNikkei = vm.envOr("AN225_PRICE", uint256(38500 ether)); // 38500e18 JPYC per aN225
        uint256 priceTbill = vm.envOr("ATBILL_PRICE", uint256(1024700000000000000)); // 1.0247e18 USDT per aTBILL
        uint256 deposit = vm.envOr("DEPOSIT", uint256(1_000_000));

        console.log("Deployer", deployer);
        console.log("aN225", an225, "price", priceNikkei);
        console.log("aTBILL", atbill, "price", priceTbill);
        console.log("JPYC", jpyc, "USDT", usdt);
        require(an225 != address(0) && atbill != address(0), "AN225/ATBILL required");
        address gopassAddr = vm.envOr("GOPASS_ADDR", address(0x0a6aD3b8B8D1A69Ba44002983e64e4824cB63334));
        console.log("GOPass", gopassAddr);
        try GOPass(gopassAddr).owner() returns (address o) { console.log("GOPass owner", o); } catch {}
        try GOPass(gopassAddr).worker() returns (address w) { console.log("GOPass worker", w); } catch {}

        vm.startBroadcast(pk);

        PrimaryMarket mNikkei = new PrimaryMarket(an225, jpyc, priceNikkei);
        console.log("PrimaryMarket Nikkei (aN225/JPYC) at", address(mNikkei), "price 38500 JPYC");

        PrimaryMarket mTBILL = new PrimaryMarket(atbill, usdt, priceTbill);
        console.log("PrimaryMarket T-Bill (aTBILL/USDT) at", address(mTBILL), "price 1.0247 USDT");

        // give markets GO Pass so GToken transfer to market passes eligibility (both sides checked)
        {
            GOPass hub = GOPass(gopassAddr);
            uint64 exp = uint64(block.timestamp + 365 days);
            // try mint + setActive; onlyOwner can mint, onlyWorkerOrOwner can setActive
            try hub.mint(address(mNikkei), GOPass.Record(10, 0, bytes2(0), bytes2(0), 7, exp, false, false, keccak256(abi.encodePacked(address(mNikkei))), "")) {
                console.log("minted pass for Nikkei market");
            } catch Error(string memory r) { console.log("mint Nikkei market failed:", r); } catch { console.log("mint Nikkei market failed low-level"); }
            try hub.setActive(address(mNikkei), true) { console.log("activated Nikkei market"); } catch Error(string memory r) { console.log("activate Nikkei failed:", r); } catch {}
            try hub.mint(address(mTBILL), GOPass.Record(10, 0, bytes2(0), bytes2(0), 1, exp, false, false, keccak256(abi.encodePacked(address(mTBILL))), "")) {
                console.log("minted pass for TBILL market");
            } catch Error(string memory r) { console.log("mint TBILL market failed:", r); } catch { console.log("mint TBILL market failed low-level"); }
            try hub.setActive(address(mTBILL), true) { console.log("activated TBILL market"); } catch {}
        }

        // transfer ownership to deployer already (Ownable), then deposit if owner holds RWA
        // deposit requires market has pass otherwise GToken transfer will revert; we already gave pass above or expect pre-minted
        uint256 depNikkei = deposit * 10 ** GToken(an225).decimals();
        uint256 depTBILL = deposit * 10 ** GToken(atbill).decimals();

        // try deposit if balance sufficient
        if (GToken(an225).balanceOf(deployer) >= depNikkei) {
            GToken(an225).approve(address(mNikkei), depNikkei);
            mNikkei.deposit(depNikkei);
            console.log("Deposited", depNikkei, "aN225 to Nikkei market");
        } else {
            console.log("Skip Nikkei deposit: balance", GToken(an225).balanceOf(deployer), "need", depNikkei);
        }
        if (GToken(atbill).balanceOf(deployer) >= depTBILL) {
            GToken(atbill).approve(address(mTBILL), depTBILL);
            mTBILL.deposit(depTBILL);
            console.log("Deposited", depTBILL, "aTBILL to TBill market");
        } else {
            console.log("Skip TBILL deposit: balance", GToken(atbill).balanceOf(deployer), "need", depTBILL);
        }

        vm.stopBroadcast();

        console.log("MARKET_NIKKEI", address(mNikkei));
        console.log("MARKET_TBILL", address(mTBILL));
        console.log("Done - wire frontend BuyDrawer to market.buy() with JPYC/USDT");
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
