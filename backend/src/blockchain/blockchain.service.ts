import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private claimVerificationContract: ethers.Contract;
  private registryContract: ethers.Contract;
  private jurorCourtContract: ethers.Contract;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.configService.get('BLOCKCHAIN_RPC_URL');
    if (!rpcUrl) {
      this.logger.warn('BLOCKCHAIN_RPC_URL not set — blockchain features disabled');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Set up signer for write operations
    const privateKey = this.configService.get('DEPLOYER_PRIVATE_KEY');
    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
      this.logger.log(`Blockchain signer: ${this.signer.address}`);
    }

    const claimAddr = this.configService.get('CLAIM_VERIFICATION_CONTRACT_ADDRESS');
    const registryAddr = this.configService.get('DATA_CENTER_REGISTRY_CONTRACT_ADDRESS');
    const courtAddr = this.configService.get('JUROR_COURT_CONTRACT_ADDRESS');

    if (claimAddr) {
      const claimABI = [
        'function submitClaim(uint256 dataCenterId, uint8 factType, string factData, bytes32 proofHash) external returns (uint256)',
        'function attestClaim(uint256 claimId) external',
        'function challengeClaim(uint256 claimId, string reason) external',
        'function settleClaim(uint256 claimId) external',
        'function executeCourtRuling(uint256 claimId, bool claimCorrect, address[] majorityVoters) external',
        'function getClaim(uint256 claimId) external view returns (tuple(uint256 id, uint256 dataCenterId, address claimer, uint8 factType, string factData, bytes32 proofHash, uint256 stakeAmount, uint8 status, uint256 submittedAt, uint256 challengeWindowEnd, bytes32 assertionId))',
        'function getAttestation(uint256 claimId) external view returns (tuple(address verifier, uint256 stakeAmount, uint256 attestedAt))',
        'function getUserClaims(address user) external view returns (uint256[])',
        'function getTotalClaims() external view returns (uint256)',
        'function isChallengeWindowOpen(uint256 claimId) external view returns (bool)',
        'function claimToDispute(uint256 claimId) external view returns (uint256)',
        'event ClaimSubmitted(uint256 indexed claimId, uint256 indexed dataCenterId, address indexed claimer, uint8 factType, uint256 stakeAmount)',
        'event ClaimAttested(uint256 indexed claimId, address indexed verifier, uint256 stakeAmount, bytes32 assertionId)',
        'event ClaimChallenged(uint256 indexed claimId, address indexed challenger, uint256 stakeAmount, uint256 disputeId, string reason)',
        'event ClaimFinalized(uint256 indexed claimId)',
        'event ClaimRejected(uint256 indexed claimId)',
      ];
      this.claimVerificationContract = new ethers.Contract(
        claimAddr,
        claimABI,
        this.signer || this.provider,
      );
    }

    if (registryAddr) {
      const registryABI = [
        // Core registration (6 params)
        'function registerDataCenter(string name, int256 latitude, int256 longitude, string country, uint8 status, address ownerAddress) external returns (uint256)',
        // Extended metadata
        'function setMeta(uint256 id, string region, uint8 ownerType, uint256 powerCapacityMW, uint256 sizeMW, string description) external',
        // Updates
        'function updateStatus(uint256 id, uint8 newStatus) external',
        'function deactivate(uint256 id) external',
        // Views
        'function getDataCenter(uint256 id) external view returns (tuple(uint256 id, string name, int256 latitude, int256 longitude, string country, uint8 status, address owner, bool isActive, uint256 registeredAt, uint256 updatedAt))',
        'function getMeta(uint256 id) external view returns (tuple(string region, uint8 ownerType, uint256 powerCapacityMW, uint256 sizeMW, string description))',
        'function getDataCentersByOwner(address ownerAddress) external view returns (uint256[])',
        'function getTotalRegistered() external view returns (uint256)',
        // Access control
        'function addRegistrar(address registrar) external',
        'function removeRegistrar(address registrar) external',
      ];
      this.registryContract = new ethers.Contract(
        registryAddr,
        registryABI,
        this.signer || this.provider,
      );
    }

    if (courtAddr) {
      const courtABI = [
        'function registerJuror(uint256 stake) external',
        'function vote(uint256 disputeId, bool supportClaim) external',
        'function resolve(uint256 disputeId) external',
        'function getDispute(uint256 disputeId) external view returns (tuple(uint256 id, uint256 claimId, address claimer, address challenger, uint8 status, uint256 votingDeadline, uint256 votesForClaim, uint256 votesAgainstClaim, bool claimCorrect))',
        'function getDrawnJurors(uint256 disputeId) external view returns (address[])',
        'function hasVoted(uint256 disputeId, address juror) external view returns (bool)',
        'function isRegisteredJuror(address juror) external view returns (bool)',
        'function getJurorCount() external view returns (uint256)',
        'function nextDisputeId() external view returns (uint256)',
        'event DisputeCreated(uint256 indexed disputeId, uint256 indexed claimId, address indexed challenger, uint256 votingDeadline)',
        'event JurorsDrawn(uint256 indexed disputeId, address[] jurors)',
        'event VoteCast(uint256 indexed disputeId, address indexed juror, bool supportClaim)',
        'event DisputeResolved(uint256 indexed disputeId, bool claimCorrect, uint256 votesFor, uint256 votesAgainst)',
      ];
      this.jurorCourtContract = new ethers.Contract(
        courtAddr,
        courtABI,
        this.signer || this.provider,
      );
    }

    this.logger.log('Blockchain service initialized');
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getSigner(): ethers.Wallet {
    return this.signer;
  }

  getClaimVerificationContract(): ethers.Contract {
    return this.claimVerificationContract;
  }

  getRegistryContract(): ethers.Contract {
    return this.registryContract;
  }

  getJurorCourtContract(): ethers.Contract {
    return this.jurorCourtContract;
  }

  async getOnChainClaim(claimId: number) {
    if (!this.claimVerificationContract) return null;
    return this.claimVerificationContract.getClaim(claimId);
  }

  async getOnChainDataCenter(dcId: number) {
    if (!this.registryContract) return null;
    return this.registryContract.getDataCenter(dcId);
  }

  async getOnChainDataCenterMeta(dcId: number) {
    if (!this.registryContract) return null;
    return this.registryContract.getMeta(dcId);
  }

  async getTotalRegisteredDataCenters(): Promise<number> {
    if (!this.registryContract) return 0;
    const total = await this.registryContract.getTotalRegistered();
    return Number(total);
  }

  async getOnChainDispute(disputeId: number) {
    if (!this.jurorCourtContract) return null;
    return this.jurorCourtContract.getDispute(disputeId);
  }

  async getOnChainDisputeJurors(disputeId: number): Promise<string[]> {
    if (!this.jurorCourtContract) return [];
    return this.jurorCourtContract.getDrawnJurors(disputeId);
  }

  async getJurorCount(): Promise<number> {
    if (!this.jurorCourtContract) return 0;
    const count = await this.jurorCourtContract.getJurorCount();
    return Number(count);
  }
}
