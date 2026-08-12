export interface User {
  id: string;
  email: string;
  walletAddress: string | null;
  role: "contributor" | "verifier" | "admin";
  displayName: string | null;
  reputationScore: number;
  totalClaimsSubmitted: number;
  totalClaimsVerified: number;
  totalEarnings: number;
  avatarUrl: string | null;
  createdAt: string;
}

export interface DataCenter {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  region: string | null;
  city: string | null;
  status: "planned" | "under_construction" | "operating" | "stalled" | "decommissioned";
  ownerType: string;
  ownerName: string | null;
  powerCapacityMW: number | null;
  sizeMW: number | null;
  gridStatus: string | null;
  interconnectionQueueId: string | null;
  description: string | null;
  isPublic: boolean;
  imageUrl: string | null;
  onChainId: number | null;
  createdAt: string;
  claims?: Claim[];
}

export interface Claim {
  id: string;
  dataCenterId: string;
  claimerId: string;
  claimer?: User;
  dataCenter?: DataCenter;
  factType: string;
  factData: string;
  proofDocumentUrl: string | null;
  proofHash: string | null;
  stakeAmount: number;
  status: "pending" | "under_review" | "attested" | "challenged" | "finalized" | "rejected";
  txHash: string | null;
  onChainClaimId: number | null;
  verifierId: string | null;
  verifierWallet: string | null;
  verifierStakeAmount: number | null;
  attestedAt: string | null;
  challengeWindowEnd: string | null;
  challengerId: string | null;
  challengeReason: string | null;
  challengedAt: string | null;
  createdAt: string;
}

export interface Dispute {
  id: string;
  claimId: string;
  claim?: Claim;
  challengerId: string;
  challengerWallet: string | null;
  challengeStake: number;
  reason: string | null;
  resolution: "pending" | "claim_correct" | "claim_incorrect";
  juryDecision: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: string;
    name: string;
    country: string;
    region: string | null;
    city: string | null;
    status: string;
    ownerType: string;
    ownerName: string | null;
    powerCapacityMW: number | null;
    sizeMW: number | null;
  };
}

export interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}
