// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {OptimisticOracleV3Interface} from "../../src/interfaces/OptimisticOracleV3Interface.sol";

/// @title MockUSDC - minimal ERC20 for testing
contract MockUSDC {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        balanceOf[from] -= amount;
        allowance[from][msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// @title MockOOV3 - UMA OptimisticOracleV3 stand-in with controllable settlement
contract MockOOV3 is OptimisticOracleV3Interface {
    uint256 public minBond = 400e6;
    address public currency;
    bool public settleResolution = true; // result applied on settleAssertion

    uint256 private _nextId = 1;
    mapping(bytes32 => Assertion) private _assertions;

    constructor(address _currency) {
        currency = _currency;
    }

    function setMinBond(uint256 _minBond) external {
        minBond = _minBond;
    }

    function setSettleResolution(bool _resolution) external {
        settleResolution = _resolution;
    }

    function getMinimumBond(address) external view override returns (uint256) {
        return minBond;
    }

    function defaultCurrency() external view override returns (address) {
        return currency;
    }

    function defaultLiveness() external pure override returns (uint64) {
        return uint64(2 hours);
    }

    function defaultIdentifier() external pure override returns (bytes32) {
        return keccak256("ASSERT_TRUTH");
    }

    function assertTruth(
        bytes memory,
        address asserter,
        address callbackRecipient,
        address,
        uint64 liveness,
        IERC20 _currency,
        uint256 bond,
        bytes32,
        bytes32
    ) external override returns (bytes32) {
        if (bond > 0) {
            require(_currency.transferFrom(msg.sender, address(this), bond), "bond transfer failed");
        }

        bytes32 assertionId = keccak256(abi.encodePacked(_nextId++, block.timestamp));
        Assertion storage a = _assertions[assertionId];
        a.asserter = asserter;
        a.assertionTime = uint64(block.timestamp);
        a.settled = false;
        a.currency = _currency;
        a.expirationTime = uint64(block.timestamp) + liveness;
        a.settlementResolution = false;
        a.bond = bond;
        a.callbackRecipient = callbackRecipient;

        return assertionId;
    }

    function assertTruthWithDefaults(bytes memory, address asserter) external override returns (bytes32) {
        bytes32 assertionId = keccak256(abi.encodePacked(_nextId++, block.timestamp));
        Assertion storage a = _assertions[assertionId];
        a.asserter = asserter;
        a.assertionTime = uint64(block.timestamp);
        a.currency = IERC20(currency);
        a.expirationTime = uint64(block.timestamp) + 2 hours;
        return assertionId;
    }

    function disputeAssertion(bytes32 assertionId, address disputer) external override {
        Assertion storage a = _assertions[assertionId];
        require(!a.settled, "already settled");
        a.disputer = disputer;
        // Mimic OOV3 callback to the recipient
        if (a.callbackRecipient != address(0)) {
            (bool ok,) = a.callbackRecipient.call(
                abi.encodeWithSignature("assertionDisputedCallback(bytes32)", assertionId)
            );
            ok;
        }
    }

    function settleAssertion(bytes32 assertionId) external override {
        Assertion storage a = _assertions[assertionId];
        require(!a.settled, "already settled");
        require(block.timestamp >= a.expirationTime, "not expired");
        a.settled = true;
        a.settlementResolution = settleResolution;
    }

    function settleAndGetAssertionResult(bytes32 assertionId) external override returns (bool) {
        this.settleAssertion(assertionId);
        return _assertions[assertionId].settlementResolution;
    }

    function getAssertionResult(bytes32 assertionId) external view override returns (bool) {
        require(_assertions[assertionId].settled, "not settled");
        return _assertions[assertionId].settlementResolution;
    }

    function getAssertion(bytes32 assertionId) external view override returns (Assertion memory) {
        return _assertions[assertionId];
    }
}

/// @title MockClaimVerification - receives court rulings for JurorCourt unit tests
contract MockClaimVerification {
    uint256 public lastClaimId;
    bool public lastClaimCorrect;
    uint256 public rulingCount;
    address[] public lastMajorityVoters;

    function executeCourtRuling(uint256 claimId, bool claimCorrect, address[] calldata majorityVoters) external {
        lastClaimId = claimId;
        lastClaimCorrect = claimCorrect;
        rulingCount++;
        delete lastMajorityVoters;
        for (uint256 i = 0; i < majorityVoters.length; i++) {
            lastMajorityVoters.push(majorityVoters[i]);
        }
    }

    function getLastMajorityVoters() external view returns (address[] memory) {
        return lastMajorityVoters;
    }
}
