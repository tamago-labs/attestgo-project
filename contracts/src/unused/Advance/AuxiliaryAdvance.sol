// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AdvanceFlow} from "./AdvanceTypes.sol";

contract AuxiliaryAdvance is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event AdvanceFunded(uint256 indexed advanceId);
    event AdvanceRepaid(uint256 indexed advanceId, uint256 amount);

    mapping(address => bool) public authorizedTokens;
    mapping(uint256 => AdvanceFlow) public advanceFundFlows;
    mapping(uint256 => AdvanceFlow) public advanceRepayFlows;
    mapping(uint256 => uint256) public advanceFundAmounts;
    mapping(uint256 => bool) public advanceFundRegistered;
    mapping(uint256 => uint256) public advanceRepaymentAmounts;
    mapping(uint256 => bool) public advanceRepaymentRegistered;
    mapping(uint256 => bool) public expiredAdvances;

    constructor() {}

    function addAuthorizedToken(address token) external onlyOwner {
        require(token != address(0), "Invalid token");
        authorizedTokens[token] = true;
    }

    function removeAuthorizedToken(address token) external onlyOwner {
        authorizedTokens[token] = false;
    }

    function isTokenAuthorized(address token) external view returns (bool) {
        return authorizedTokens[token];
    }

    function validateFlow(address from, address to, address withToken) private view returns (bool) {
        require(from != address(0), "Invalid source");
        require(to != address(0), "Invalid target");
        require(from != to, "Source==target");
        require(authorizedTokens[withToken], "Token not authorized");
        return true;
    }

    function registerAdvanceFund(uint256 advanceId, AdvanceFlow calldata flow, uint256 fundAmount, uint256 repayAmount) external onlyOwner {
        require(!expiredAdvances[advanceId], "expired");
        require(!advanceFundRegistered[advanceId], "already registered");
        require(fundAmount > 0, "fund zero");
        require(validateFlow(flow.from, flow.to, flow.withToken), "Invalid flow");
        advanceFundAmounts[advanceId] = fundAmount;
        advanceFundFlows[advanceId] = flow;
        advanceFundRegistered[advanceId] = true;
        advanceRepaymentAmounts[advanceId] = repayAmount;
    }

    function fundAdvance(uint256 advanceId, uint256 amount, address from, address to, address token) external nonReentrant {
        require(!expiredAdvances[advanceId], "expired");
        require(msg.sender == from, "Only lender");
        require(amount > 0, "Amount zero");
        require(advanceFundRegistered[advanceId], "Not registered");
        require(advanceFundAmounts[advanceId] > 0, "Already funded");
        AdvanceFlow memory flow = advanceFundFlows[advanceId];
        require(flow.withToken == token, "Token mismatch");
        require(flow.from == from, "Lender mismatch");
        require(flow.to == to, "Borrower mismatch");
        uint256 expected = advanceFundAmounts[advanceId];
        if (amount > expected) amount = expected;
        IERC20(token).safeTransferFrom(from, to, amount);
        advanceFundAmounts[advanceId] -= amount;
        if (advanceFundAmounts[advanceId] == 0) {
            emit AdvanceFunded(advanceId);
            AdvanceFlow memory repayFlow = AdvanceFlow({from: flow.to, to: flow.from, withToken: flow.withToken});
            require(!advanceRepaymentRegistered[advanceId], "already repay reg");
            require(advanceRepaymentAmounts[advanceId] > 0, "repay zero");
            require(validateFlow(repayFlow.from, repayFlow.to, repayFlow.withToken), "Invalid repay flow");
            advanceRepayFlows[advanceId] = repayFlow;
            advanceRepaymentRegistered[advanceId] = true;
        }
    }

    function repayAdvance(uint256 advanceId, uint256 amount, address from, address to, address token) external nonReentrant {
        require(!expiredAdvances[advanceId], "expired");
        require(msg.sender == from, "Only borrower");
        require(amount > 0, "Amount zero");
        require(advanceRepaymentRegistered[advanceId], "Not registered for repay");
        require(advanceRepaymentAmounts[advanceId] > 0, "Already repaid");
        AdvanceFlow memory flow = advanceRepayFlows[advanceId];
        require(flow.withToken == token, "Token mismatch");
        require(flow.from == from, "Borrower mismatch");
        require(flow.to == to, "Lender mismatch");
        uint256 expected = advanceRepaymentAmounts[advanceId];
        if (amount > expected) amount = expected;
        IERC20(token).safeTransferFrom(from, to, amount);
        advanceRepaymentAmounts[advanceId] -= amount;
        emit AdvanceRepaid(advanceId, amount);
    }

    function markAdvanceAsExpired(uint256 advanceId) external onlyOwner {
        expiredAdvances[advanceId] = true;
    }
}
