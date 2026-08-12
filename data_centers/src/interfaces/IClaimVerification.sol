// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @notice Callback executed by JurorCourt when a dispute is resolved.
interface IClaimVerification {
    function executeCourtRuling(
        uint256 claimId,
        bool claimCorrect,
        address[] calldata majorityVoters
    ) external;
}
