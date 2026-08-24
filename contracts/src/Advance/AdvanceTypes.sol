// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

struct AdvanceFlow {
    address from;
    address to;
    address withToken;
}

enum AdvanceStatus {
    Created,
    Funded,
    PartlyRepaid,
    Repaid,
    Expired
}

struct AdvanceTerms {
    uint256 loanAmount;
    uint256 interestRate;
    uint256 expectedRepaymentAmount;
    uint256 deadlineBlockNumber;
    uint256 collateralStreamId; // AttestStream streamId used as collateral (Option B)
}

struct AdvanceOrder {
    AdvanceFlow fundFlow;
    AdvanceFlow repayFlow;
    AdvanceTerms terms;
    bytes signatureOfLender;
    bytes signatureOfBorrower;
    uint256 createdAtBlock;
    AdvanceStatus status;
    uint256 repaidAmount;
}
