/// Minimal hand-written ABIs matching the deployed contracts (Foundry out/ artifacts).

export const claimVerificationAbi = [
  // Writes
  "function submitClaim(uint256 dataCenterId, uint8 factType, string factData, bytes32 proofHash) returns (uint256)",
  "function attestClaim(uint256 claimId)",
  "function challengeClaim(uint256 claimId, string reason)",
  "function settleClaim(uint256 claimId)",
  // Reads
  "function getClaim(uint256 claimId) view returns (tuple(uint256 id, uint256 dataCenterId, address claimer, uint8 factType, string factData, bytes32 proofHash, uint256 stakeAmount, uint8 status, uint256 submittedAt, uint256 challengeWindowEnd, bytes32 assertionId))",
  "function getAttestation(uint256 claimId) view returns (tuple(address verifier, uint256 stakeAmount, uint256 attestedAt))",
  "function getChallenge(uint256 claimId) view returns (tuple(address challenger, uint256 stakeAmount, string reason, uint256 challengedAt))",
  "function getUserClaims(address user) view returns (uint256[])",
  "function getDataCenterClaims(uint256 dataCenterId) view returns (uint256[])",
  "function getTotalClaims() view returns (uint256)",
  "function claimToDispute(uint256 claimId) view returns (uint256)",
  "function assertionToClaim(bytes32 assertionId) view returns (uint256)",
  "function isChallengeWindowOpen(uint256 claimId) view returns (bool)",
  "function nextClaimId() view returns (uint256)",
  "function challengeWindowDuration() view returns (uint256)",
  "function minContributorStake() view returns (uint256)",
  "function minVerifierStake() view returns (uint256)",
  "function minChallengerStake() view returns (uint256)",
  // Events
  "event ClaimSubmitted(uint256 indexed claimId, uint256 indexed dataCenterId, address indexed claimer, uint8 factType, uint256 stakeAmount)",
  "event ClaimAttested(uint256 indexed claimId, address indexed verifier, uint256 stakeAmount, bytes32 assertionId)",
  "event ClaimChallenged(uint256 indexed claimId, address indexed challenger, uint256 stakeAmount, uint256 disputeId, string reason)",
  "event ClaimFinalized(uint256 indexed claimId)",
  "event ClaimRejected(uint256 indexed claimId)",
] as const;

export const stakeManagerAbi = [
  // Writes
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  // Reads
  "function depositedBalances(address user) view returns (uint256)",
  "function lockedBalances(address user) view returns (uint256)",
  "function getAvailableBalance(address user) view returns (uint256)",
  "function getLockedBalance(address user) view returns (uint256)",
  "function totalDeposited() view returns (uint256)",
  // Events
  "event Deposited(address indexed user, uint256 amount)",
  "event Withdrawn(address indexed user, uint256 amount)",
] as const;

export const jurorCourtAbi = [
  // Writes
  "function registerJuror(uint256 stake)",
  "function deregisterJuror()",
  "function vote(uint256 disputeId, bool supportClaim)",
  "function resolve(uint256 disputeId)",
  // Reads
  "function getDispute(uint256 disputeId) view returns (tuple(uint256 id, uint256 claimId, address claimer, address challenger, uint8 status, uint256 votingDeadline, uint256 votesForClaim, uint256 votesAgainstClaim, bool claimCorrect))",
  "function getDrawnJurors(uint256 disputeId) view returns (address[])",
  "function hasVoted(uint256 disputeId, address juror) view returns (bool)",
  "function voteDirection(uint256 disputeId, address juror) view returns (bool)",
  "function isRegisteredJuror(address juror) view returns (bool)",
  "function getJurorCount() view returns (uint256)",
  "function jurors(address juror) view returns (uint256 stake, bool active, uint256 registeredAt, uint256 disputesVoted)",
  "function nextDisputeId() view returns (uint256)",
  "function minJurorStake() view returns (uint256)",
  "function jurySize() view returns (uint256)",
  "function votingWindow() view returns (uint256)",
  // Events
  "event DisputeCreated(uint256 indexed disputeId, uint256 indexed claimId, address indexed challenger, uint256 votingDeadline)",
  "event JurorsDrawn(uint256 indexed disputeId, address[] jurors)",
  "event VoteCast(uint256 indexed disputeId, address indexed juror, bool supportClaim)",
  "event DisputeResolved(uint256 indexed disputeId, bool claimCorrect, uint256 votesFor, uint256 votesAgainst)",
] as const;

export const erc20Abi = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
] as const;

export const dataCenterRegistryAbi = [
  "function getDataCenter(uint256 id) view returns (tuple(uint256 id, string name, int256 latitude, int256 longitude, string country, uint8 status, address owner, bool isActive, uint256 registeredAt, uint256 updatedAt))",
  "function getMeta(uint256 id) view returns (tuple(string region, uint8 ownerType, uint256 powerCapacityMW, uint256 sizeMW, string description))",
  "function getTotalRegistered() view returns (uint256)",
] as const;
