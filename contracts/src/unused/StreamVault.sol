// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * StreamVault — CC3 side vest for AttestStream.createStream
 *
 * 1 Sepolia createStream(total, duration, attestId) → worker proves → USC minter mints wASTR total to this vault
 * Vault holds wASTR and releases linearly: vested = total * (now - start) / duration
 * Recipient calls withdraw() anytime; payer can cancel unvested after duration.
 *
 * Minimal, no PriceOracle, no liquidation — pairs with app/payment-streams My Streams.
 */
contract StreamVault is Ownable {
    struct Stream {
        address payer;
        address recipient;
        address token; // wASTR
        uint256 total;
        uint256 duration;
        uint256 start;
        uint256 withdrawn;
        bytes32 attestId;
        bool exists;
    }

    mapping(uint256 => Stream) public streams; // streamId from Sepolia => vault stream
    mapping(uint256 => bool) public proven; // prevent replay via USC

    bytes32 public constant USC_MINTER = keccak256("USC_MINTER");
    address public minter; // 0x2Be9... USC minter that calls onStreamProven

    event StreamProven(uint256 indexed streamId, address indexed payer, address indexed recipient, uint256 total, uint256 duration, bytes32 attestId);
    event Withdrawn(uint256 indexed streamId, address indexed recipient, uint256 amount);
    event StreamCancelled(uint256 indexed streamId, uint256 refund);

    constructor(address _minter) {
        minter = _minter;
    }

    modifier onlyMinter() {
        require(msg.sender == minter, "only minter");
        _;
    }

    // Called by USC minter wrapper after verifying createStream proof (action=1)
    // Alternatively worker can call directly if you add onlyMinter, but keep simple: owner (deployer) or minter.
    function onStreamProven(
        uint256 streamId,
        address payer,
        address recipient,
        uint256 total,
        uint256 duration,
        bytes32 attestId,
        address token
    ) external onlyMinter {
        require(!proven[streamId], "already proven");
        require(!streams[streamId].exists, "stream exists");
        proven[streamId] = true;
        streams[streamId] = Stream({
            payer: payer,
            recipient: recipient,
            token: token,
            total: total,
            duration: duration,
            start: block.timestamp,
            withdrawn: 0,
            attestId: attestId,
            exists: true
        });
        emit StreamProven(streamId, payer, recipient, total, duration, attestId);
    }

    // Allow owner to register for testing without minter (remove in prod)
    function onStreamProvenAsOwner(
        uint256 streamId,
        address payer,
        address recipient,
        uint256 total,
        uint256 duration,
        bytes32 attestId,
        address token
    ) external onlyOwner {
        require(!proven[streamId], "already proven");
        proven[streamId] = true;
        streams[streamId] = Stream({
            payer: payer,
            recipient: recipient,
            token: token,
            total: total,
            duration: duration,
            start: block.timestamp,
            withdrawn: 0,
            attestId: attestId,
            exists: true
        });
        emit StreamProven(streamId, payer, recipient, total, duration, attestId);
    }

    function vested(uint256 streamId) public view returns (uint256) {
        Stream memory s = streams[streamId];
        require(s.exists, "no stream");
        if (block.timestamp >= s.start + s.duration) return s.total;
        return (s.total * (block.timestamp - s.start)) / s.duration;
    }

    function withdrawable(uint256 streamId) public view returns (uint256) {
        Stream memory s = streams[streamId];
        uint256 v = vested(streamId);
        return v > s.withdrawn ? v - s.withdrawn : 0;
    }

    function withdraw(uint256 streamId) external {
        Stream storage s = streams[streamId];
        require(s.exists, "no stream");
        require(msg.sender == s.recipient, "only recipient");
        uint256 amount = withdrawable(streamId);
        require(amount > 0, "nothing vested");
        s.withdrawn += amount;
        require(IERC20(s.token).transfer(s.recipient, amount), "transfer failed");
        emit Withdrawn(streamId, s.recipient, amount);
    }

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }
}
