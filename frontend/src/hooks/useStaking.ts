"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { toast } from "sonner";
import { erc20Abi, stakeManagerAbi, jurorCourtAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/contracts";

/**
 * USDC staking hooks: approve, deposit, withdraw, juror registration.
 * Each write shows progress toasts and waits for the receipt.
 */
export function useStaking() {
  const { address } = useAccount();
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

  // Track the pending tx: success/error toast once confirmed
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

  /** Approve USDC for StakeManager (required before deposit) */
  const approve = useCallback(
    (amount: bigint) =>
      runTx(
        "Approve USDC",
        writeContractAsync({
          address: CONTRACTS.usdc,
          abi: erc20Abi,
          functionName: "approve",
          args: [CONTRACTS.stakeManager, amount],
        })
      ),
    [runTx, writeContractAsync]
  );

  /** Deposit approved USDC into StakeManager escrow */
  const deposit = useCallback(
    (amount: bigint) =>
      runTx(
        "Deposit USDC",
        writeContractAsync({
          address: CONTRACTS.stakeManager,
          abi: stakeManagerAbi,
          functionName: "deposit",
          args: [amount],
        })
      ),
    [runTx, writeContractAsync]
  );

  /** Withdraw available USDC from StakeManager escrow */
  const withdraw = useCallback(
    (amount: bigint) =>
      runTx(
        "Withdraw USDC",
        writeContractAsync({
          address: CONTRACTS.stakeManager,
          abi: stakeManagerAbi,
          functionName: "withdraw",
          args: [amount],
        })
      ),
    [runTx, writeContractAsync]
  );

  /** Register as a juror (locks stake from deposit balance) */
  const registerJuror = useCallback(
    (stake: bigint) =>
      runTx(
        "Register as juror",
        writeContractAsync({
          address: CONTRACTS.jurorCourt,
          abi: jurorCourtAbi,
          functionName: "registerJuror",
          args: [stake],
        })
      ),
    [runTx, writeContractAsync]
  );

  /** Deregister as a juror (releases stake) */
  const deregisterJuror = useCallback(
    () =>
      runTx(
        "Deregister juror",
        writeContractAsync({
          address: CONTRACTS.jurorCourt,
          abi: jurorCourtAbi,
          functionName: "deregisterJuror",
        })
      ),
    [runTx, writeContractAsync]
  );

  return {
    address,
    approve,
    deposit,
    withdraw,
    registerJuror,
    deregisterJuror,
    isConfirming,
    isConfirmed,
  };
}
