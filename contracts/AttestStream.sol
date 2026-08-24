// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * AttestStream — minimal source-chain contract for AttestGO payment streams
 *
 * Mimics TestERC20 burn pattern but adds AttestGO-specific events for
 * Travel Rule + payment-stream use case.
 *
 * On Sepolia: users lock/burn tokens to create a stream payment.
 * The emitted StreamPayment event is what the offchain worker watches and
 * proves via Attestcoin readability on Creditcoin CC3 Testnet.
 *
 * Keep logic minimal per dapp-design-patterns-readability: single contract,
 * unambiguous event, include all fields needed on Creditcoin side.
 */
contract AttestStream is ERC20 {
    address public constant BURN_ADDRESS = address(1);

    // AttestGO stream payment — worker listens for this
    // attestId can carry Travel Rule hash / offchain attestcoin id
    event StreamPayment(
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed attestId,
        uint256 streamId,
        string memo
    );

    // Legacy burn event kept for hello-bridge compatibility
    event TokensBurnedForBridging(address indexed from, uint256 value);

    constructor() ERC20("Attest Stream Token", "ASTR") {
        _mint(msg.sender, 1_000_000 ether);
    }

    function mint(uint256 amount) external returns (bool) {
        _mint(msg.sender, amount);
        return true;
    }

    // Generic burn (hello-bridge compatible)
    function burn(uint256 amount) external returns (bool) {
        _transfer(msg.sender, BURN_ADDRESS, amount);
        emit TokensBurnedForBridging(msg.sender, amount);
        return true;
    }

    // AttestGO stream payment: burn + emit StreamPayment
    function payStream(
        address recipient,
        uint256 amount,
        bytes32 attestId,
        uint256 streamId,
        string calldata memo
    ) external returns (bool) {
        _transfer(msg.sender, BURN_ADDRESS, amount);
        emit StreamPayment(msg.sender, recipient, amount, attestId, streamId, memo);
        // also emit legacy event for any generic minter that only watches TokensBurnedForBridging
        emit TokensBurnedForBridging(msg.sender, amount);
        return true;
    }

    // View helper for SDK testing
    function getStreamPaymentEventSignature() external pure returns (bytes32) {
        return keccak256("StreamPayment(address,address,uint256,bytes32,uint256,string)");
    }
}
