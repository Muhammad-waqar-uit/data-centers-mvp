// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {ClaimVerification} from "../src/ClaimVerification.sol";
import {JurorCourt} from "../src/JurorCourt.sol";
import {MockUSDC, MockOOV3} from "./mocks/Mocks.sol";

/// @title ClaimVerificationTest
/// @notice Covers the decentralized contribution & verification flow:
/// submit -> attest (UMA OOV3 assertion) -> settle happy path,
/// and submit -> attest -> challenge -> JurorCourt resolution.
contract ClaimVerificationTest is Test {
    MockUSDC usdc;
    MockOOV3 oov3;
    StakeManager stakeManager;
    ClaimVerification cv;
    JurorCourt court;

    address owner;
    address claimer;
    address verifier;
    address challenger;
    address[3] jurors;

    uint256 constant DEPOSIT = 1_000e6;

    function setUp() public {
        owner = address(this);
        claimer = makeAddr("claimer");
        verifier = makeAddr("verifier");
        challenger = makeAddr("challenger");
        for (uint256 i = 0; i < 3; i++) {
            jurors[i] = makeAddr(string(abi.encodePacked("juror", vm.toString(i))));
        }

        usdc = new MockUSDC();
        oov3 = new MockOOV3(address(usdc));
        stakeManager = new StakeManager(address(usdc));
        cv = new ClaimVerification(address(stakeManager), address(oov3));
        court = new JurorCourt(address(stakeManager));

        // Wire authorizations
        stakeManager.authorizeContract(address(cv));
        stakeManager.authorizeContract(address(court));
        cv.setCourt(address(court));
        court.setClaimVerification(address(cv));

        // Fund users
        _fund(claimer, DEPOSIT);
        _fund(verifier, DEPOSIT);
        _fund(challenger, DEPOSIT);

        // Fund treasury for reward payouts
        usdc.mint(owner, 1_000e6);
        usdc.approve(address(stakeManager), 1_000e6);
        stakeManager.fundTreasury(1_000e6);

        // Register 3 jurors so disputes can be created
        for (uint256 i = 0; i < 3; i++) {
            _fund(jurors[i], 500e6);
            vm.prank(jurors[i]);
            court.registerJuror(100e6);
        }
    }

    function _fund(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(stakeManager), amount);
        vm.prank(user);
        stakeManager.deposit(amount);
    }

    function _submitClaim() internal returns (uint256) {
        vm.prank(claimer);
        return cv.submitClaim(1, ClaimVerification.FactType.GRID_STATUS, "operating", keccak256("proof"));
    }

    function _attest(uint256 claimId) internal {
        vm.prank(verifier);
        cv.attestClaim(claimId);
    }

    // ─── Submission ─────────────────────────────────────────────

    function test_SubmitClaim() public {
        uint256 claimId = _submitClaim();

        ClaimVerification.Claim memory c = cv.getClaim(claimId);
        assertEq(c.id, claimId);
        assertEq(c.claimer, claimer);
        assertEq(uint8(c.status), uint8(ClaimVerification.ClaimStatus.PENDING));
        assertEq(stakeManager.getLockedBalance(claimer), 20e6);
    }

    function test_SubmitClaim_RevertsOnEmptyFactData() public {
        vm.prank(claimer);
        vm.expectRevert("ClaimVerification: empty fact data");
        cv.submitClaim(1, ClaimVerification.FactType.GRID_STATUS, "", keccak256("proof"));
    }

    // ─── Attestation ────────────────────────────────────────────

    function test_AttestClaim() public {
        uint256 claimId = _submitClaim();
        _attest(claimId);

        ClaimVerification.Claim memory c = cv.getClaim(claimId);
        assertEq(uint8(c.status), uint8(ClaimVerification.ClaimStatus.ATTESTED));
        assertTrue(c.assertionId != bytes32(0));
        assertEq(c.challengeWindowEnd, block.timestamp + 7 days);

        // Verifier stake locked (200) + OOV3 bond pulled from deposit (400)
        assertEq(stakeManager.getLockedBalance(verifier), 200e6);
        assertEq(stakeManager.depositedBalances(verifier), DEPOSIT - 400e6);

        ClaimVerification.Attestation memory att = cv.getAttestation(claimId);
        assertEq(att.verifier, verifier);
    }

    function test_CannotSelfAttest() public {
        uint256 claimId = _submitClaim();
        vm.prank(claimer);
        vm.expectRevert("ClaimVerification: cannot self-attest");
        cv.attestClaim(claimId);
    }

    // ─── Settlement (optimistic happy path) ─────────────────────

    function test_CannotSettleBeforeWindowCloses() public {
        uint256 claimId = _submitClaim();
        _attest(claimId);

        vm.expectRevert("ClaimVerification: window still open");
        cv.settleClaim(claimId);
    }

    function test_SettleClaim_HappyPath() public {
        uint256 claimId = _submitClaim();
        _attest(claimId);

        vm.warp(block.timestamp + 7 days + 1);
        cv.settleClaim(claimId);

        ClaimVerification.Claim memory c = cv.getClaim(claimId);
        assertEq(uint8(c.status), uint8(ClaimVerification.ClaimStatus.FINALIZED));

        // UMA assertion settled as true
        assertTrue(oov3.getAssertion(c.assertionId).settled);
        assertTrue(oov3.getAssertion(c.assertionId).settlementResolution);

        // Contributor: stake released + 50% reward
        assertEq(stakeManager.getLockedBalance(claimer), 0);
        assertEq(stakeManager.depositedBalances(claimer), DEPOSIT + 10e6);

        // Verifier: stake released + 25% reward (bond already went to OOV3)
        assertEq(stakeManager.getLockedBalance(verifier), 0);
        assertEq(stakeManager.depositedBalances(verifier), DEPOSIT - 400e6 + 50e6);
    }

    function test_SettleClaim_RevertsIfAssertionResolvedFalse() public {
        uint256 claimId = _submitClaim();
        _attest(claimId);

        vm.warp(block.timestamp + 7 days + 1);
        oov3.setSettleResolution(false);

        vm.expectRevert("ClaimVerification: assertion resolved false");
        cv.settleClaim(claimId);
    }

    // ─── Challenge + Court resolution ───────────────────────────

    function test_ChallengeClaim() public {
        uint256 claimId = _submitClaim();
        _attest(claimId);

        vm.prank(challenger);
        cv.challengeClaim(claimId, "evidence is forged");

        ClaimVerification.Claim memory c = cv.getClaim(claimId);
        assertEq(uint8(c.status), uint8(ClaimVerification.ClaimStatus.CHALLENGED));
        assertEq(stakeManager.getLockedBalance(challenger), 300e6);

        uint256 disputeId = cv.claimToDispute(claimId);
        JurorCourt.Dispute memory d = court.getDispute(disputeId);
        assertEq(d.claimId, claimId);
        assertEq(uint8(d.status), uint8(JurorCourt.DisputeStatus.ACTIVE));
        assertEq(court.getDrawnJurors(disputeId).length, 3);
    }

    function test_CannotChallengeAfterWindow() public {
        uint256 claimId = _submitClaim();
        _attest(claimId);

        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(challenger);
        vm.expectRevert("ClaimVerification: challenge window closed");
        cv.challengeClaim(claimId, "too late");
    }

    function test_CourtRuling_ClaimIncorrect() public {
        uint256 claimId = _submitClaim();
        _attest(claimId);

        vm.prank(challenger);
        cv.challengeClaim(claimId, "evidence is forged");
        uint256 disputeId = cv.claimToDispute(claimId);

        // 2 of 3 drawn jurors vote against the claim -> majority
        address[] memory drawn = court.getDrawnJurors(disputeId);
        uint256 votes = 0;
        for (uint256 i = 0; i < drawn.length && votes < 2; i++) {
            vm.prank(drawn[i]);
            court.vote(disputeId, false);
            votes++;
        }

        vm.warp(block.timestamp + 24 hours + 1);
        court.resolve(disputeId);

        ClaimVerification.Claim memory c = cv.getClaim(claimId);
        assertEq(uint8(c.status), uint8(ClaimVerification.ClaimStatus.REJECTED));

        // Challenger receives slashed claimer (20) + verifier (200) stakes, own 300 released
        assertEq(stakeManager.getLockedBalance(challenger), 0);
        assertEq(stakeManager.depositedBalances(challenger), DEPOSIT + 20e6 + 200e6);

        // Claimer & verifier fully slashed
        assertEq(stakeManager.depositedBalances(claimer), DEPOSIT - 20e6);
        assertEq(stakeManager.depositedBalances(verifier), DEPOSIT - 200e6 - 400e6);

        // Majority jurors rewarded from treasury (30 / 2 = 15 each);
        // juror registration stake stays locked, deposit accounting unchanged
        assertEq(stakeManager.depositedBalances(drawn[0]), 500e6 + 15e6);
        assertEq(stakeManager.depositedBalances(drawn[1]), 500e6 + 15e6);
    }

    function test_CourtRuling_ClaimCorrect() public {
        uint256 claimId = _submitClaim();
        _attest(claimId);

        vm.prank(challenger);
        cv.challengeClaim(claimId, "bad faith challenge");
        uint256 disputeId = cv.claimToDispute(claimId);

        // All drawn jurors vote for the claim
        address[] memory drawn = court.getDrawnJurors(disputeId);
        for (uint256 i = 0; i < drawn.length; i++) {
            vm.prank(drawn[i]);
            court.vote(disputeId, true);
        }

        vm.warp(block.timestamp + 24 hours + 1);
        court.resolve(disputeId);

        ClaimVerification.Claim memory c = cv.getClaim(claimId);
        assertEq(uint8(c.status), uint8(ClaimVerification.ClaimStatus.FINALIZED));

        // Challenger slashed 300 to claimer
        assertEq(stakeManager.depositedBalances(claimer), DEPOSIT + 300e6);
        assertEq(stakeManager.depositedBalances(challenger), DEPOSIT - 300e6);

        // Verifier stake released
        assertEq(stakeManager.getLockedBalance(verifier), 0);
    }

    // ─── UMA OOV3 permissionless dispute path ───────────────────

    function test_UmaDisputeRoutesToCourt() public {
        uint256 claimId = _submitClaim();
        _attest(claimId);
        bytes32 assertionId = cv.getClaim(claimId).assertionId;

        // Third party disputes the assertion directly on OOV3
        oov3.disputeAssertion(assertionId, challenger);

        ClaimVerification.Claim memory c = cv.getClaim(claimId);
        assertEq(uint8(c.status), uint8(ClaimVerification.ClaimStatus.CHALLENGED));

        uint256 disputeId = cv.claimToDispute(claimId);
        JurorCourt.Dispute memory d = court.getDispute(disputeId);
        assertEq(d.challenger, challenger);
        assertEq(uint8(d.status), uint8(JurorCourt.DisputeStatus.ACTIVE));
    }

    // ─── Views ──────────────────────────────────────────────────

    function test_GetUserClaims() public {
        uint256 id1 = _submitClaim();
        uint256 id2 = _submitClaim();

        uint256[] memory ids = cv.getUserClaims(claimer);
        assertEq(ids.length, 2);
        assertEq(ids[0], id1);
        assertEq(ids[1], id2);
    }

    function test_TotalClaims() public {
        assertEq(cv.getTotalClaims(), 0);
        _submitClaim();
        _submitClaim();
        assertEq(cv.getTotalClaims(), 2);
    }
}
