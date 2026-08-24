// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {AttestStream} from "../src/AttestStream.sol";

/**
 * @title DeployAttestStream
 * @notice Deploy AttestStream (payment stream token) for AttestGO
 * @dev Usage:
 *   forge script script/3-DeployAttestStream.s.sol --rpc-url $SOURCE_CHAIN_RPC_URL --broadcast --legacy
 *   forge script script/3-DeployAttestStream.s.sol --rpc-url $SOURCE_CHAIN_RPC_URL --broadcast --verify --legacy  # if etherscan key set
 *
 *   Env:
 *   - PRIVATE_KEY: deployer key (same as CREDITCOIN_WALLET_PRIVATE_KEY for Sepolia)
 *
 * Checks after deploy: name/symbol/decimals/totalSupply + StreamPayment sig + balance
 */
contract DeployAttestStream is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parsePrivateKey(pkStr);
        address deployer = vm.addr(pk);

        console.log("===========================================");
        console.log("Deploy AttestStream (ASTR)");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Block:", block.number);
        console.log("Balance:", deployer.balance / 1e18, "native");

        require(deployer.balance > 0.001 ether, "Insufficient Sepolia ETH");

        vm.startBroadcast(pk);

        AttestStream attest = new AttestStream();
        console.log("\n[1/1] AttestStream deployed at:", address(attest));

        vm.stopBroadcast();

        // Checks (read-only, no gas)
        console.log("\n===========================================");
        console.log("Verification");
        console.log("===========================================");
        console.log("Address:", address(attest));
        console.log("Name:", attest.name());
        console.log("Symbol:", attest.symbol());
        console.log("Decimals:", attest.decimals());
        console.log("TotalSupply:", attest.totalSupply());
        console.log("Deployer ASTR:", attest.balanceOf(deployer));
        console.log("StreamPayment sig:");
        console.logBytes32(attest.getStreamPaymentEventSignature());
        console.log("Explorer: https://sepolia.etherscan.io/address/%s", address(attest));

        require(address(attest) != address(0), "deploy failed");
        require(attest.balanceOf(deployer) == 1_000_000 ether, "initial mint mismatch");

        console.log("\n[OK] AttestStream deployed");

        console.log("\n===========================================");
        console.log("Update .env:");
        console.log("===========================================");
        console.log("SOURCE_CHAIN_CONTRACT_ADDRESS=%s", address(attest));
        console.log("SOURCE_CHAIN_CUSTOM_CONTRACT_ADDRESS=%s", address(attest));
        console.log("===========================================");
        console.log("\nNext:");
        console.log("cast send --rpc-url $SOURCE_CHAIN_RPC_URL %s \"payStream(address,uint256,bytes32,uint256,string)\" <recipient> 1000000000000000000 0x<attestId> 1 \"salary\" --private-key $PRIVATE_KEY", address(attest));
        console.log("npx tsx scripts/2_verify_single_view.ts <txHash>");
        console.log("npx tsx scripts/5_worker.ts  # watches StreamPayment");
    }

    function _parsePrivateKey(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
