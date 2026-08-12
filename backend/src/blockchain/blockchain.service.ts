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

    if (claimAddr) {
      const claimABI = [
        'function submitClaim(uint256 dataCenterId, uint8 factType, string factData, bytes32 proofHash) external returns (uint256)',
        'function attestClaim(uint256 claimId) external',
        'function challengeClaim(uint256 claimId, string reason) external',
        'function finalizeClaim(uint256 claimId) external',
        'function resolveDispute(uint256 claimId, bool claimCorrect) external',
        'function getClaim(uint256 claimId) external view returns (tuple(uint256 id, uint256 dataCenterId, address claimer, uint8 factType, string factData, bytes32 proofHash, uint256 stakeAmount, uint8 status, uint256 submittedAt, uint256 challengeWindowEnd))',
        'function getUserClaims(address user) external view returns (uint256[])',
        'function totalClaims() external view returns (uint256)',
        'event ClaimSubmitted(uint256 indexed claimId, uint256 indexed dataCenterId, address indexed claimer, uint8 factType, uint256 stakeAmount)',
        'event ClaimAttested(uint256 indexed claimId, address indexed verifier, uint256 stakeAmount)',
        'event ClaimChallenged(uint256 indexed claimId, address indexed challenger, uint256 stakeAmount, string reason)',
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
}
