// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {AdvanceFlow, AdvanceStatus, AdvanceOrder, AdvanceTerms} from "./AdvanceTypes.sol";

/**
 * AdvanceManager — CC3 side for AttestGo advances against payment streams (separate from streams vault)
 * Simplified: worker does Attestcoin view verify offchain, then calls markFunded/markRepaid as owner/manager.
 * No on-chain EvmV1Decoder to keep 0.8.19 + OZ v4.9.6 compatible and avoid USCBase/prevrandao.
 * For production, replace with USCBase + EvmV1Decoder as in loan-flow USCLoanManager.
 */
contract AdvanceManager is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    mapping(uint256 => AdvanceOrder) public advanceOrders;
    mapping(uint256 => bool) public registeredAdvances;
    address public sourceAdvanceContract;
    uint256 public nextAdvanceId;

    event AdvanceRegistered(uint256 indexed advanceId, address indexed lender, address indexed borrower, uint256 loanAmount, uint256 repayAmount, uint256 deadlineBlockNumber, uint256 collateralStreamId);
    event AdvanceFunded(uint256 indexed advanceId);
    event AdvanceRepaid(uint256 indexed advanceId);
    event AdvancePartiallyRepaid(uint256 indexed advanceId, uint256 amount);
    event AdvanceExpired(uint256 indexed advanceId);
    event SourceAdvanceContractRegistered(address indexed sourceAdvanceContract);

    address public worker; // authorized to mark funded/repaid after offchain proof

    constructor() {
        nextAdvanceId = 1;
    }

    function setWorker(address _worker) external onlyOwner {
        worker = _worker;
    }

    function registerSourceAdvanceContract(address _sourceAdvanceContract) external onlyOwner {
        require(_sourceAdvanceContract != address(0), "zero");
        sourceAdvanceContract = _sourceAdvanceContract;
        emit SourceAdvanceContractRegistered(_sourceAdvanceContract);
    }

    function registerAdvance(
        AdvanceFlow memory fundFlow,
        AdvanceFlow memory repayFlow,
        AdvanceTerms memory terms,
        bytes memory sigLender,
        bytes memory sigBorrower
    ) external onlyOwner returns (uint256) {
        require(terms.loanAmount > 0, "loan zero");
        require(terms.deadlineBlockNumber > block.number, "deadline past");
        require(terms.expectedRepaymentAmount >= terms.loanAmount, "repay < loan");

        bytes32 messageHash = keccak256(abi.encodePacked(
            fundFlow.from, fundFlow.to, fundFlow.withToken,
            repayFlow.from, repayFlow.to, repayFlow.withToken,
            terms.loanAmount, terms.interestRate, terms.expectedRepaymentAmount, terms.deadlineBlockNumber, terms.collateralStreamId
        ));
        bytes32 ethHash = ECDSA.toEthSignedMessageHash(messageHash);
        address recLender = ECDSA.recover(ethHash, sigLender);
        address recBorrower = ECDSA.recover(ethHash, sigBorrower);
        require(recLender == fundFlow.from, "Invalid lender sig");
        require(recBorrower == fundFlow.to, "Invalid borrower sig");

        uint256 advanceId = nextAdvanceId;
        advanceOrders[advanceId] = AdvanceOrder({
            fundFlow: fundFlow,
            repayFlow: repayFlow,
            terms: terms,
            signatureOfLender: sigLender,
            signatureOfBorrower: sigBorrower,
            createdAtBlock: block.number,
            status: AdvanceStatus.Created,
            repaidAmount: 0
        });
        registeredAdvances[advanceId] = true;
        emit AdvanceRegistered(advanceId, fundFlow.from, fundFlow.to, terms.loanAmount, terms.expectedRepaymentAmount, terms.deadlineBlockNumber, terms.collateralStreamId);
        nextAdvanceId += 1;
        return advanceId;
    }

    function markAdvanceAsFunded(uint256 advanceId) external {
        require(msg.sender == worker || msg.sender == owner(), "only worker/owner");
        AdvanceOrder storage adv = advanceOrders[advanceId];
        require(adv.status == AdvanceStatus.Created, "not Created");
        require(block.number <= adv.terms.deadlineBlockNumber, "expired");
        adv.status = AdvanceStatus.Funded;
        emit AdvanceFunded(advanceId);
    }

    function noteAdvanceRepayment(uint256 advanceId, uint256 amount) external {
        require(msg.sender == worker || msg.sender == owner(), "only worker/owner");
        AdvanceOrder storage adv = advanceOrders[advanceId];
        require(adv.status == AdvanceStatus.Funded || adv.status == AdvanceStatus.PartlyRepaid, "not Funded");
        require(block.number <= adv.terms.deadlineBlockNumber, "expired");
        adv.repaidAmount += amount;
        if (adv.repaidAmount >= adv.terms.expectedRepaymentAmount) {
            adv.status = AdvanceStatus.Repaid;
            emit AdvanceRepaid(advanceId);
        } else {
            adv.status = AdvanceStatus.PartlyRepaid;
            emit AdvancePartiallyRepaid(advanceId, amount);
        }
    }

    function markAdvanceAsExpired(uint256 advanceId) external onlyOwner {
        AdvanceOrder storage adv = advanceOrders[advanceId];
        require(adv.status != AdvanceStatus.Repaid && adv.status != AdvanceStatus.Expired, "finalized");
        require(block.number >= adv.terms.deadlineBlockNumber, "not expired");
        adv.status = AdvanceStatus.Expired;
        emit AdvanceExpired(advanceId);
    }

    function getAdvanceOrder(uint256 advanceId) external view returns (AdvanceOrder memory) {
        require(registeredAdvances[advanceId], "not registered");
        return advanceOrders[advanceId];
    }
}
