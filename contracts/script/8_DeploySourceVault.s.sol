// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {SourceVault} from "../src/SourceVault.sol";
import {GOPass} from "../src/GOPass.sol";

/**
 * 8_DeploySourceVault — deploy the RWA collateral escrow on Sepolia.
 * The Locked event emitted by lock() is the payload proven via Attestcoin
 * (ProofBuilder -> 0x0FD2 verifySingle -> CoreVault.verifyAndSupplyCollateral).
 *
 * Env: PRIVATE_KEY, WORKER_ADDR (default = deployer; the CC->ETH settlement worker), GOPASS_ADDR (Sepolia 0x0a6a...)
 * Usage:
 *   forge script script/8_DeploySourceVault.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --legacy
 *   Note: gives SourceVault a GO Pass (tier 10, JP/SG/US) so GToken lock() passes _checkEligible(to).
 */
contract DeploySourceVault is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        uint256 pk = _parse(pkStr);
        address deployer = vm.addr(pk);

        console.log("DeploySourceVault chainId", block.chainid);
        console.log("deployer", deployer);
        require(block.chainid == 11155111 || block.chainid == 31337, "Wrong chain: SourceVault must be on Sepolia");

        address worker = vm.envOr("WORKER_ADDR", deployer);
        address gopassAddr = vm.envOr("GOPASS_ADDR", address(0x0a6aD3b8B8D1A69Ba44002983e64e4824cB63334));

        vm.startBroadcast(pk);
        SourceVault v = new SourceVault(worker);
        console.log("SourceVault", address(v));

        // give vault GO Pass so GToken transfers to it pass eligibility
        {
            GOPass hub = GOPass(gopassAddr);
            uint64 exp = uint64(block.timestamp + 365 days);
            try hub.mint(address(v), GOPass.Record(10, 0, bytes2(0), bytes2(0), 1, exp, false, false, keccak256(abi.encodePacked(address(v))), "")) {
                console.log("minted pass for SourceVault (US only)");
            } catch Error(string memory r) { console.log("mint SourceVault failed:", r); } catch { console.log("mint SourceVault failed low-level"); }
            try hub.setActive(address(v), true) { console.log("activated SourceVault"); } catch {}
        }
        vm.stopBroadcast();

        console.log("SOURCE_VAULT_ADDR=%s", address(v));
        console.log("Next: deploy core side (9_DeployCoreVault) with SOURCE_VAULT_ADDR");
    }

    function _parse(string memory s) internal pure returns (uint256) {
        if (bytes(s)[0] == '0' && bytes(s)[1] == 'x') return vm.parseUint(s);
        return vm.parseUint(string(abi.encodePacked("0x", s)));
    }
}
