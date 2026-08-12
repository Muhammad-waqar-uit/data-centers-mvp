"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import Link from "next/link";
import { stakeManagerAbi } from "@/lib/abis";
import { CONTRACTS, formatUsdc } from "@/lib/contracts";

export function WalletWidget() {
  const { address, isConnected } = useAccount();

  const { data: available } = useReadContract({
    address: CONTRACTS.stakeManager,
    abi: stakeManagerAbi,
    functionName: "getAvailableBalance",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!CONTRACTS.stakeManager, refetchInterval: 10_000 },
  });

  return (
    <div className="flex items-center gap-3">
      {isConnected && available !== undefined && (
        <Link
          href="/stake"
          className="hidden sm:flex items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          title="Available USDC deposit"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {formatUsdc(available as bigint)} USDC
        </Link>
      )}
      <ConnectButton showBalance={false} chainStatus="icon" accountStatus="full" />
    </div>
  );
}
