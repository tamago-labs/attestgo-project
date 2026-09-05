// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {PriceOracle} from "../src/PriceOracle.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";

/**
 * 6_DeployOracle — deploy the market PriceOracle on Creditcoin.
 *
 * Binds one instance to one collateral/loan pair. Starts in fallback mode (admin-set USD
 * prices, 1e18-scaled); feeds (Chainlink-style aggregators) can be attached later via
 * setBkcFeed/setOracleMode. Idempotent: set ORACLE_ADDR to reuse.
 *
 * Env: PRIVATE_KEY, ORACLE_ADDR (optional reuse),
 *      LOAN_TOKEN, COLLATERAL_TOKEN,
 *      COLLATERAL_USD, LOAN_USD  (1e18-scaled USD prices, required when deploying),
 *      LOAN_DECIMALS (default 6), COLLATERAL_DECIMALS (default 18)
 * Usage:
 *   COLLATERAL_USD=1000000000000000000 LOAN_USD=1000000000000000000 \
 *   LOAN_TOKEN=0x.. COLLATERAL_TOKEN=0x.. \
 *   forge script script/6_DeployOracle.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
 */
contract DeployOracle is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);

        console.log("DeployOracle chainId", block.chainid);
        console.log("deployer", deployer);
        require(block.chainid == 102031 || block.chainid == 102030 || block.chainid == 31337, "Wrong chain: oracle must be on Creditcoin");

        address existing = vm.envOr("ORACLE_ADDR", address(0));
        if (existing != address(0)) {
            require(existing.code.length > 0, "ORACLE_ADDR has no code");
            uint256 p = IOracle(existing).price();
            require(p > 0, "existing oracle price() is zero");
            console.log("Reusing oracle, price", p);
            console.log("ORACLE_ADDR=%s", existing);
            return;
        }

        address loanToken = vm.envOr("LOAN_TOKEN", address(0));
        address collateralToken = vm.envOr("COLLATERAL_TOKEN", address(0));
        uint256 collUsd = vm.envOr("COLLATERAL_USD", uint256(0));
        uint256 loanUsd = vm.envOr("LOAN_USD", uint256(0));
        uint8 loanDecimals = uint8(vm.envOr("LOAN_DECIMALS", uint256(6)));
        uint8 collDecimals = uint8(vm.envOr("COLLATERAL_DECIMALS", uint256(18)));

        require(loanToken != address(0), "LOAN_TOKEN required (env or USDC_CC)");
        require(collateralToken != address(0), "COLLATERAL_TOKEN required (env or GTOKEN_CC)");
        require(collUsd > 0 && loanUsd > 0, "COLLATERAL_USD and LOAN_USD required (1e18-scaled)");

        vm.startBroadcast(pk);
        PriceOracle oracle = new PriceOracle(
            loanToken, collateralToken, collUsd, loanUsd, loanDecimals, collDecimals
        );
        vm.stopBroadcast();

        console.log("ORACLE_ADDR=%s", address(oracle));
        console.log("Oracle price", IOracle(address(oracle)).price());
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
