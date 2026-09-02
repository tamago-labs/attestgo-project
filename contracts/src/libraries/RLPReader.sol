// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title RLPReader
/// @notice Minimal RLP decoder used by CoreVault to decode the verified `encodedTransaction`
///         (transaction + receipt data) returned by the Attestcoin ProofBuilder.
/// @dev In-place memory views (no payload copies except explicit toBytes). Adapted from the
///      standard MIT Solidity-RLP reader.
library RLPReader {
    uint256 internal constant OFFSET_SHORT_ITEM = 0x80;
    uint256 internal constant OFFSET_LONG_ITEM = 0xB8;
    uint256 internal constant OFFSET_SHORT_LIST = 0xC0;
    uint256 internal constant OFFSET_LONG_LIST = 0xF8;

    struct RLPItem {
        uint256 len; // payload length (items and lists alike)
        uint256 total; // total encoded length (prefix + payload)
        uint256 memPtr; // offset of payload start inside the bytes
        bool isList;
    }

    /// @notice Decodes the RLP item starting at `memPtr` inside `data`.
    function next(bytes memory data, uint256 memPtr) internal pure returns (RLPItem memory item) {
        uint256 byte0;
        assembly ("memory-safe") {
            byte0 := byte(0, mload(add(data, add(32, memPtr))))
        }

        if (byte0 < OFFSET_SHORT_LIST) {
            item.isList = false;
            if (byte0 < OFFSET_SHORT_ITEM) {
                // single byte is its own item
                item.memPtr = memPtr;
                item.len = 1;
                item.total = 1;
            } else if (byte0 <= OFFSET_SHORT_ITEM + 55) {
                item.memPtr = memPtr + 1;
                item.len = byte0 - OFFSET_SHORT_ITEM;
                item.total = item.len + 1;
            } else {
                uint256 lenOfLen = byte0 - OFFSET_LONG_ITEM + 1; // prefix = 0xB7 + lenOfLen
                item.len = _readUint(data, memPtr + 1, lenOfLen);
                item.memPtr = memPtr + 1 + lenOfLen;
                item.total = item.len + 1 + lenOfLen;
            }
        } else {
            item.isList = true;
            if (byte0 <= OFFSET_SHORT_LIST + 55) {
                item.memPtr = memPtr + 1;
                item.len = byte0 - OFFSET_SHORT_LIST;
                item.total = item.len + 1;
            } else {
                uint256 lenOfLen = byte0 - OFFSET_LONG_LIST + 1; // prefix = 0xF7 + lenOfLen
                item.len = _readUint(data, memPtr + 1, lenOfLen);
                item.memPtr = memPtr + 1 + lenOfLen;
                item.total = item.len + 1 + lenOfLen;
            }
        }
    }

    /// @notice Returns the `idx`-th sub-item of an RLP list.
    function itemAt(RLPItem memory list, bytes memory data, uint256 idx) internal pure returns (RLPItem memory) {
        require(list.isList, "RLP: not a list");
        uint256 ptr = list.memPtr;
        uint256 listEnd = list.memPtr + list.len;
        uint256 count;
        while (ptr < listEnd) {
            if (count == idx) return next(data, ptr);
            ptr += next(data, ptr).total;
            count++;
        }
        revert("RLP: index out of range");
    }

    /// @notice Copies the payload of an item into its own bytes.
    function toBytes(RLPItem memory item, bytes memory data) internal pure returns (bytes memory out) {
        uint256 len = item.len;
        uint256 memPtr = item.memPtr;
        out = new bytes(len);
        assembly ("memory-safe") {
            let dst := add(out, 32)
            let src := add(data, add(32, memPtr))
            for { let i := 0 } lt(i, len) { i := add(i, 32) } {
                mstore(add(dst, i), mload(add(src, i)))
            }
        }
    }

    function toUint(RLPItem memory item, bytes memory data) internal pure returns (uint256) {
        require(!item.isList, "RLP: not an item");
        require(item.len <= 32, "RLP: uint too big");
        return _readUint(data, item.memPtr, item.len);
    }

    function toAddress(RLPItem memory item, bytes memory data) internal pure returns (address) {
        require(!item.isList, "RLP: not an item");
        require(item.len <= 20, "RLP: addr too big");
        return address(uint160(_readUint(data, item.memPtr, item.len)));
    }

    /// @notice Right-aligns a <=32-byte RLP string into bytes32 (handles leading-zero trimming).
    function toBytes32(RLPItem memory item, bytes memory data) internal pure returns (bytes32) {
        require(!item.isList, "RLP: not an item");
        require(item.len <= 32, "RLP: b32 too big");
        return bytes32(_readUint(data, item.memPtr, item.len));
    }

    /// @notice Reads `len` bytes big-endian at `memPtr` inside `data` (len <= 32).
    function _readUint(bytes memory data, uint256 memPtr, uint256 len) private pure returns (uint256 out) {
        if (len == 0) return 0;
        assembly ("memory-safe") {
            // data[memPtr] lives at add(data, 32 + memPtr); load the overlapping word
            let word := mload(add(data, add(32, memPtr)))
            out := shr(mul(8, sub(32, len)), word)
        }
    }
}
