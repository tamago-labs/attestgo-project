// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

/**
 * CountryBitmap — ISO2 to bitmap helper
 * Sorted example mapping: US=0, SG=1, JP=2, HK=3, DE=4, CN=5, GB=6 ...
 * Bitmap allows single uint256 check in GOPassMirror isEligibleCached.
 * Off-chain sync must use same table (scripts/cleanverse-docs: ISO2 uppercase).
 */
library CountryBitmap {
    function iso2ToBit(string memory iso2) internal pure returns (uint8) {
        bytes memory b = bytes(iso2);
        require(b.length == 2, "iso2 len");
        // normalize to uppercase for comparison
        bytes2 key = bytes2((uint16(uint8(b[0]) & 0xDF) << 8) | uint8(b[1] & 0xDF));
        if (key == bytes2("US")) return 0;
        if (key == bytes2("SG")) return 1;
        if (key == bytes2("JP")) return 2;
        if (key == bytes2("HK")) return 3;
        if (key == bytes2("DE")) return 4;
        if (key == bytes2("CN")) return 5;
        if (key == bytes2("GB")) return 6;
        if (key == bytes2("FR")) return 7;
        if (key == bytes2("AE")) return 8;
        if (key == bytes2("CH")) return 9;
        revert("iso2 not mapped");
    }

    function toBitmap(string[] memory isos) internal pure returns (uint256 bitmap) {
        for (uint256 i = 0; i < isos.length; i++) {
            bitmap |= uint256(1) << iso2ToBit(isos[i]);
        }
    }

    function bitmapForTwo(string memory a, string memory b) internal pure returns (uint256) {
        return (uint256(1) << iso2ToBit(a)) | (uint256(1) << iso2ToBit(b));
    }
}
