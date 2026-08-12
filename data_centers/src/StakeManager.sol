// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title StakeManager
/// @notice Handles USDC stake escrow, release, and slashing for the verification system
contract StakeManager {
    IERC20 public immutable usdc;

    // User balances
    mapping(address => uint256) public depositedBalances;
    mapping(address => uint256) public lockedBalances;

    // Allowed callers (ClaimVerification contract)
    mapping(address => bool) public authorizedContracts;
    address public owner;

    // Stats
    uint256 public totalDeposited;
    uint256 public totalSlashed;
    uint256 public totalRewarded;

    // Events
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Locked(address indexed user, uint256 amount, bytes32 referenceId);
    event Released(address indexed user, uint256 amount, bytes32 referenceId);
    event Slashed(address indexed user, uint256 amount, address indexed beneficiary, bytes32 referenceId);
    event Rewarded(address indexed user, uint256 amount, bytes32 referenceId);
    event ContractAuthorized(address indexed contractAddr);
    event ContractDeauthorized(address indexed contractAddr);

    modifier onlyOwner() {
        require(msg.sender == owner, "StakeManager: not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "StakeManager: not authorized");
        _;
    }

    constructor(address _usdc) {
        require(_usdc != address(0), "StakeManager: zero USDC address");
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }

    // ─── Deposits & Withdrawals ─────────────────────────────────

    function deposit(uint256 amount) external {
        require(amount > 0, "StakeManager: zero amount");
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "StakeManager: transfer failed"
        );

        depositedBalances[msg.sender] += amount;
        totalDeposited += amount;

        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "StakeManager: zero amount");
        uint256 available = depositedBalances[msg.sender] - lockedBalances[msg.sender];
        require(available >= amount, "StakeManager: insufficient available balance");

        depositedBalances[msg.sender] -= amount;
        totalDeposited -= amount;

        require(usdc.transfer(msg.sender, amount), "StakeManager: transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    // ─── Lock / Release / Slash (called by ClaimVerification) ──

    function lockStake(address user, uint256 amount, bytes32 referenceId) external onlyAuthorized {
        uint256 available = depositedBalances[user] - lockedBalances[user];
        require(available >= amount, "StakeManager: insufficient available balance");

        lockedBalances[user] += amount;

        emit Locked(user, amount, referenceId);
    }

    function releaseStake(address user, uint256 amount, bytes32 referenceId) external onlyAuthorized {
        require(lockedBalances[user] >= amount, "StakeManager: insufficient locked balance");

        lockedBalances[user] -= amount;

        emit Released(user, amount, referenceId);
    }

    function slashStake(
        address user,
        uint256 amount,
        address beneficiary,
        bytes32 referenceId
    ) external onlyAuthorized {
        require(lockedBalances[user] >= amount, "StakeManager: insufficient locked balance");

        lockedBalances[user] -= amount;
        depositedBalances[user] -= amount;
        depositedBalances[beneficiary] += amount;
        totalSlashed += amount;

        emit Slashed(user, amount, beneficiary, referenceId);
    }

    function reward(address user, uint256 amount, bytes32 referenceId) external onlyAuthorized {
        // Reward comes from platform treasury (contract balance)
        require(
            usdc.balanceOf(address(this)) >= amount,
            "StakeManager: insufficient contract balance"
        );

        depositedBalances[user] += amount;
        totalRewarded += amount;

        emit Rewarded(user, amount, referenceId);
    }

    /// @notice Move USDC from a user's available deposit balance directly to another address.
    /// @dev Used by ClaimVerification to pull UMA OOV3 assertion bonds from the verifier's deposit.
    function transferFromDeposit(address from, address to, uint256 amount) external onlyAuthorized {
        uint256 available = depositedBalances[from] - lockedBalances[from];
        require(available >= amount, "StakeManager: insufficient available balance");

        depositedBalances[from] -= amount;
        totalDeposited -= amount;

        require(usdc.transfer(to, amount), "StakeManager: transfer failed");
    }

    // ─── Views ──────────────────────────────────────────────────

    function getAvailableBalance(address user) external view returns (uint256) {
        return depositedBalances[user] - lockedBalances[user];
    }

    function getLockedBalance(address user) external view returns (uint256) {
        return lockedBalances[user];
    }

    // ─── Access Control ─────────────────────────────────────────

    function authorizeContract(address _contract) external onlyOwner {
        authorizedContracts[_contract] = true;
        emit ContractAuthorized(_contract);
    }

    function deauthorizeContract(address _contract) external onlyOwner {
        authorizedContracts[_contract] = false;
        emit ContractDeauthorized(_contract);
    }

    /// @notice Fund the contract treasury for reward payouts
    function fundTreasury(uint256 amount) external onlyOwner {
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "StakeManager: transfer failed"
        );
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "StakeManager: zero address");
        owner = _newOwner;
    }
}
