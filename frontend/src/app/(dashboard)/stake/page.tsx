"use client";

import { useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Gavel, Loader2 } from "lucide-react";
import { erc20Abi, stakeManagerAbi, jurorCourtAbi } from "@/lib/abis";
import { CONTRACTS, formatUsdc, parseUsdc } from "@/lib/contracts";
import { useStaking } from "@/hooks/useStaking";

export default function StakePage() {
  const { address, isConnected } = useAccount();
  const { approve, deposit, withdraw, registerJuror, deregisterJuror, isConfirming } =
    useStaking();

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Wallet USDC balance + allowance
  const { data: walletUsdc, refetch: refetchWallet } = useReadContract({
    address: CONTRACTS.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACTS.stakeManager] : undefined,
    query: { enabled: !!address },
  });

  // StakeManager balances
  const { data: balances, refetch: refetchBalances } = useReadContracts({
    contracts: address
      ? [
          {
            address: CONTRACTS.stakeManager,
            abi: stakeManagerAbi,
            functionName: "getAvailableBalance",
            args: [address],
          },
          {
            address: CONTRACTS.stakeManager,
            abi: stakeManagerAbi,
            functionName: "getLockedBalance",
            args: [address],
          },
        ]
      : [],
    query: { enabled: !!address, refetchInterval: 15_000 },
  });
  const available = balances?.[0]?.result as bigint | undefined;
  const locked = balances?.[1]?.result as bigint | undefined;

  // Juror status
  const { data: jurorInfo, refetch: refetchJuror } = useReadContract({
    address: CONTRACTS.jurorCourt,
    abi: jurorCourtAbi,
    functionName: "jurors",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });
  const { data: minJurorStake } = useReadContract({
    address: CONTRACTS.jurorCourt,
    abi: jurorCourtAbi,
    functionName: "minJurorStake",
    query: { enabled: !!CONTRACTS.jurorCourt },
  });

  const isJuror = jurorInfo ? (jurorInfo as { active: boolean }).active : false;

  async function handleApproveAndDeposit() {
    if (!depositAmount) return;
    setBusy("deposit");
    try {
      const amount = parseUsdc(depositAmount);
      if ((allowance as bigint | undefined) === undefined || (allowance as bigint) < amount) {
        await approve(amount);
        await refetchAllowance();
      }
      await deposit(amount);
      setDepositAmount("");
      refetchWallet();
      refetchBalances();
    } catch {
      // toast already shown by hook
    } finally {
      setBusy(null);
    }
  }

  async function handleWithdraw() {
    if (!withdrawAmount) return;
    setBusy("withdraw");
    try {
      await withdraw(parseUsdc(withdrawAmount));
      setWithdrawAmount("");
      refetchWallet();
      refetchBalances();
    } catch {
      // toast already shown by hook
    } finally {
      setBusy(null);
    }
  }

  async function handleRegisterJuror() {
    setBusy("juror");
    try {
      await registerJuror((minJurorStake as bigint) || 100_000_000n);
      refetchJuror();
      refetchBalances();
    } catch {
      // toast already shown by hook
    } finally {
      setBusy(null);
    }
  }

  async function handleDeregisterJuror() {
    setBusy("juror");
    try {
      await deregisterJuror();
      refetchJuror();
      refetchBalances();
    } catch {
      // toast already shown by hook
    } finally {
      setBusy(null);
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Wallet className="h-12 w-12 text-muted-foreground/50" />
        <h1 className="mt-4 text-xl font-semibold">Stake USDC</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Connect your wallet to deposit USDC into the stake escrow. Stakes power
          claims, attestations, challenges, and juror registration.
        </p>
        <div className="mt-6">
          <ConnectButton />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Stake</h1>
        <p className="text-sm text-muted-foreground">
          Manage your USDC escrow balance and juror registration
        </p>
      </div>

      {/* Balance overview */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        {[
          { label: "Wallet USDC", value: walletUsdc as bigint | undefined },
          { label: "Available Deposit", value: available },
          { label: "Locked in Stakes", value: locked },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold">
                  {item.value === undefined ? "—" : formatUsdc(item.value)}
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">USDC</span>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Deposit */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Deposit</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Approve and deposit USDC into the stake escrow. Required for submitting,
              attesting, or challenging claims.
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Amount (USDC)"
                type="number"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <Button
                onClick={handleApproveAndDeposit}
                disabled={busy !== null || isConfirming || !depositAmount}
                className="gap-2 min-w-32"
              >
                {(busy === "deposit" || isConfirming) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Deposit
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Withdraw */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Withdraw</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Withdraw available (unlocked) USDC back to your wallet.
            </p>
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Amount (USDC)"
                type="number"
                min="0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={handleWithdraw}
                disabled={busy !== null || isConfirming || !withdrawAmount}
                className="gap-2 min-w-32"
              >
                {(busy === "withdraw" || isConfirming) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Juror registration */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Juror Program</h2>
              </div>
              {isJuror && <Badge variant="success">Active Juror</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
              Register as a juror to be randomly drawn into dispute panels. Jurors vote on
              challenged claims; majority voters earn rewards, minority voters are slashed
              50% of their juror stake. Minimum stake:{" "}
              {minJurorStake !== undefined ? formatUsdc(minJurorStake as bigint) : "100"} USDC
              (locked from your deposit).
            </p>
            <div className="mt-4">
              {isJuror ? (
                <Button
                  variant="outline"
                  onClick={handleDeregisterJuror}
                  disabled={busy !== null || isConfirming}
                  className="gap-2"
                >
                  {busy === "juror" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Deregister & Release Stake
                </Button>
              ) : (
                <Button
                  onClick={handleRegisterJuror}
                  disabled={busy !== null || isConfirming}
                  className="gap-2"
                >
                  {busy === "juror" && <Loader2 className="h-4 w-4 animate-spin" />}
                  Register as Juror
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
