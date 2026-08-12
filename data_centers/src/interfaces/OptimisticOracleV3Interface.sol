// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title OptimisticOracleV3Interface
/// @notice Minimal UMA Optimistic Oracle V3 interface (subset used by ClaimVerification).
/// @dev Source: UMAprotocol/protocol packages/core/contracts/optimistic-oracle-v3/interfaces/OptimisticOracleV3Interface.sol
interface OptimisticOracleV3Interface {
    struct EscalationManagerSettings {
        bool arbitrateViaEscalationManager;
        bool discardOracle;
        bool validateDisputers;
        address assertingCaller;
        address escalationManager;
    }

    struct Assertion {
        EscalationManagerSettings escalationManagerSettings;
        address asserter;
        uint64 assertionTime;
        bool settled;
        IERC20 currency;
        uint64 expirationTime;
        bool settlementResolution;
        bytes32 domainId;
        bytes32 identifier;
        uint256 bond;
        address callbackRecipient;
        address disputer;
    }

    function disputeAssertion(bytes32 assertionId, address disputer) external;

    function defaultIdentifier() external view returns (bytes32);

    function getAssertion(bytes32 assertionId) external view returns (Assertion memory);

    function assertTruthWithDefaults(bytes memory claim, address asserter) external returns (bytes32);

    function assertTruth(
        bytes memory claim,
        address asserter,
        address callbackRecipient,
        address escalationManager,
        uint64 liveness,
        IERC20 currency,
        uint256 bond,
        bytes32 identifier,
        bytes32 domainId
    ) external returns (bytes32);

    function settleAssertion(bytes32 assertionId) external;

    function settleAndGetAssertionResult(bytes32 assertionId) external returns (bool);

    function getAssertionResult(bytes32 assertionId) external view returns (bool);

    function getMinimumBond(address currency) external view returns (uint256);

    function defaultCurrency() external view returns (address);

    function defaultLiveness() external view returns (uint64);

    event AssertionMade(
        bytes32 indexed assertionId,
        bytes32 domainId,
        bytes claim,
        address indexed asserter,
        address callbackRecipient,
        address escalationManager,
        address caller,
        uint64 expirationTime,
        IERC20 currency,
        uint256 bond,
        bytes32 indexed identifier
    );

    event AssertionDisputed(bytes32 indexed assertionId, address indexed caller, address indexed disputer);

    event AssertionSettled(
        bytes32 indexed assertionId,
        address indexed bondRecipient,
        bool disputed,
        bool settlementResolution,
        address settleCaller
    );
}
