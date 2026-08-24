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
        vm.stopBroadcast();

        console.log("\n[1/1] WrappedASTR deployed at:", address(wastr));
        console.log("      name:", wastr.name());
        console.log("      symbol:", wastr.symbol());
        console.log("      decimals:", wastr.decimals());
        console.log("      owner:", wastr.owner());
        console.log("      hasRole USC_MINTER for minter:", wastr.hasRole(keccak256("USC_MINTER"), minter));

        // Wrap must be separate tx on CC3 (pallet-evm NotActivated if batched in same script)
        // After this deploy, run:
        // cast send --rpc-url $CREDITCOIN_RPC_URL 0x2Be9B8640ED32815d3B9e8C92AbcD3F15F07396f "wrapOriginToken(address,address)" 0x052B3eAC16D43EF792589aae41BaD2205c6CC21C <wASTR> --private-key $PRIVATE_KEY

        address wrapped = IUSCMinter(minter).wrappedTokens(origin);
        console.log("\n===========================================");
        console.log("Verification (before wrap)");
        console.log("===========================================");
        console.log("WrappedASTR:", address(wastr));
        console.log("Minter.wrappedTokens(origin) before:", wrapped);
        console.log("  (will be 0x0 until you run wrapOriginToken via cast)");

        console.log("\n[OK] wASTR deployed -- now run wrap via cast");

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
