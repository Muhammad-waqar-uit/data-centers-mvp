// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {ClaimVerification} from "../src/ClaimVerification.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {DataCenterRegistry} from "../src/DataCenterRegistry.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

/// @title MockUSDC - A minimal ERC20 for testing
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

contract ClaimVerificationTest is Test {
    ClaimVerification public claimVerification;
    StakeManager public stakeManager;
    DataCenterRegistry public registry;
    MockUSDC public usdc;

    address public deployer = address(1);
    address public contributor = address(2);
    address public verifier = address(3);
    address public challenger = address(4);

    uint256 constant USDC = 1e6; // 1 USDC

    function setUp() public {
        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy StakeManager
        stakeManager = new StakeManager(address(usdc));

        // Deploy ClaimVerification
        claimVerification = new ClaimVerification(address(stakeManager));

        // Deploy DataCenterRegistry
        registry = new DataCenterRegistry();

        // Authorize ClaimVerification on StakeManager
        stakeManager.authorizeContract(address(claimVerification));

        // Fund accounts
        usdc.mint(contributor, 1000 * USDC);
        usdc.mint(verifier, 10000 * USDC);
        usdc.mint(challenger, 10000 * USDC);

        // Fund StakeManager treasury for rewards
        usdc.mint(address(stakeManager), 100000 * USDC);

        // Approve StakeManager to spend USDC
        vm.prank(contributor);
        usdc.approve(address(stakeManager), type(uint256).max);
        vm.prank(verifier);
        usdc.approve(address(stakeManager), type(uint256).max);
        vm.prank(challenger);
        usdc.approve(address(stakeManager), type(uint256).max);

        // Deposit into StakeManager
        vm.prank(contributor);
        stakeManager.deposit(500 * USDC);
        vm.prank(verifier);
        stakeManager.deposit(5000 * USDC);
        vm.prank(challenger);
        stakeManager.deposit(5000 * USDC);
    }

    function test_SubmitClaim() public {
        vm.prank(contributor);
        uint256 claimId = claimVerification.submitClaim(
            1,
            ClaimVerification.FactType.GRID_STATUS,
            "Queue position: 412, Status: Active",
            keccak256("proof-doc-hash")
        );

        assertEq(claimId, 1);

        ClaimVerification.Claim memory claim = claimVerification.getClaim(claimId);
        assertEq(claim.claimer, contributor);
        assertEq(uint8(claim.factType), uint8(ClaimVerification.FactType.GRID_STATUS));
        assertEq(uint8(claim.status), uint8(ClaimVerification.ClaimStatus.PENDING));
    }

    function test_AttestClaim() public {
        // Submit claim
        vm.prank(contributor);
        uint256 claimId = claimVerification.submitClaim(
            1,
            ClaimVerification.FactType.OWNERSHIP,
            "Owner: Digital Realty Trust",
            keccak256("proof")
        );

        // Attest
        vm.prank(verifier);
        claimVerification.attestClaim(claimId);

        ClaimVerification.Claim memory claim = claimVerification.getClaim(claimId);
        assertEq(uint8(claim.status), uint8(ClaimVerification.ClaimStatus.ATTESTED));

        ClaimVerification.Attestation memory att = claimVerification.getAttestation(claimId);
        assertEq(att.verifier, verifier);
    }

    function test_CannotSelfAttest() public {
        vm.prank(contributor);
        uint256 claimId = claimVerification.submitClaim(
            1,
            ClaimVerification.FactType.GRID_STATUS,
            "data",
            keccak256("proof")
        );

        vm.prank(contributor);
        vm.expectRevert("ClaimVerification: cannot self-attest");
        claimVerification.attestClaim(claimId);
    }

    function test_ChallengeClaim() public {
        // Submit
        vm.prank(contributor);
        uint256 claimId = claimVerification.submitClaim(
            1,
            ClaimVerification.FactType.GRID_STATUS,
            "data",
            keccak256("proof")
        );

        // Attest
        vm.prank(verifier);
        claimVerification.attestClaim(claimId);

        // Challenge
        vm.prank(challenger);
        claimVerification.challengeClaim(claimId, "Data is outdated");

        ClaimVerification.Claim memory claim = claimVerification.getClaim(claimId);
        assertEq(uint8(claim.status), uint8(ClaimVerification.ClaimStatus.CHALLENGED));
    }

    function test_FinalizeClaim_AfterChallengeWindow() public {
        // Submit
        vm.prank(contributor);
        uint256 claimId = claimVerification.submitClaim(
            1,
            ClaimVerification.FactType.GRID_STATUS,
            "data",
            keccak256("proof")
        );

        // Attest
        vm.prank(verifier);
        claimVerification.attestClaim(claimId);

        // Warp past challenge window (7 days + 1 second)
        vm.warp(block.timestamp + 7 days + 1);

        // Finalize
        claimVerification.finalizeClaim(claimId);

        ClaimVerification.Claim memory claim = claimVerification.getClaim(claimId);
        assertEq(uint8(claim.status), uint8(ClaimVerification.ClaimStatus.FINALIZED));
    }

    function test_CannotFinalizeBeforeWindowCloses() public {
        vm.prank(contributor);
        uint256 claimId = claimVerification.submitClaim(
            1,
            ClaimVerification.FactType.GRID_STATUS,
            "data",
            keccak256("proof")
        );

        vm.prank(verifier);
        claimVerification.attestClaim(claimId);

        // Try finalize before window closes
        vm.expectRevert("ClaimVerification: window still open");
        claimVerification.finalizeClaim(claimId);
    }

    function test_ResolveDispute_ClaimCorrect() public {
        // Submit + Attest + Challenge
        vm.prank(contributor);
        uint256 claimId = claimVerification.submitClaim(
            1,
            ClaimVerification.FactType.GRID_STATUS,
            "data",
            keccak256("proof")
        );

        vm.prank(verifier);
        claimVerification.attestClaim(claimId);

        vm.prank(challenger);
        claimVerification.challengeClaim(claimId, "Wrong data");

        // Resolve: claim is correct (challenger loses)
        claimVerification.resolveDispute(claimId, true);

        ClaimVerification.Claim memory claim = claimVerification.getClaim(claimId);
        assertEq(uint8(claim.status), uint8(ClaimVerification.ClaimStatus.FINALIZED));
    }

    function test_ResolveDispute_ClaimIncorrect() public {
        // Submit + Attest + Challenge
        vm.prank(contributor);
        uint256 claimId = claimVerification.submitClaim(
            1,
            ClaimVerification.FactType.GRID_STATUS,
            "data",
            keccak256("proof")
        );

        vm.prank(verifier);
        claimVerification.attestClaim(claimId);

        vm.prank(challenger);
        claimVerification.challengeClaim(claimId, "Wrong data");

        // Resolve: claim is incorrect (claimer/verifier lose)
        claimVerification.resolveDispute(claimId, false);

        ClaimVerification.Claim memory claim = claimVerification.getClaim(claimId);
        assertEq(uint8(claim.status), uint8(ClaimVerification.ClaimStatus.REJECTED));
    }

    function test_GetUserClaims() public {
        vm.startPrank(contributor);
        claimVerification.submitClaim(1, ClaimVerification.FactType.GRID_STATUS, "data1", keccak256("p1"));
        claimVerification.submitClaim(2, ClaimVerification.FactType.OWNERSHIP, "data2", keccak256("p2"));
        vm.stopPrank();

        uint256[] memory userClaimIds = claimVerification.getUserClaims(contributor);
        assertEq(userClaimIds.length, 2);
        assertEq(userClaimIds[0], 1);
        assertEq(userClaimIds[1], 2);
    }

    function test_TotalClaims() public {
        vm.prank(contributor);
        claimVerification.submitClaim(1, ClaimVerification.FactType.GRID_STATUS, "data", keccak256("p"));

        assertEq(claimVerification.getTotalClaims(), 1);
    }
}
