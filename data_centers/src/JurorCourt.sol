// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {StakeManager} from "./StakeManager.sol";
import {IClaimVerification} from "./interfaces/IClaimVerification.sol";

/// @title JurorCourt
/// @notice Kleros-style decentralized jury for resolving challenged claims.
/// Jurors stake USDC to join, are drawn pseudo-randomly per dispute, and vote.
/// Majority rules; minority voters are slashed, majority voters keep their stake.
/// NOTE: Randomness uses blockhash seeding — acceptable for testnet MVP only;
/// production should use a VRF (e.g. Chainlink VRF).
contract JurorCourt {
    // ─── Types ──────────────────────────────────────────────────

    enum DisputeStatus {
        NONE,
        ACTIVE,
        RESOLVED
    }

    struct Juror {
        uint256 stake;
        bool active;
        uint256 registeredAt;
        uint256 disputesVoted;
    }

    struct Dispute {
        uint256 id;
        uint256 claimId;
        address claimer;
        address challenger;
        DisputeStatus status;
        uint256 votingDeadline;
        uint256 votesForClaim;
        uint256 votesAgainstClaim;
        bool claimCorrect;
    }

    // ─── State ──────────────────────────────────────────────────

    StakeManager public immutable stakeManager;
    address public claimVerification;
    address public owner;

    uint256 public minJurorStake;    // USDC (6 decimals)
    uint256 public jurySize;         // jurors drawn per dispute
    uint256 public votingWindow;     // seconds jurors have to vote
    uint256 public slashPercentage;  // basis points of juror stake slashed for minority (5000 = 50%)

    address[] public jurorList;
    mapping(address => Juror) public jurors;

    uint256 public nextDisputeId;
    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => address[]) public drawnJurors;   // disputeId -> jurors
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public voteDirection; // disputeId -> juror -> supportClaim

    // ─── Events ─────────────────────────────────────────────────

    event JurorRegistered(address indexed juror, uint256 stake);
    event JurorDeregistered(address indexed juror);
    event DisputeCreated(
        uint256 indexed disputeId, uint256 indexed claimId, address indexed challenger, uint256 votingDeadline
    );
    event JurorsDrawn(uint256 indexed disputeId, address[] jurors);
    event VoteCast(uint256 indexed disputeId, address indexed juror, bool supportClaim);
    event DisputeResolved(uint256 indexed disputeId, bool claimCorrect, uint256 votesFor, uint256 votesAgainst);
    event JurorSlashed(address indexed juror, uint256 amount);
    event ClaimVerificationSet(address indexed claimVerification);

    // ─── Modifiers ──────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "JurorCourt: not owner");
        _;
    }

    modifier onlyClaimVerification() {
        require(msg.sender == claimVerification, "JurorCourt: not claim verification");
        _;
    }

    // ─── Constructor ────────────────────────────────────────────

    constructor(address _stakeManager) {
        require(_stakeManager != address(0), "JurorCourt: zero stake manager");
        stakeManager = StakeManager(_stakeManager);
        owner = msg.sender;
        minJurorStake = 100 * 1e6; // 100 USDC
        jurySize = 3;
        votingWindow = 24 hours;
        slashPercentage = 5000; // 50%
        nextDisputeId = 1;
    }

    // ─── Juror Registry ─────────────────────────────────────────

    /// @notice Stake USDC (from StakeManager deposit balance) to become an eligible juror
    function registerJuror(uint256 _stake) external {
        require(!jurors[msg.sender].active, "JurorCourt: already registered");
        require(_stake >= minJurorStake, "JurorCourt: stake below minimum");

        stakeManager.lockStake(msg.sender, _stake, _jurorRefId(msg.sender));

        jurors[msg.sender] = Juror({stake: _stake, active: true, registeredAt: block.timestamp, disputesVoted: 0});
        jurorList.push(msg.sender);

        emit JurorRegistered(msg.sender, _stake);
    }

    /// @notice Deregister and unlock juror stake (only when no active disputes)
    function deregisterJuror() external {
        Juror storage juror = jurors[msg.sender];
        require(juror.active, "JurorCourt: not registered");

        uint256 activeDisputes = 0;
        for (uint256 i = 1; i < nextDisputeId; i++) {
            if (disputes[i].status == DisputeStatus.ACTIVE && _isDrawn(i, msg.sender)) {
                activeDisputes++;
            }
        }
        require(activeDisputes == 0, "JurorCourt: active disputes pending");

        stakeManager.releaseStake(msg.sender, juror.stake, _jurorRefId(msg.sender));
        juror.active = false;

        emit JurorDeregistered(msg.sender);
    }

    // ─── Dispute Lifecycle ──────────────────────────────────────

    /// @notice Create a dispute for a challenged claim; draws jurors immediately
    function createDispute(uint256 _claimId, address _claimer, address _challenger)
        external
        onlyClaimVerification
        returns (uint256)
    {
        require(jurorList.length >= jurySize, "JurorCourt: not enough jurors");

        uint256 disputeId = nextDisputeId++;

        disputes[disputeId] = Dispute({
            id: disputeId,
            claimId: _claimId,
            claimer: _claimer,
            challenger: _challenger,
            status: DisputeStatus.ACTIVE,
            votingDeadline: block.timestamp + votingWindow,
            votesForClaim: 0,
            votesAgainstClaim: 0,
            claimCorrect: false
        });

        _drawJurors(disputeId);

        emit DisputeCreated(disputeId, _claimId, _challenger, disputes[disputeId].votingDeadline);
        return disputeId;
    }

    /// @notice Drawn juror casts their vote
    function vote(uint256 _disputeId, bool _supportClaim) external {
        Dispute storage dispute = disputes[_disputeId];
        require(dispute.status == DisputeStatus.ACTIVE, "JurorCourt: dispute not active");
        require(block.timestamp < dispute.votingDeadline, "JurorCourt: voting closed");
        require(_isDrawn(_disputeId, msg.sender), "JurorCourt: not a drawn juror");
        require(!hasVoted[_disputeId][msg.sender], "JurorCourt: already voted");

        hasVoted[_disputeId][msg.sender] = true;
        voteDirection[_disputeId][msg.sender] = _supportClaim;
        jurors[msg.sender].disputesVoted++;

        if (_supportClaim) {
            dispute.votesForClaim++;
        } else {
            dispute.votesAgainstClaim++;
        }

        emit VoteCast(_disputeId, msg.sender, _supportClaim);
    }

    /// @notice Resolve after voting deadline: majority wins, minority slashed.
    /// Ties or zero votes resolve in favor of the claim (optimistic default).
    function resolve(uint256 _disputeId) external {
        Dispute storage dispute = disputes[_disputeId];
        require(dispute.status == DisputeStatus.ACTIVE, "JurorCourt: dispute not active");
        require(block.timestamp >= dispute.votingDeadline, "JurorCourt: voting still open");

        bool claimCorrect = dispute.votesForClaim >= dispute.votesAgainstClaim;
        dispute.claimCorrect = claimCorrect;
        dispute.status = DisputeStatus.RESOLVED;

        // Collect majority / minority voters
        address[] storage drawn = drawnJurors[_disputeId];
        address[] memory majorityVoters = new address[](drawn.length);
        uint256 majorityCount = 0;

        for (uint256 i = 0; i < drawn.length; i++) {
            address juror = drawn[i];
            if (!hasVoted[_disputeId][juror]) continue;
            bool onWinningSide = voteDirection[_disputeId][juror] == claimCorrect;
            if (onWinningSide) {
                majorityVoters[majorityCount++] = juror;
            } else {
                _slashMinorityJuror(juror);
            }
        }

        // Trim majority array
        address[] memory trimmed = new address[](majorityCount);
        for (uint256 i = 0; i < majorityCount; i++) {
            trimmed[i] = majorityVoters[i];
        }

        emit DisputeResolved(_disputeId, claimCorrect, dispute.votesForClaim, dispute.votesAgainstClaim);

        // Execute the ruling on ClaimVerification (stake payouts + jury rewards)
        IClaimVerification(claimVerification).executeCourtRuling(dispute.claimId, claimCorrect, trimmed);
    }

    // ─── Views ──────────────────────────────────────────────────

    function getDispute(uint256 _disputeId) external view returns (Dispute memory) {
        return disputes[_disputeId];
    }

    function getDrawnJurors(uint256 _disputeId) external view returns (address[] memory) {
        return drawnJurors[_disputeId];
    }

    function getJurorCount() external view returns (uint256) {
        return jurorList.length;
    }

    function isRegisteredJuror(address _juror) external view returns (bool) {
        return jurors[_juror].active;
    }

    // ─── Admin ──────────────────────────────────────────────────

    function setClaimVerification(address _claimVerification) external onlyOwner {
        require(_claimVerification != address(0), "JurorCourt: zero address");
        claimVerification = _claimVerification;
        emit ClaimVerificationSet(_claimVerification);
    }

    function updateParameters(uint256 _minJurorStake, uint256 _jurySize, uint256 _votingWindow, uint256 _slashPercentage)
        external
        onlyOwner
    {
        require(_jurySize > 0, "JurorCourt: zero jury size");
        require(_slashPercentage <= 10000, "JurorCourt: invalid slash percentage");
        minJurorStake = _minJurorStake;
        jurySize = _jurySize;
        votingWindow = _votingWindow;
        slashPercentage = _slashPercentage;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "JurorCourt: zero address");
        owner = _newOwner;
    }

    // ─── Internal ───────────────────────────────────────────────

    /// @dev Pseudo-random juror selection via blockhash seed (MVP-grade only).
    function _drawJurors(uint256 _disputeId) internal {
        uint256 n = jurorList.length;
        uint256 seed = uint256(keccak256(abi.encodePacked(blockhash(block.number - 1), _disputeId, block.timestamp)));

        address[] memory selected = new address[](jurySize);
        uint256 selectedCount = 0;

        uint256 attempts = 0;
        while (selectedCount < jurySize && attempts < n * 3) {
            address candidate = jurorList[seed % n];
            seed = uint256(keccak256(abi.encodePacked(seed, attempts)));
            attempts++;

            if (!jurors[candidate].active) continue;

            bool duplicate = false;
            for (uint256 i = 0; i < selectedCount; i++) {
                if (selected[i] == candidate) {
                    duplicate = true;
                    break;
                }
            }
            if (duplicate) continue;

            selected[selectedCount++] = candidate;
        }

        require(selectedCount == jurySize, "JurorCourt: could not draw enough jurors");

        for (uint256 i = 0; i < selectedCount; i++) {
            drawnJurors[_disputeId].push(selected[i]);
        }

        emit JurorsDrawn(_disputeId, drawnJurors[_disputeId]);
    }

    function _isDrawn(uint256 _disputeId, address _juror) internal view returns (bool) {
        address[] storage drawn = drawnJurors[_disputeId];
        for (uint256 i = 0; i < drawn.length; i++) {
            if (drawn[i] == _juror) return true;
        }
        return false;
    }

    function _slashMinorityJuror(address _juror) internal {
        Juror storage juror = jurors[_juror];
        uint256 slashAmount = (juror.stake * slashPercentage) / 10000;
        if (slashAmount == 0) return;

        juror.stake -= slashAmount;
        // Slashed funds go to the StakeManager treasury (beneficiary = owner for reward funding)
        stakeManager.slashStake(_juror, slashAmount, owner, _jurorRefId(_juror));

        emit JurorSlashed(_juror, slashAmount);
    }

    function _jurorRefId(address juror) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("juror", juror));
    }
}
