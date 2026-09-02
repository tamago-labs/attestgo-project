// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * SourceVault — RWA collateral escrow on the source chain (ETH Sepolia 11155111, chainKey 1).
 *
 * Borrowers `lock` RWA (e.g. GToken) here. The lock tx is proven on Creditcoin via the Attestcoin
 * Protocol (ProofBuilder + Block Prover Precompile 0x0FD2 `verifySingle`), and CoreVault credits the
 * borrower's remote collateral position on the Morpho market. No wrapped token is minted.
 *
 * Unlock path (CC → source, trusted worker): CoreVault emits `UnlockRequested` on Creditcoin when a
 * borrower repays + withdraws remote collateral, or when a liquidator claims seized collateral. The
 * worker then calls `unlock` here. Accounting is cumulative per (recipient, token): unlocks are
 * amount-based, FIFO across the recipient's locks.
 */
contract SourceVault is Ownable {
    using SafeERC20 for IERC20;

    struct Lock {
        address recipient;
        address collateralToken;
        uint256 amount;
        bytes32 marketId;
    }

    address public worker;
    uint256 public nonce;

    /// @dev lockId => lock details (traceability).
    mapping(bytes32 => Lock) public locks;

    /// @dev recipient => collateralToken => cumulative locked amount.
    mapping(address => mapping(address => uint256)) public lockedTotal;

    /// @dev recipient => collateralToken => cumulative unlocked amount.
    mapping(address => mapping(address => uint256)) public unlockedTotal;

    event Locked(
        bytes32 indexed lockId,
        address indexed recipient,
        address indexed collateralToken,
        uint256 amount,
        bytes32 marketId,
        uint64 nonce
    );
    event Unlocked(address indexed recipient, address indexed collateralToken, uint256 amount);
    event WorkerUpdated(address indexed worker);

    modifier onlyWorkerOrOwner() {
        require(msg.sender == worker || msg.sender == owner(), "only worker/owner");
        _;
    }

    constructor(address worker_) {
        require(worker_ != address(0), "worker zero");
        worker = worker_;
        emit WorkerUpdated(worker_);
    }

    function setWorker(address newWorker) external onlyOwner {
        require(newWorker != address(0), "worker zero");
        worker = newWorker;
        emit WorkerUpdated(newWorker);
    }

    /**
     * @notice Locks `amount` of `collateralToken` in escrow for `recipient` on market `marketId`.
     * @param nonceArg Must equal the vault's current nonce (makes lockId fully determined by calldata,
     *                 enabling on-chain recomputation from the verified tx).
     */
    function lock(
        address recipient,
        address collateralToken,
        uint256 amount,
        bytes32 marketId,
        uint256 nonceArg
    ) external returns (bytes32 lockId) {
        require(recipient != address(0), "recipient zero");
        require(collateralToken != address(0), "token zero");
        require(amount != 0, "amount zero");
        require(nonceArg == nonce, "nonce mismatch");

        nonce = nonceArg + 1;

        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), amount);

        lockId = keccak256(
            abi.encode(block.chainid, collateralToken, recipient, amount, marketId, nonceArg)
        );
        locks[lockId] = Lock({recipient: recipient, collateralToken: collateralToken, amount: amount, marketId: marketId});
        lockedTotal[recipient][collateralToken] += amount;

        emit Locked(lockId, recipient, collateralToken, amount, marketId, uint64(nonceArg));
    }

    /**
     * @notice Unlocks `amount` of `collateralToken` to `recipient` (called by the trusted worker after
     *         an `UnlockRequested` on Creditcoin, or by the owner as backup).
     * @dev Amount-based cumulative accounting: FIFO across the recipient's locks.
     */
    function unlock(address recipient, address collateralToken, uint256 amount) external onlyWorkerOrOwner {
        require(amount != 0, "amount zero");
        uint256 locked = lockedTotal[recipient][collateralToken];
        uint256 unlocked = unlockedTotal[recipient][collateralToken];
        require(locked - unlocked >= amount, "insufficient locked");

        unlockedTotal[recipient][collateralToken] = unlocked + amount;

        IERC20(collateralToken).safeTransfer(recipient, amount);

        emit Unlocked(recipient, collateralToken, amount);
    }

    /// @notice Available (not yet unlocked) collateral for a recipient/token pair.
    function available(address recipient, address collateralToken) external view returns (uint256) {
        return lockedTotal[recipient][collateralToken] - unlockedTotal[recipient][collateralToken];
    }
}
