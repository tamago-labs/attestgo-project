// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/// @notice Test-side ProofBuilder stand-in: builds an encodedTransaction in the Attestcoin
///         ProofBuilder ABI layout ??? ABI-encoded (transaction, receipt) ??? containing the given
///         log (or no log when status == 0), matching what CoreVault/GOPassRegistry scan for.
library RlpProof {
    uint256 internal constant WORD = 32;

    function _w(uint256 v) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32(v));
    }

    function _addr(address a) internal pure returns (bytes memory) {
        return abi.encodePacked(bytes32(uint256(uint160(a))));
    }

    function buildEncodedTransaction(address emitter, bytes32[] memory topics, bytes memory logData, uint8 status)
        internal
        pure
        returns (bytes memory)
    {
        // tx calldata section (cosmetic mirror of a SourceVault.lock call, 164 bytes)
        bytes memory txData =
            abi.encodeWithSignature("lock(address,address,uint256,bytes32,uint64)", emitter, emitter, uint256(1), bytes32(uint256(1)), uint64(1));

        // ABI-encoded tx head (fixed shape, mirrors the ProofBuilder layout; `to` at word 11)
        bytes memory head = abi.encodePacked(
            _w(2),
            _w(0x40),
            _w(3),
            _w(0x60),
            _w(0x240),
            _w(0x360),
            _w(0x1c0),
            _w(0), // nonce
            _w(100000), // gas
            _addr(address(uint160(1))), // from
            _w(0), // value
            _addr(emitter), // to
            _w(0), // yParity
            _w(0xe0), // data offset
            _w(txData.length),
            txData
        );

        // pad the calldata section to a 32-byte boundary (the ProofBuilder blob is word-aligned)
        uint256 txPad = ((txData.length + 31) / 32) * 32 - txData.length;
        bytes memory headPadded = txPad > 0 ? abi.encodePacked(head, new bytes(txPad)) : head;

        bytes memory bloom = new bytes(256);

        if (status == 0) {
            // failed tx: empty logs — nothing to scan for
            return abi.encodePacked(headPadded, _w(0), _w(100000), _w(0x80), _w(6 * WORD), _w(0), _w(256), bloom);
        }

        uint256 dataPad = ((logData.length + 31) / 32) * 32 - logData.length;
        uint256 logWords = 3 + 1 + topics.length + 1 + (logData.length + dataPad) / 32;
        bytes memory log = abi.encodePacked(_addr(emitter), _w(0x60), _w((3 + topics.length) * WORD), _w(topics.length));
        for (uint256 i = 0; i < topics.length; i++) log = abi.encodePacked(log, _w(uint256(topics[i])));
        log = abi.encodePacked(log, _w(logData.length), logData);
        if (dataPad > 0) log = abi.encodePacked(log, new bytes(dataPad));

        // receipt: [status, gasUsed, logsOffset, bloomOffset, logCount, logOffset, logs..., bloomLen, bloom]
        bytes memory receiptPart = abi.encodePacked(
            _w(1),
            _w(100000),
            _w(0x80), // logs array starts after the 4 head words
            _w((4 + 2 + logWords) * WORD), // bloom offset
            _w(1), // log count
            _w(0x60), // log starts after count + 1 offset word
            log,
            _w(256),
            bloom
        );

        return abi.encodePacked(headPadded, receiptPart);
    }
}
