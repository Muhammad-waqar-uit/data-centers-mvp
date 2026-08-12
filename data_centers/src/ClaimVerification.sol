// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {StakeManager} from "./StakeManager.sol";

/// @title ClaimVerification
/// @notice Optimistic oracle for data center claim submission, attestation, challenge, and dispute resolution
contract ClaimVerification {
    // ─── Types ──────────────────────────────────────────────────

    enum FactType {
        INTERCONNECTION_QUEUE,
        OWNERSHIP,
        GRID_STATUS,
        POWER_CAPACITY,
        CONSTRUCTION_STATUS,
        TRANSACTION_HISTORY,
        LAND_USE,
        WATER_COOLING,
        FIBER_CONNECTIVITY,
        OTHER
    }

    enum ClaimStatus {
        PENDING,
        ATTESTED,
        CHALLENGED,
        FINALIZED,
        REJECTED
    }

    struct Claim {
        uint256 id;
        uint256 dataCenterId;
        address claimer;
        FactType factType;
        string factData;
        bytes32 proofHash;
        uint256 stakeAmount;
        ClaimStatus status;
        uint256 submittedAt;
        uint256 challengeWindowEnd;
    }

    struct Attestation {
        address verifier;
        uint256 stakeAmount;
        uint256 attestedAt;
    }

    struct Challenge {
        address challenger;
        uint256 stakeAmount;
        string reason;
        uint256 challengedAt;
    }

    // ─── State ──────────────────────────────────────────────────

    StakeManager public immutable stakeManager;
    address public owner;

    uint256 public nextClaimId;
    uint256 public challengeWindowDuration; // seconds (default: 7 days)
    uint256 public minContributorStake;     // USDC (6 decimals)
    uint256 public minVerifierStake;        // USDC (6 decimals)
    uint256 public minChallengerStake;      // USDC (6 decimals)

    mapping(uint256 => Claim) public claims;
    mapping(uint256 => Attestation) public attestations;
    mapping(uint256 => Challenge) public challenges;

    // Per-user claim tracking
    mapping(address => uint256[]) public userClaims;
    mapping(uint256 => uint256[]) public dataCenterClaims;

    // ─── Events ─────────────────────────────────────────────────

    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed dataCenterId,
        address indexed claimer,
        FactType factType,
        uint256 stakeAmount
    );

    event ClaimAttested(
        uint256 indexed claimId,
        address indexed verifier,
        uint256 stakeAmount
    );

    event ClaimChallenged(
        uint256 indexed claimId,
        address indexed challenger,
        uint256 stakeAmount,
        string reason
    );

    event ClaimFinalized(uint256 indexed claimId);
    event ClaimRejected(uint256 indexed claimId);

    event DisputeResolved(
        uint256 indexed claimId,
        bool claimCorrect,
        address indexed resolver
    );

    event ParametersUpdated(
        uint256 challengeWindowDuration,
        uint256 minContributorStake,
        uint256 minVerifierStake,
        uint256 minChallengerStake
    );

    // ─── Modifiers ──────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "ClaimVerification: not owner");
        _;
    }

    // ─── Constructor ────────────────────────────────────────────

    constructor(address _stakeManager) {
        require(_stakeManager != address(0), "ClaimVerification: zero stake manager");
        stakeManager = StakeManager(_stakeManager);
        owner = msg.sender;
        nextClaimId = 1;
        challengeWindowDuration = 7 days;
        minContributorStake = 20 * 1e6;   // 20 USDC
        minVerifierStake = 200 * 1e6;     // 200 USDC
        minChallengerStake = 300 * 1e6;   // 300 USDC
    }

    // ─── Claim Submission ───────────────────────────────────────

    function submitClaim(
        uint256 _dataCenterId,
        FactType _factType,
        string calldata _factData,
        bytes32 _proofHash
    ) external returns (uint256) {
        require(bytes(_factData).length > 0, "ClaimVerification: empty fact data");
        require(minContributorStake > 0, "ClaimVerification: zero min stake");

        uint256 claimId = nextClaimId++;

        // Lock contributor stake
        bytes32 refId = _claimRefId(claimId, "contributor");
        stakeManager.lockStake(msg.sender, minContributorStake, refId);

        claims[claimId] = Claim({
            id: claimId,
            dataCenterId: _dataCenterId,
            claimer: msg.sender,
            factType: _factType,
            factData: _factData,
            proofHash: _proofHash,
            stakeAmount: minContributorStake,
            status: ClaimStatus.PENDING,
            submittedAt: block.timestamp,
            challengeWindowEnd: 0 // set when attested
        });

        userClaims[msg.sender].push(claimId);
        dataCenterClaims[_dataCenterId].push(claimId);

        emit ClaimSubmitted(claimId, _dataCenterId, msg.sender, _factType, minContributorStake);
        return claimId;
    }

    // ─── Attestation ────────────────────────────────────────────

    function attestClaim(uint256 _claimId) external {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.PENDING, "ClaimVerification: not pending");
        require(msg.sender != claim.claimer, "ClaimVerification: cannot self-attest");

        // Lock verifier stake
        bytes32 refId = _claimRefId(_claimId, "verifier");
        stakeManager.lockStake(msg.sender, minVerifierStake, refId);

        attestations[_claimId] = Attestation({
            verifier: msg.sender,
            stakeAmount: minVerifierStake,
            attestedAt: block.timestamp
        });

        claim.status = ClaimStatus.ATTESTED;
        claim.challengeWindowEnd = block.timestamp + challengeWindowDuration;

        emit ClaimAttested(_claimId, msg.sender, minVerifierStake);
    }

    // ─── Challenge ──────────────────────────────────────────────

    function challengeClaim(uint256 _claimId, string calldata _reason) external {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.ATTESTED, "ClaimVerification: not attested");
        require(
            block.timestamp < claim.challengeWindowEnd,
            "ClaimVerification: challenge window closed"
        );

        // Lock challenger stake
        bytes32 refId = _claimRefId(_claimId, "challenger");
        stakeManager.lockStake(msg.sender, minChallengerStake, refId);

        challenges[_claimId] = Challenge({
            challenger: msg.sender,
            stakeAmount: minChallengerStake,
            reason: _reason,
            challengedAt: block.timestamp
        });

        claim.status = ClaimStatus.CHALLENGED;

        emit ClaimChallenged(_claimId, msg.sender, minChallengerStake, _reason);
    }

    // ─── Finalization ───────────────────────────────────────────

    /// @notice Anyone can call to finalize an unchallenged claim after the window closes
    function finalizeClaim(uint256 _claimId) external {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.ATTESTED, "ClaimVerification: not attested");
        require(
            block.timestamp >= claim.challengeWindowEnd,
            "ClaimVerification: window still open"
        );

        Attestation memory att = attestations[_claimId];

        // Release contributor stake
        stakeManager.releaseStake(claim.claimer, claim.stakeAmount, _claimRefId(_claimId, "contributor"));
        // Reward contributor
        stakeManager.reward(claim.claimer, claim.stakeAmount / 2, _claimRefId(_claimId, "contributor-reward"));

        // Release verifier stake
        stakeManager.releaseStake(att.verifier, att.stakeAmount, _claimRefId(_claimId, "verifier"));
        // Reward verifier
        stakeManager.reward(att.verifier, att.stakeAmount / 4, _claimRefId(_claimId, "verifier-reward"));

        claim.status = ClaimStatus.FINALIZED;

        emit ClaimFinalized(_claimId);
    }

    // ─── Dispute Resolution ─────────────────────────────────────

    /// @notice Called by owner or authorized arbitrator to resolve a challenged claim
    /// @param _claimCorrect true = claim is valid (challenger loses); false = claim is invalid (claimer/verifier lose)
    function resolveDispute(uint256 _claimId, bool _claimCorrect) external onlyOwner {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.CHALLENGED, "ClaimVerification: not challenged");

        Attestation memory att = attestations[_claimId];
        Challenge memory ch = challenges[_claimId];

        if (_claimCorrect) {
            // Claim stands: slash challenger, reward claimer & verifier
            stakeManager.slashStake(
                ch.challenger,
                ch.stakeAmount,
                claim.claimer,
                _claimRefId(_claimId, "challenger")
            );
            stakeManager.releaseStake(claim.claimer, claim.stakeAmount, _claimRefId(_claimId, "contributor"));
            stakeManager.releaseStake(att.verifier, att.stakeAmount, _claimRefId(_claimId, "verifier"));

            claim.status = ClaimStatus.FINALIZED;
            emit ClaimFinalized(_claimId);
        } else {
            // Claim rejected: slash claimer & verifier, reward challenger
            stakeManager.slashStake(
                claim.claimer,
                claim.stakeAmount,
                ch.challenger,
                _claimRefId(_claimId, "contributor")
            );
            stakeManager.slashStake(
                att.verifier,
                att.stakeAmount,
                ch.challenger,
                _claimRefId(_claimId, "verifier")
            );
            stakeManager.releaseStake(ch.challenger, ch.stakeAmount, _claimRefId(_claimId, "challenger"));

            claim.status = ClaimStatus.REJECTED;
            emit ClaimRejected(_claimId);
        }

        emit DisputeResolved(_claimId, _claimCorrect, msg.sender);
    }

    // ─── Views ──────────────────────────────────────────────────

    function getClaim(uint256 _claimId) external view returns (Claim memory) {
        return claims[_claimId];
    }

    function getAttestation(uint256 _claimId) external view returns (Attestation memory) {
        return attestations[_claimId];
    }

    function getChallenge(uint256 _claimId) external view returns (Challenge memory) {
        return challenges[_claimId];
    }

    function getUserClaims(address _user) external view returns (uint256[] memory) {
        return userClaims[_user];
    }

    function getDataCenterClaims(uint256 _dataCenterId) external view returns (uint256[] memory) {
        return dataCenterClaims[_dataCenterId];
    }

    function getTotalClaims() external view returns (uint256) {
        return nextClaimId - 1;
    }

    function isChallengeWindowOpen(uint256 _claimId) external view returns (bool) {
        Claim memory claim = claims[_claimId];
        return claim.status == ClaimStatus.ATTESTED && block.timestamp < claim.challengeWindowEnd;
    }

    // ─── Admin ──────────────────────────────────────────────────

    function updateParameters(
        uint256 _challengeWindowDuration,
        uint256 _minContributorStake,
        uint256 _minVerifierStake,
        uint256 _minChallengerStake
    ) external onlyOwner {
        challengeWindowDuration = _challengeWindowDuration;
        minContributorStake = _minContributorStake;
        minVerifierStake = _minVerifierStake;
        minChallengerStake = _minChallengerStake;

        emit ParametersUpdated(
            _challengeWindowDuration,
            _minContributorStake,
            _minVerifierStake,
            _minChallengerStake
        );
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "ClaimVerification: zero address");
        owner = _newOwner;
    }

    // ─── Internal ───────────────────────────────────────────────

    function _claimRefId(uint256 claimId, string memory role) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(claimId, role));
    }
}
