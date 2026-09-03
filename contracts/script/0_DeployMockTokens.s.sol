// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {ERC20Mock} from "../src/mocks/ERC20Mock.sol";

/**
 * @title 0_DeployMockTokens
 * @notice Deploy 4 mock ERC20 tokens: Sepolia JPYC (18) + USDT (6), Creditcoin ATC (18) + cUSDT (6) 
 * @dev Usage:
 *   Sepolia: forge script script/0_DeployMockTokens.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 *   Creditcoin: forge script script/0_DeployMockTokens.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
 */
contract DeployMockTokens is Script {
    function run() external {
        string memory privateKeyString = vm.envString("PRIVATE_KEY");
        uint256 deployerPrivateKey = _parsePrivateKey(privateKeyString);
        address deployer = vm.addr(deployerPrivateKey);

        console.log("===========================================");
        console.log("Deploy Mock Tokens: JPYC(18) USDT(6) ATC(18) cUSDT(6)");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Block number:", block.number);

        uint256 balance = deployer.balance;
        console.log("Deployer balance:", balance / 1e18, "native tokens");
        require(balance > 0.01 ether, "Insufficient balance for deployment");

        vm.startBroadcast(deployerPrivateKey);

        bool isSepolia = block.chainid == 11155111;
        bool isCreditcoin = block.chainid == 102031;

        address jpycAddr;
        address usdtAddr;
        address atcAddr;
        address cusdtAddr;

        if (isSepolia || (!isSepolia && !isCreditcoin)) {
            ERC20Mock jpyc = new ERC20Mock("JPY Coin", "JPYC", 18);
            console.log("JPYC  (18) deployed at:", address(jpyc));
            jpycAddr = address(jpyc);

            ERC20Mock usdt = new ERC20Mock("Tether USD", "USDT", 6);
            console.log("USDT  (6)  deployed at:", address(usdt));
            usdtAddr = address(usdt);
        }

        if (isCreditcoin || (!isSepolia && !isCreditcoin)) {
            ERC20Mock atc = new ERC20Mock("Attestcoin", "ATC", 18);
            console.log("ATC   (18) deployed at:", address(atc));
            atcAddr = address(atc);

            ERC20Mock cusdt = new ERC20Mock("Credit USDT", "cUSDT", 6);
            console.log("cUSDT (6)  deployed at:", address(cusdt));
            cusdtAddr = address(cusdt);
        }

        vm.stopBroadcast();

        console.log("\n===========================================");
        console.log("Deployment Results");
        console.log("===========================================");
        if (jpycAddr != address(0)) console.log("JPYC  (18) Sepolia      :", jpycAddr);
        if (usdtAddr != address(0)) console.log("USDT  (6)  Sepolia      :", usdtAddr);
        if (atcAddr != address(0)) console.log("ATC   (18) Creditcoin   :", atcAddr);
        if (cusdtAddr != address(0)) console.log("cUSDT (6)  Creditcoin   :", cusdtAddr);

        if (isSepolia) {
            require(jpycAddr != address(0) && usdtAddr != address(0), "Sepolia deploy failed");
        } else if (isCreditcoin) {
            require(atcAddr != address(0) && cusdtAddr != address(0), "Creditcoin deploy failed");
        } else {
            require(jpycAddr != address(0) && usdtAddr != address(0) && atcAddr != address(0) && cusdtAddr != address(0), "Local deploy failed");
        }

        console.log("\n[OK] Mock tokens deployed - anyone can mint via ERC20Mock.mint(to, amount)");

        console.log("\n===========================================");
        console.log("Update your .env with:");
        console.log("===========================================");
        if (jpycAddr != address(0)) console.log("JPYC_ADDRESS=%s", jpycAddr);
        if (usdtAddr != address(0)) console.log("USDT_ADDRESS=%s", usdtAddr);
        if (atcAddr != address(0)) console.log("ATC_ADDRESS=%s", atcAddr);
        if (cusdtAddr != address(0)) console.log("CUSDT_ADDRESS=%s", cusdtAddr);
        console.log("===========================================");
    }

    function _parsePrivateKey(string memory privateKeyString) internal pure returns (uint256) {
        if (bytes(privateKeyString)[0] == '0' && bytes(privateKeyString)[1] == 'x') {
            return vm.parseUint(privateKeyString);
        } else {
            return vm.parseUint(string(abi.encodePacked("0x", privateKeyString)));
        }
    }
}
