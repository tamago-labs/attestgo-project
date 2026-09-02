// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Morpho} from "../src/Morpho.sol";
import {CoreVault} from "../src/CoreVault.sol";
import {SourceVault} from "../src/SourceVault.sol";
import {MarketParams, Id} from "../src/interfaces/IMorpho.sol";
import {MarketParamsLib} from "../src/libraries/MarketParamsLib.sol";
import {IOracle} from "../src/interfaces/IOracle.sol";

/**
 * 5_DeployLending — cross-chain lending deployment (see CROSS_CHAIN_LENDING_PLAN.md)
 *
 * Creditcoin side (LENDING_SIDE=credit, chain 102031):
 *   Deploys (or reuses) Morpho, CoreVault; wires remoteCollateralManager, source token mapping,
 *   enables lltv/irm, creates the market.
 *   Env: PRIVATE_KEY, SOURCE_VAULT_ADDR (Sepolia), SOURCE_CHAIN_ID (default 11155111),
 *        MORPHO_ADDR (optional reuse), WORKER_ADDR (default = deployer),
 *        USDC_CC (loan token), GTOKEN_CC (mirror collateral token), ORACLE_ADDR, IRM_ADDR (0 = none),
 *        LLTV (default 0.62e18), GTOKEN_SOURCE (source RWA token for mapping)
 *
 * Sepolia side (LENDING_SIDE=source, chain 11155111):
 *   Env: PRIVATE_KEY, WORKER_ADDR (default = deployer)
 *
 * Usage:
 *   LENDING_SIDE=credit  USDC_CC=0x.. GTOKEN_CC=0x.. GTOKEN_SOURCE=0x.. ORACLE_ADDR=0x.. SOURCE_VAULT_ADDR=0x.. \
 *     forge script script/5_DeployLending.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
 *   LENDING_SIDE=source forge script script/5_DeployLending.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 */
contract DeployLending is Script {
    using MarketParamsLib for MarketParams;

    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);
        string memory side = vm.envOr("LENDING_SIDE", string("credit"));

        console.log("DeployLending chainId", block.chainid);
        console.log("deployer", deployer);
        console.log("side", side);

        if (_eq(side, "source")) {
            require(block.chainid == 11155111 || block.chainid == 31337, "Wrong chain: SourceVault must be on Sepolia");
            address worker = vm.envOr("WORKER_ADDR", deployer);
            vm.startBroadcast(pk);
            SourceVault v = new SourceVault(worker);
            vm.stopBroadcast();
            console.log("SOURCE_VAULT_ADDR=%s", address(v));
            return;
        }

        require(block.chainid == 102031 || block.chainid == 102030 || block.chainid == 31337, "Wrong chain: CoreVault must be on Creditcoin");
        address usdc = vm.envAddress("USDC_CC");
        address gtokenCC = vm.envAddress("GTOKEN_CC");
        address gtokenSource = vm.envAddress("GTOKEN_SOURCE");
        address oracle = vm.envAddress("ORACLE_ADDR");
        address irm = vm.envAddress("IRM_ADDR"); // 0 = no interest accrual
        uint256 lltv = vm.envOr("LLTV", uint256(0.62e18));
        uint64 sourceChainId = uint64(vm.envOr("SOURCE_CHAIN_ID", uint256(11155111)));
        address worker = vm.envOr("WORKER_ADDR", deployer);
        address sourceVault = vm.envAddress("SOURCE_VAULT_ADDR");
        uint64 sourceChainKey = 1; // Sepolia chainKey for 0x0FD2 verifySingle

        require(usdc != address(0) && gtokenCC != address(0) && oracle != address(0), "zero token/oracle");
        require(sourceVault != address(0), "SOURCE_VAULT_ADDR zero");
        require(lltv > 0 && lltv < 1e18, "bad LLTV");

        vm.startBroadcast(pk);

        Morpho morpho;
        address existingMorpho = vm.envOr("MORPHO_ADDR", address(0));
        if (existingMorpho != address(0)) {
            morpho = Morpho(existingMorpho);
            console.log("Reusing Morpho", address(morpho));
        } else {
            morpho = new Morpho(deployer);
            console.log("Deployed Morpho", address(morpho));
        }
        if (!morpho.isLltvEnabled(lltv)) morpho.enableLltv(lltv);
        if (irm != address(0) && !morpho.isIrmEnabled(irm)) morpho.enableIrm(irm);
        if (irm == address(0) && !morpho.isIrmEnabled(address(0))) morpho.enableIrm(address(0));

        CoreVault coreVault = new CoreVault(address(morpho), sourceVault, sourceChainKey, sourceChainId, worker);
        console.log("CoreVault", address(coreVault));

        morpho.setRemoteCollateralManager(address(coreVault));
        coreVault.setSourceTokenMapping(gtokenSource, gtokenCC);

        MarketParams memory mp = MarketParams({
            loanToken: usdc,
            collateralToken: gtokenCC,
            oracle: oracle,
            irm: irm,
            lltv: lltv
        });
        (, , , , uint48 lastUpdate, ) = morpho.market(mp.id());
        if (lastUpdate == 0) {
            morpho.createMarket(mp);
            console.log("Market created", vm.toString(Id.unwrap(mp.id())));
        } else {
            console.log("Market already exists", vm.toString(Id.unwrap(mp.id())));
        }

        vm.stopBroadcast();

        console.log("CORE_VAULT_ADDR=%s", address(coreVault));
        console.log("MORPHO_ADDR=%s", address(morpho));
        console.log("MARKET_ID=%s", vm.toString(Id.unwrap(mp.id())));
        console.log("Next: fund+supply USDC via coreVault.supply; worker: scripts/lending/3_worker_unlock.ts");
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }

    function _eq(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
