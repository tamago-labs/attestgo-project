// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {PriceOracle} from "../src/PriceOracle.sol";

/**
 * @title DeployOracles
 * @notice Deploy 3 PriceOracle contracts for the lending markets
 *         All oracles use fallback mode (mode 0) with hardcoded USD prices
 *
 * Markets:
 *   1. KUSDT (loan) <> KKUB (collateral)   — KKUB=$0.49,  KUSDT=$0.9988
 *   2. KKUB  (loan) <> KUSDT (collateral)  — KUSDT=$0.9988, KKUB=$0.49
 *   3. KUSDT (loan) <> KUSDT (collateral)  — KUSDT=$0.9988, KUSDT=$0.9988
 *
 * @dev Usage:
 *   forge script script/2-DeployOracles.s.sol --rpc-url $RPC_URL --broadcast --legacy
 *
 *   Environment variables:
 *   - PRIVATE_KEY: Deployer private key
 */
contract DeployOracles is Script {

    // Token addresses
    address kkubAddress;
    address kusdtAddress;

    // Prices in USD, scaled by 1e18
    uint256 constant KKUB_USD_PRICE  = 0.49e18;      // $0.49
    uint256 constant KUSDT_USD_PRICE = 0.9988e18;     // $0.9988

    // All tokens have 18 decimals
    uint8 constant DECIMALS_18 = 18;

    function run() external {
        string memory privateKeyString = vm.envString("PRIVATE_KEY");
        uint256 deployerPrivateKey = _parsePrivateKey(privateKeyString);
        address deployer = vm.addr(deployerPrivateKey);

        // Token addresses
        kkubAddress  = 0x33061AE7c93308F6c79a1D8DE3c399645aE28D57;
        kusdtAddress = 0x78bb1584fF13E93dD42B90b0F47C893e1B6031CC;

        console.log("===========================================");
        console.log("Deploy Price Oracles (Fallback Mode)");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("KKUB  address:", kkubAddress);
        console.log("KUSDT address:", kusdtAddress);
        console.log("KKUB  price: $0.49");
        console.log("KUSDT price: $0.9988");
        console.log("===========================================");

        require(kkubAddress  != address(0), "KKUB_ADDRESS not set");
        require(kusdtAddress != address(0), "KUSDT_ADDRESS not set");

        vm.startBroadcast(deployerPrivateKey);

        // Oracle 1: KUSDT (loan) <> KKUB (collateral)
        //   collateralPrice = KKUB = $0.49,  loanPrice = KUSDT = $0.9988
        PriceOracle oracle1 = new PriceOracle(
            kusdtAddress,       // loanToken
            kkubAddress,        // collateralToken
            KKUB_USD_PRICE,     // initialCollateralUsdPrice ($0.49)
            KUSDT_USD_PRICE,    // initialLoanUsdPrice ($0.9988)
            DECIMALS_18,        // loanTokenDecimals (KUSDT)
            DECIMALS_18         // collateralTokenDecimals (KKUB)
        );
        console.log("\n[1/3] Oracle (KUSDT/KKUB) deployed at:", address(oracle1));

        // Oracle 2: KKUB (loan) <> KUSDT (collateral)
        //   collateralPrice = KUSDT = $0.9988, loanPrice = KKUB = $0.49
        PriceOracle oracle2 = new PriceOracle(
            kkubAddress,        // loanToken
            kusdtAddress,       // collateralToken
            KUSDT_USD_PRICE,    // initialCollateralUsdPrice ($0.9988)
            KKUB_USD_PRICE,     // initialLoanUsdPrice ($0.49)
            DECIMALS_18,        // loanTokenDecimals (KKUB)
            DECIMALS_18         // collateralTokenDecimals (KUSDT)
        );
        console.log("[2/3] Oracle (KKUB/KUSDT) deployed at:", address(oracle2));

        // Oracle 3: KUSDT (loan) <> KUSDT (collateral)
        //   collateralPrice = KUSDT = $0.9988, loanPrice = KUSDT = $0.9988
        PriceOracle oracle3 = new PriceOracle(
            kusdtAddress,       // loanToken
            kusdtAddress,       // collateralToken
            KUSDT_USD_PRICE,    // initialCollateralUsdPrice ($0.9988)
            KUSDT_USD_PRICE,    // initialLoanUsdPrice ($0.9988)
            DECIMALS_18,        // loanTokenDecimals (KUSDT)
            DECIMALS_18         // collateralTokenDecimals (KUSDT)
        );
        console.log("[3/3] Oracle (KUSDT/KUSDT) deployed at:", address(oracle3));

        vm.stopBroadcast();

        // Verification
        console.log("\n===========================================");
        console.log("Oracle Deployment Results");
        console.log("===========================================");
        console.log("Oracle 1 (KUSDT loan / KKUB collateral):", address(oracle1));
        console.log("Oracle 2 (KKUB loan / KUSDT collateral):", address(oracle2));
        console.log("Oracle 3 (KUSDT loan / KUSDT collateral):", address(oracle3));

        // Sanity checks
        require(address(oracle1) != address(0), "Oracle 1 deployment failed");
        require(address(oracle2) != address(0), "Oracle 2 deployment failed");
        require(address(oracle3) != address(0), "Oracle 3 deployment failed");

        console.log("\n[OK] All 3 oracles deployed successfully!");

        console.log("\n===========================================");
        console.log("Update your .env with:");
        console.log("===========================================");
        console.log("ORACLE_KUSDT_KKUB_ADDRESS=%s", address(oracle1));
        console.log("ORACLE_KKUB_KUSDT_ADDRESS=%s", address(oracle2));
        console.log("ORACLE_KUSDT_KUSDT_ADDRESS=%s", address(oracle3));
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
