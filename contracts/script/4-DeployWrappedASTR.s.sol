// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {WrappedASTR} from "../src/WrappedASTR.sol";

interface IUSCMinter {
    function wrapOriginToken(address originToken, address targetToken) external;
    function wrappedTokens(address) external view returns (address);
}

/**
 * @title DeployWrappedASTR
 * @notice Deploy WrappedASTR (wASTR) on Creditcoin and register Sepolia AttestStream as origin
 * @dev Usage:
 *   forge script script/4-DeployWrappedASTR.s.sol --rpc-url $CREDITCOIN_RPC_URL --broadcast --legacy
 *
 *   Env:
 *   - PRIVATE_KEY: deployer (must own wASTR after deploy)
 *   - SOURCE_CHAIN_CONTRACT_ADDRESS: Sepolia AttestStream 0x052B... (origin)
 *   - USC_MINTER_CONTRACT_ADDRESS: Creditcoin minter 0x2Be9... (or your custom minter)
 */
contract DeployWrappedASTR is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parsePrivateKey(pkStr);
        address deployer = vm.addr(pk);

        address origin = vm.envAddress("SOURCE_CHAIN_CONTRACT_ADDRESS");
        address minter = vm.envAddress("USC_MINTER_CONTRACT_ADDRESS");

        console.log("===========================================");
        console.log("Deploy WrappedASTR (wASTR) on Creditcoin");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Origin (Sepolia AttestStream):", origin);
        console.log("Minter (Creditcoin):", minter);
        require(origin != address(0), "SOURCE_CHAIN_CONTRACT_ADDRESS not set");
        require(minter != address(0), "USC_MINTER_CONTRACT_ADDRESS not set");

        vm.startBroadcast(pk);

        WrappedASTR wastr = new WrappedASTR(minter);
        console.log("\n[1/2] WrappedASTR deployed at:", address(wastr));
        console.log("      name:", wastr.name());
        console.log("      symbol:", wastr.symbol());
        console.log("      decimals:", wastr.decimals());

        IUSCMinter(minter).wrapOriginToken(origin, address(wastr));
        console.log("[2/2] wrapOriginToken(origin, wASTR) called");

        vm.stopBroadcast();

        address wrapped = IUSCMinter(minter).wrappedTokens(origin);
        console.log("\n===========================================");
        console.log("Verification");
        console.log("===========================================");
        console.log("WrappedASTR:", address(wastr));
        console.log("Minter.wrappedTokens(origin):", wrapped);
        require(wrapped == address(wastr), "wrap failed");

        console.log("\n[OK] wASTR deployed and wrapped");

        console.log("\n===========================================");
        console.log("Update .env:");
        console.log("===========================================");
        console.log("WRAPPED_ASTR_ADDRESS=%s", address(wastr));
        console.log("USC_MINTABLE_TOKEN=%s", address(wastr));
        console.log("===========================================");
        console.log("\nNext: payStream on Sepolia 0x052B then:");
        console.log("npx tsx scripts/2_verify_single_view.ts <txHash>  # view");
        console.log("npx tsx scripts/5_worker.ts  # auto-mints wASTR on Creditcoin");
        console.log("cast call --rpc-url $CREDITCOIN_RPC_URL %s \"balanceOf(address)(uint256)\" <recipient>", address(wastr));
    }

    function _parsePrivateKey(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
