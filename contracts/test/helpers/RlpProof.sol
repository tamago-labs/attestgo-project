// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice Test-side ProofBuilder stand-in: RLP encoding + Attestcoin encodedTransaction builder
///         (layout: txRlp || receiptRlp, matching RLPReader/CoreVault expectations).
library RlpProof {
    function uintLen(uint256 v) internal pure returns (uint256 n) {
        while (v != 0) {
            n++;
            v >>= 8;
        }
    }

    function be(uint256 v, uint256 n) internal pure returns (bytes memory b) {
        b = new bytes(n);
        for (uint256 i = 0; i < n; i++) b[n - 1 - i] = bytes1(uint8(v >> (8 * i)));
    }

    function encUint(uint256 v) internal pure returns (bytes memory) {
        if (v == 0) return abi.encodePacked(uint8(0x80));
        if (v < 0x80) return abi.encodePacked(uint8(v));
        uint256 n = uintLen(v);
        return abi.encodePacked(uint8(0x80 + n), be(v, n));
    }

    function encBytes(bytes memory b) internal pure returns (bytes memory) {
        if (b.length == 1 && uint8(b[0]) < 0x80) return b;
        if (b.length <= 55) return abi.encodePacked(uint8(0x80 + b.length), b);
        uint256 n = uintLen(b.length);
        return abi.encodePacked(uint8(0xB7 + n), be(b.length, n), b);
    }

    function encList(bytes[] memory items) internal pure returns (bytes memory) {
        uint256 total;
        for (uint256 i = 0; i < items.length; i++) total += items[i].length;
        bytes memory payload = new bytes(total);
        uint256 ptr;
        for (uint256 i = 0; i < items.length; i++) {
            for (uint256 j = 0; j < items[i].length; j++) payload[ptr + j] = items[i][j];
            ptr += items[i].length;
        }
        if (total <= 55) return abi.encodePacked(uint8(0xC0 + total), payload);
        uint256 n = uintLen(total);
        return abi.encodePacked(uint8(0xF7 + n), be(total, n), payload);
    }

    /// @notice Builds encodedTransaction = txRlp || receiptRlp with a single log (topics + data).
    function buildEncodedTransaction(address emitter, bytes32[] memory topics, bytes memory logData, uint8 status)
        internal
        pure
        returns (bytes memory)
    {
        bytes[] memory txFields = new bytes[](9);
        txFields[0] = encUint(0); // nonce
        txFields[1] = encUint(1); // gasPrice
        txFields[2] = encUint(100000); // gas
        txFields[3] = encBytes(abi.encodePacked(emitter)); // to
        txFields[4] = encUint(0); // value
        txFields[5] = encBytes(hex"deadbeef"); // data
        txFields[6] = encUint(27); // v
        txFields[7] = encUint(1); // r
        txFields[8] = encUint(1); // s
        bytes memory txRlp = encList(txFields);

        bytes[] memory topicEnc = new bytes[](topics.length);
        for (uint256 i = 0; i < topics.length; i++) topicEnc[i] = encBytes(abi.encodePacked(topics[i]));

        bytes[] memory logFields = new bytes[](3);
        logFields[0] = encBytes(abi.encodePacked(emitter)); // logger
        logFields[1] = encList(topicEnc); // topics
        logFields[2] = encBytes(logData); // data
        bytes[] memory logList = new bytes[](1);
        logList[0] = encList(logFields);

        bytes[] memory receiptFields = new bytes[](4);
        receiptFields[0] = encUint(status); // status (1 = success)
        receiptFields[1] = encUint(100000); // cumulativeGasUsed
        receiptFields[2] = encBytes(new bytes(256)); // logsBloom
        receiptFields[3] = encList(logList); // logs
        bytes memory receiptRlp = encList(receiptFields);

        return abi.encodePacked(txRlp, receiptRlp);
    }
}
