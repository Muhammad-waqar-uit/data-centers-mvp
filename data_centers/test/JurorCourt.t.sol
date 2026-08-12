// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {StakeManager} from "../src/StakeManager.sol";
import {JurorCourt} from "../src/JurorCourt.sol";
import {MockUSDC, MockClaimVerification} from "./mocks/Mocks.sol";

/// @title JurorCourtTest
/// @notice Covers juror registration, dispute creation, juror drawing,
/// voting, majority resolution and minority slashing.
contract JurorCourtTest is Test {
    MockUSDC usdc;
    StakeManager stakeManager;
    JurorCourt court;
    MockClaimVerification mockCV;

    address owner;
    address[4] jurorAddrs;

    function setUp() public {
        owner = address(this);
        for (uint256 i = 0; i < 4; i++) {
            jurorAddrs[i] = makeAddr(string(abi.encodePacked("juror", vm.toString(i))));
        }

        usdc = new MockUSDC();
        stakeManager = new StakeManager(address(usdc));
        court = new JurorCourt(address(stakeManager));
        mockCV = new MockClaimVerification();

        stakeManager.authorizeContract(address(court));
        court.setClaimVerification(address(mockCV));

        // Register all 4 jurors with 100 USDC stake
        for (uint256 i = 0; i < 4; i++) {
            _deposit(jurorAddrs[i], 500e6);
            vm.prank(jurorAddrs[i]);
            court.registerJuror(100e6);
        }
    }

    function _deposit(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(stakeManager), amount);
        vm.prank(user);
        stakeManager.deposit(amount);
    }

    function _createDispute() internal returns (uint256) {
        vm.prank(address(mockCV));
        return court.createDispute(42, makeAddr("claimer"), makeAddr("challenger"));
    }

    // ─── Juror Registry ─────────────────────────────────────────

    function test_RegisterJuror() public {
        address fresh = makeAddr("freshJuror");
        _deposit(fresh, 500e6);

        vm.prank(fresh);
        court.registerJuror(200e6);

        assertTrue(court.isRegisteredJuror(fresh));
        assertEq(stakeManager.getLockedBalance(fresh), 200e6);
        assertEq(court.getJurorCount(), 5);
    }

    function test_CannotRegisterBelowMinStake() public {
        address fresh = makeAddr("freshJuror");
        _deposit(fresh, 500e6);

        vm.prank(fresh);
        vm.expectRevert("JurorCourt: stake below minimum");
        court.registerJuror(99e6);
    }

    function test_DeregisterJuror() public {
        vm.prank(jurorAddrs[0]);
        court.deregisterJuror();

        assertFalse(court.isRegisteredJuror(jurorAddrs[0]));
        assertEq(stakeManager.getLockedBalance(jurorAddrs[0]), 0);
    }

    // ─── Dispute Creation ───────────────────────────────────────

    function test_CreateDispute_OnlyClaimVerification() public {
        vm.expectRevert("JurorCourt: not claim verification");
        court.createDispute(42, makeAddr("claimer"), makeAddr("challenger"));
    }

    function test_CreateDispute_DrawsJurors() public {
        uint256 disputeId = _createDispute();

        JurorCourt.Dispute memory d = court.getDispute(disputeId);
        assertEq(d.claimId, 42);
        assertEq(uint8(d.status), uint8(JurorCourt.DisputeStatus.ACTIVE));
        assertEq(d.votingDeadline, block.timestamp + 24 hours);

        address[] memory drawn = court.getDrawnJurors(disputeId);
        assertEq(drawn.length, 3);

        // All drawn jurors are registered and unique
        for (uint256 i = 0; i < drawn.length; i++) {
            assertTrue(court.isRegisteredJuror(drawn[i]));
            for (uint256 j = i + 1; j < drawn.length; j++) {
                assertTrue(drawn[i] != drawn[j]);
            }
        }
    }

    // ─── Voting ─────────────────────────────────────────────────

    function test_Vote() public {
        uint256 disputeId = _createDispute();
        address[] memory drawn = court.getDrawnJurors(disputeId);

        vm.prank(drawn[0]);
        court.vote(disputeId, true);

        assertTrue(court.hasVoted(disputeId, drawn[0]));
        assertTrue(court.voteDirection(disputeId, drawn[0]));
        assertEq(court.getDispute(disputeId).votesForClaim, 1);
    }

    function test_CannotDoubleVote() public {
        uint256 disputeId = _createDispute();
        address[] memory drawn = court.getDrawnJurors(disputeId);

        vm.startPrank(drawn[0]);
        court.vote(disputeId, true);
        vm.expectRevert("JurorCourt: already voted");
        court.vote(disputeId, false);
        vm.stopPrank();
    }

    function test_NonDrawnJurorCannotVote() public {
        uint256 disputeId = _createDispute();
        address[] memory drawn = court.getDrawnJurors(disputeId);

        address notDrawn = address(0);
        for (uint256 i = 0; i < 4; i++) {
            bool found = false;
            for (uint256 j = 0; j < drawn.length; j++) {
                if (jurorAddrs[i] == drawn[j]) found = true;
            }
            if (!found) {
                notDrawn = jurorAddrs[i];
                break;
            }
        }
        assertTrue(notDrawn != address(0));

        vm.prank(notDrawn);
        vm.expectRevert("JurorCourt: not a drawn juror");
        court.vote(disputeId, true);
    }

    // ─── Resolution ─────────────────────────────────────────────

    function test_CannotResolveBeforeDeadline() public {
        uint256 disputeId = _createDispute();
        vm.expectRevert("JurorCourt: voting still open");
        court.resolve(disputeId);
    }

    function test_Resolve_MajorityForClaim_SlashesMinority() public {
        uint256 disputeId = _createDispute();
        address[] memory drawn = court.getDrawnJurors(disputeId);

        // 2 for, 1 against
        vm.prank(drawn[0]);
        court.vote(disputeId, true);
        vm.prank(drawn[1]);
        court.vote(disputeId, true);
        vm.prank(drawn[2]);
        court.vote(disputeId, false);

        vm.warp(block.timestamp + 24 hours + 1);
        court.resolve(disputeId);

        JurorCourt.Dispute memory d = court.getDispute(disputeId);
        assertEq(uint8(d.status), uint8(JurorCourt.DisputeStatus.RESOLVED));
        assertTrue(d.claimCorrect);

        // Callback received by ClaimVerification with 2 majority voters
        assertEq(mockCV.lastClaimId(), 42);
        assertTrue(mockCV.lastClaimCorrect());
        assertEq(mockCV.getLastMajorityVoters().length, 2);

        // Minority juror slashed 50% of their 100 USDC stake
        (uint256 minorityStake,,,) = court.jurors(drawn[2]);
        assertEq(minorityStake, 50e6);
        assertEq(stakeManager.getLockedBalance(drawn[2]), 50e6);
    }

    function test_Resolve_MajorityAgainstClaim() public {
        uint256 disputeId = _createDispute();
        address[] memory drawn = court.getDrawnJurors(disputeId);

        vm.prank(drawn[0]);
        court.vote(disputeId, false);
        vm.prank(drawn[1]);
        court.vote(disputeId, false);
        vm.prank(drawn[2]);
        court.vote(disputeId, true);

        vm.warp(block.timestamp + 24 hours + 1);
        court.resolve(disputeId);

        assertFalse(court.getDispute(disputeId).claimCorrect);
        assertFalse(mockCV.lastClaimCorrect());
        assertEq(mockCV.getLastMajorityVoters().length, 2);
    }

    function test_Resolve_TieDefaultsToClaim() public {
        uint256 disputeId = _createDispute();
        address[] memory drawn = court.getDrawnJurors(disputeId);

        // 1 for, 1 against, 1 abstains -> tie resolves in favor of the claim
        vm.prank(drawn[0]);
        court.vote(disputeId, true);
        vm.prank(drawn[1]);
        court.vote(disputeId, false);

        vm.warp(block.timestamp + 24 hours + 1);
        court.resolve(disputeId);

        assertTrue(court.getDispute(disputeId).claimCorrect);
        assertTrue(mockCV.lastClaimCorrect());
        // Only the "for" voter is on the winning side
        assertEq(mockCV.getLastMajorityVoters().length, 1);
    }
}
