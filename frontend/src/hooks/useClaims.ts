"use client";

import { useState, useCallback } from "react";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { toast } from "sonner";
import { claimVerificationAbi, jurorCourtAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/contracts";

/**
 * Claim lifecycle transaction hooks: submit, attest, challenge, settle,
 * plus juror voting and dispute resolution.
 */
export function useClaims() {
  const { writeContractAsync } = useWriteContract();
  const [pendingTx, setPendingTx] = useState<`0x${string}` | undefined>();

  const runTx = useCallback(
    async (label: string, tx: Promise<`0x${string}`>) => {
      const toastId = toast.loading(`${label}: waiting for wallet...`);
      try {
        const hash = await tx;
        setPendingTx(hash);
        toast.loading(`${label}: confirming on-chain...`, { id: toastId });
        return hash;
      } catch (err) {
        toast.error(`${label} failed`, {
          id: toastId,
          description: err instanceof Error ? err.message.split("\n")[0] : String(err),
        });
        throw err;
      }
    },
    []
  );

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: pendingTx,
      query: { enabled: !!pendingTx },
      onSettled: (
        receipt: { status?: string } | undefined | null,
        error: Error | undefined | null
      ) => {
        if (error) {
          toast.error("Transaction failed", { description: error.message });
        } else if (receipt?.status === "success") {
          toast.success("Transaction confirmed");
        } else if (receipt) {
          toast.error("Transaction reverted on-chain");
        }
        setPendingTx(undefined);
      },
    });

  /** Submit a claim on-chain (locks contributor stake from deposit) */
  const submitClaim = useCallback(
    (dataCenterId: bigint, factType: number, factData: string, proofHash: `0x${string}`) =>
      runTx(
        "Submit claim",
        writeContractAsync({
          address: CONTRACTS.claimVerification,
          abi: claimVerificationAbi,
          functionName: "submitClaim",
          args: [dataCenterId, factType, factData, proofHash],
        })
      ),
    [runTx, writeContractAsync]
  );

  /** Attest a claim (locks verifier stake + asserts on UMA OOV3) */
  const attestClaim = useCallback(
    (claimId: bigint) =>
      runTx(
        "Attest claim",
        writeContractAsync({
          address: CONTRACTS.claimVerification,
          abi: claimVerificationAbi,
          functionName: "attestClaim",
          args: [claimId],
        })
      ),
    [runTx, writeContractAsync]
  );

  /** Challenge an attested claim (locks challenger stake, creates jury dispute) */
  const challengeClaim = useCallback(
    (claimId: bigint, reason: string) =>
      runTx(
        "Challenge claim",
        writeContractAsync({
          address: CONTRACTS.claimVerification,
          abi: claimVerificationAbi,
          functionName: "challengeClaim",
          args: [claimId, reason],
        })
      ),
    [runTx, writeContractAsync]
  );

  /** Settle an attested claim after the challenge window closes */
  const settleClaim = useCallback(
    (claimId: bigint) =>
      runTx(
        "Settle claim",
        writeContractAsync({
          address: CONTRACTS.claimVerification,
          abi: claimVerificationAbi,
          functionName: "settleClaim",
          args: [claimId],
        })
      ),
    [runTx, writeContractAsync]
  );

  /** Cast a juror vote on a dispute */
  const vote = useCallback(
    (disputeId: bigint, supportClaim: boolean) =>
      runTx(
        "Cast vote",
        writeContractAsync({
          address: CONTRACTS.jurorCourt,
          abi: jurorCourtAbi,
          functionName: "vote",
          args: [disputeId, supportClaim],
        })
      ),
    [runTx, writeContractAsync]
  );

  /** Resolve a dispute after the voting window (permissionless) */
  const resolveDispute = useCallback(
    (disputeId: bigint) =>
      runTx(
        "Resolve dispute",
        writeContractAsync({
          address: CONTRACTS.jurorCourt,
          abi: jurorCourtAbi,
          functionName: "resolve",
          args: [disputeId],
        })
      ),
    [runTx, writeContractAsync]
  );

  return {
    submitClaim,
    attestClaim,
    challengeClaim,
    settleClaim,
    vote,
    resolveDispute,
    isConfirming,
    isConfirmed,
  };
}
