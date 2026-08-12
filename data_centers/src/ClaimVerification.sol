// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {StakeManager} from "./StakeManager.sol";
import {OptimisticOracleV3Interface} from "./interfaces/OptimisticOracleV3Interface.sol";

/// @title IJurorCourt — minimal interface used by ClaimVerification
interface IJurorCourt {
    function createDispute(uint256 claimId, address claimer, address challenger) external returns (uint256);
}

/// @title ClaimVerification
/// @notice Decentralized contribution & verification flow:
///  - Contributors submit claims with a USDC stake
///  - Verifiers attest with a larger stake AND assert the claim's truth into UMA OptimisticOracleV3
///  - Uncontested claims settle optimistically (UMA assertion + challenge window)
///  - Challenged claims route to the JurorCourt (Kleros-style jury) for decentralized resolution
///  - Anyone may also dispute the UMA assertion directly on OOV3 (escalates to UMA DVM);
///    such disputes automatically route into the JurorCourt as well.
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
        bytes32 assertionId; // UMA OOV3 assertion (zero until attested)
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
    OptimisticOracleV3Interface public immutable oov3;
    IJurorCourt public court;
    address public owner;

    uint256 public nextClaimId;
    uint256 public challengeWindowDuration; // seconds (default: 7 days)
    uint256 public minContributorStake;     // USDC (6 decimals)
    uint256 public minVerifierStake;        // USDC (6 decimals)
    uint256 public minChallengerStake;      // USDC (6 decimals)
    uint256 public juryRewardTotal;         // USDC paid to majority jurors from treasury per dispute

    mapping(uint256 => Claim) public claims;
    mapping(uint256 => Attestation) public attestations;
    mapping(uint256 => Challenge) public challenges;
    mapping(bytes32 => uint256) public assertionToClaim;
    mapping(uint256 => uint256) public claimToDispute; // claimId -> court disputeId

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
        uint256 stakeAmount,
        bytes32 assertionId
    );

    event ClaimChallenged(
        uint256 indexed claimId,
        address indexed challenger,
        uint256 stakeAmount,
        uint256 disputeId,
        string reason
    );

    event ClaimFinalized(uint256 indexed claimId);
    event ClaimRejected(uint256 indexed claimId);

    event CourtRulingExecuted(
        uint256 indexed claimId, bool claimCorrect, uint256 disputeId, address[] majorityVoters
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

    modifier onlyCourt() {
        require(msg.sender == address(court), "ClaimVerification: not court");
        _;
    }

    // ─── Constructor ────────────────────────────────────────────

    constructor(address _stakeManager, address _oov3) {
        require(_stakeManager != address(0), "ClaimVerification: zero stake manager");
        require(_oov3 != address(0), "ClaimVerification: zero oov3");
        stakeManager = StakeManager(_stakeManager);
        oov3 = OptimisticOracleV3Interface(_oov3);
        owner = msg.sender;
        nextClaimId = 1;
        challengeWindowDuration = 7 days;
        minContributorStake = 20 * 1e6;   // 20 USDC
        minVerifierStake = 200 * 1e6;     // 200 USDC
        minChallengerStake = 300 * 1e6;   // 300 USDC
        juryRewardTotal = 30 * 1e6;       // 30 USDC from treasury, split among majority jurors
    }

    // ─── Claim Submission ───────────────────────────────────────

    function submitClaim(
        uint256 _dataCenterId,
        FactType _factType,
        string calldata _factData,
        bytes32 _proofHash
    ) external returns (uint256) {
        require(bytes(_factData).length > 0, "ClaimVerification: empty fact data");

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
            challengeWindowEnd: 0, // set when attested
            assertionId: bytes32(0)
        });

        userClaims[msg.sender].push(claimId);
        dataCenterClaims[_dataCenterId].push(claimId);

        emit ClaimSubmitted(claimId, _dataCenterId, msg.sender, _factType, minContributorStake);
        return claimId;
    }

    // ─── Attestation (UMA OOV3 assertion) ───────────────────────

    /// @notice Verifier locks their stake and asserts the claim's truth on UMA OOV3.
    /// @dev The OOV3 bond (>= getMinimumBond) is pulled from the verifier's available
    /// deposit balance; at undisputed settlement the bond returns to the verifier directly.
    function attestClaim(uint256 _claimId) external {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.PENDING, "ClaimVerification: not pending");
        require(msg.sender != claim.claimer, "ClaimVerification: cannot self-attest");

        // Lock verifier stake
        bytes32 refId = _claimRefId(_claimId, "verifier");
        stakeManager.lockStake(msg.sender, minVerifierStake, refId);

        // Pull the OOV3 bond from verifier's deposit and assert truth
        uint256 bond = oov3.getMinimumBond(address(stakeManager.usdc()));
        if (bond > 0) {
            stakeManager.transferFromDeposit(msg.sender, address(this), bond);
            stakeManager.usdc().approve(address(oov3), bond);
        }

        bytes memory claimData =
            abi.encodePacked("DataPulse claim #", _uint2str(_claimId), ": ", claim.factData);

        bytes32 assertionId = oov3.assertTruth(
            claimData,
            msg.sender,            // bond returns to verifier at settlement
            address(this),         // callback recipient
            address(0),            // no escalation manager -> UMA DVM on dispute
            uint64(block.timestamp + challengeWindowDuration),
            IERC20(address(stakeManager.usdc())),
            bond,
            oov3.defaultIdentifier(),
            bytes32(0)
        );

        assertionToClaim[assertionId] = _claimId;

        attestations[_claimId] =
            Attestation({verifier: msg.sender, stakeAmount: minVerifierStake, attestedAt: block.timestamp});

        claim.status = ClaimStatus.ATTESTED;
        claim.challengeWindowEnd = block.timestamp + challengeWindowDuration;
        claim.assertionId = assertionId;

        emit ClaimAttested(_claimId, msg.sender, minVerifierStake, assertionId);
    }

    // ─── Challenge (routes to JurorCourt) ───────────────────────

    function challengeClaim(uint256 _claimId, string calldata _reason) external {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.ATTESTED, "ClaimVerification: not attested");
        require(block.timestamp < claim.challengeWindowEnd, "ClaimVerification: challenge window closed");

        // Lock challenger stake
        bytes32 refId = _claimRefId(_claimId, "challenger");
        stakeManager.lockStake(msg.sender, minChallengerStake, refId);

        challenges[_claimId] = Challenge({
            challenger: msg.sender,
            stakeAmount: minChallengerStake,
            reason: _reason,
            challengedAt: block.timestamp
        });

        uint256 disputeId = court.createDispute(_claimId, claim.claimer, msg.sender);
        claimToDispute[_claimId] = disputeId;
        claim.status = ClaimStatus.CHALLENGED;

        emit ClaimChallenged(_claimId, msg.sender, minChallengerStake, disputeId, _reason);
    }

    // ─── Settlement (optimistic happy path) ─────────────────────

    /// @notice Anyone can settle an unchallenged claim once the window closes
    /// and the UMA assertion has settled as true.
    function settleClaim(uint256 _claimId) external {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.ATTESTED, "ClaimVerification: not attested");
        require(block.timestamp >= claim.challengeWindowEnd, "ClaimVerification: window still open");

        // Settle the UMA assertion if it hasn't been settled yet
        OptimisticOracleV3Interface.Assertion memory assertion = oov3.getAssertion(claim.assertionId);
        if (!assertion.settled) {
            oov3.settleAssertion(claim.assertionId);
            assertion = oov3.getAssertion(claim.assertionId);
        }
        require(assertion.settled, "ClaimVerification: assertion not settled");
        require(assertion.settlementResolution, "ClaimVerification: assertion resolved false");

        Attestation memory att = attestations[_claimId];

        // Release contributor stake + reward
        stakeManager.releaseStake(claim.claimer, claim.stakeAmount, _claimRefId(_claimId, "contributor"));
        stakeManager.reward(claim.claimer, claim.stakeAmount / 2, _claimRefId(_claimId, "contributor-reward"));

        // Release verifier stake + reward
        stakeManager.releaseStake(att.verifier, att.stakeAmount, _claimRefId(_claimId, "verifier"));
        stakeManager.reward(att.verifier, att.stakeAmount / 4, _claimRefId(_claimId, "verifier-reward"));

        claim.status = ClaimStatus.FINALIZED;

        emit ClaimFinalized(_claimId);
    }

    // ─── Court Ruling Execution ─────────────────────────────────

    /// @notice Called by JurorCourt after the jury reaches a decision. Executes the
    /// stake payouts and pays majority jurors a treasury reward.
    function executeCourtRuling(uint256 _claimId, bool _claimCorrect, address[] calldata _majorityVoters)
        external
        onlyCourt
    {
        Claim storage claim = claims[_claimId];
        require(claim.status == ClaimStatus.CHALLENGED, "ClaimVerification: not challenged");

        Attestation memory att = attestations[_claimId];
        Challenge memory ch = challenges[_claimId];

        if (_claimCorrect) {
            // Claim stands: slash challenger, release claimer & verifier stakes
            stakeManager.slashStake(
                ch.challenger, ch.stakeAmount, claim.claimer, _claimRefId(_claimId, "challenger")
            );
            stakeManager.releaseStake(claim.claimer, claim.stakeAmount, _claimRefId(_claimId, "contributor"));
            stakeManager.releaseStake(att.verifier, att.stakeAmount, _claimRefId(_claimId, "verifier"));

            claim.status = ClaimStatus.FINALIZED;
            emit ClaimFinalized(_claimId);
        } else {
            // Claim rejected: slash claimer & verifier to challenger, release challenger stake
            stakeManager.slashStake(
                claim.claimer, claim.stakeAmount, ch.challenger, _claimRefId(_claimId, "contributor")
            );
            stakeManager.slashStake(
                att.verifier, att.stakeAmount, ch.challenger, _claimRefId(_claimId, "verifier")
            );
            stakeManager.releaseStake(ch.challenger, ch.stakeAmount, _claimRefId(_claimId, "challenger"));

            claim.status = ClaimStatus.REJECTED;
            emit ClaimRejected(_claimId);
        }

        // Reward majority jurors from the platform treasury
        if (_majorityVoters.length > 0 && juryRewardTotal > 0) {
            uint256 perJuror = juryRewardTotal / _majorityVoters.length;
            for (uint256 i = 0; i < _majorityVoters.length; i++) {
                stakeManager.reward(_majorityVoters[i], perJuror, _claimRefId(_claimId, "jury-reward"));
            }
        }

        emit CourtRulingExecuted(_claimId, _claimCorrect, claimToDispute[_claimId], _majorityVoters);
    }

    // ─── UMA OOV3 Callbacks ─────────────────────────────────────

    /// @notice Called by OOV3 when an assertion is disputed (permissionless dispute path).
    /// Routes the dispute into the JurorCourt; the OOV3 disputer's bond is their skin in the game.
    /// @dev Must not revert or the OOV3 settlement flow would be blocked.
    function assertionDisputedCallback(bytes32 _assertionId) external {
        if (msg.sender != address(oov3)) return;
        uint256 claimId = assertionToClaim[_assertionId];
        Claim storage claim = claims[claimId];
        if (claimId == 0 || claim.status != ClaimStatus.ATTESTED) return;

        address disputer = oov3.getAssertion(_assertionId).disputer;

        // No challenger stake locked here — the disputer already risks their OOV3 bond.
        challenges[claimId] = Challenge({
            challenger: disputer,
            stakeAmount: 0,
            reason: "Disputed via UMA Optimistic Oracle",
            challengedAt: block.timestamp
        });

        try court.createDispute(claimId, claim.claimer, disputer) returns (uint256 disputeId) {
            claimToDispute[claimId] = disputeId;
            claim.status = ClaimStatus.CHALLENGED;
            emit ClaimChallenged(claimId, disputer, 0, disputeId, "Disputed via UMA Optimistic Oracle");
        } catch {
            // Not enough jurors yet — keep claim attested; dispute stays on OOV3.
        }
    }

    /// @notice Called by OOV3 when an assertion resolves. Happy-path payouts happen in
    /// settleClaim; if resolved false without a court dispute there is nothing to release
    /// (stakes remain locked until owner intervention or a late challenge).
    /// @dev Must not revert.
    function assertionResolvedCallback(bytes32 _assertionId, bool _assertedTruthfully) external {
        if (msg.sender != address(oov3)) return;
        _assertionId;
        _assertedTruthfully;
        // Intentionally minimal: settleClaim / court paths handle payouts.
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

    /// @notice Set the JurorCourt after deployment (two-way wiring with court.setClaimVerification)
    function setCourt(address _court) external onlyOwner {
        require(_court != address(0), "ClaimVerification: zero court");
        court = IJurorCourt(_court);
    }

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
            _challengeWindowDuration, _minContributorStake, _minVerifierStake, _minChallengerStake
        );
    }

    function setJuryRewardTotal(uint256 _juryRewardTotal) external onlyOwner {
        juryRewardTotal = _juryRewardTotal;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "ClaimVerification: zero address");
        owner = _newOwner;
    }

    // ─── Internal ───────────────────────────────────────────────

    function _claimRefId(uint256 claimId, string memory role) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(claimId, role));
    }

    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
