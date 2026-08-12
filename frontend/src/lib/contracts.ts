/// Contract addresses — populated from NEXT_PUBLIC_* env vars after deployment.

export const CONTRACTS = {
  claimVerification: process.env
    .NEXT_PUBLIC_CLAIM_VERIFICATION_CONTRACT as `0x${string}`,
  dataCenterRegistry: process.env
    .NEXT_PUBLIC_DATA_CENTER_REGISTRY_CONTRACT as `0x${string}`,
  stakeManager: process.env
    .NEXT_PUBLIC_STAKE_MANAGER_CONTRACT as `0x${string}`,
  jurorCourt: process.env
    .NEXT_PUBLIC_JUROR_COURT_CONTRACT as `0x${string}`,
  usdc: process.env.NEXT_PUBLIC_USDC_CONTRACT as `0x${string}`,
};

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111);

/** True once all core contract addresses are configured */
export function contractsConfigured(): boolean {
  return Boolean(
    CONTRACTS.claimVerification &&
      CONTRACTS.stakeManager &&
      CONTRACTS.jurorCourt &&
      CONTRACTS.usdc
  );
}

// ─── On-chain parameter helpers ───────────────────────

/** Format 6-decimal USDC units to a human-readable string */
export function formatUsdc(amount: bigint | undefined | null): string {
  if (amount === undefined || amount === null) return "0";
  const whole = amount / 1_000_000n;
  const frac = amount % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").slice(0, 2);
  return frac === 0n ? whole.toString() : `${whole}.${fracStr}`;
}

/** Parse a human-readable USDC amount to 6-decimal units */
export function parseUsdc(amount: string): bigint {
  const [whole, frac = ""] = amount.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded);
}

export const CLAIM_STATUS = [
  "Pending",
  "Attested",
  "Challenged",
  "Finalized",
  "Rejected",
] as const;

export const FACT_TYPES = [
  "Interconnection Queue",
  "Ownership",
  "Grid Status",
  "Power Capacity",
  "Construction Status",
  "Transaction History",
  "Land Use",
  "Water Cooling",
  "Fiber Connectivity",
  "Other",
] as const;
