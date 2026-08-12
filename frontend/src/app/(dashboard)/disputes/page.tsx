"use client";

import { useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gavel, Clock, Users, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { jurorCourtAbi } from "@/lib/abis";
import { CONTRACTS } from "@/lib/contracts";
import { useClaims } from "@/hooks/useClaims";
import { formatAddress } from "@/lib/utils";

type OnChainDispute = {
  id: bigint;
  claimId: bigint;
  claimer: `0x${string}`;
  challenger: `0x${string}`;
  status: number; // 0=NONE 1=ACTIVE 2=RESOLVED
  votingDeadline: bigint;
  votesForClaim: bigint;
  votesAgainstClaim: bigint;
  claimCorrect: boolean;
};

export default function DisputesPage() {
  const { address, isConnected } = useAccount();
  const { vote, resolveDispute, isConfirming } = useClaims();
  const [busy, setBusy] = useState<string | null>(null);

  const courtEnabled = Boolean(CONTRACTS.jurorCourt);

  // Total disputes created (ids are 1..nextDisputeId-1)
  const { data: nextDisputeId } = useReadContract({
    address: CONTRACTS.jurorCourt,
    abi: jurorCourtAbi,
    functionName: "nextDisputeId",
    query: { enabled: courtEnabled, refetchInterval: 10_000 },
  });
  const disputeCount = Number(nextDisputeId ?? 1n) - 1;
  const disputeIds = Array.from({ length: disputeCount }, (_, i) => BigInt(i + 1));

  // Core dispute data + drawn jurors (+ own vote status) per dispute
  const { data: coreResults, refetch } = useReadContracts({
    contracts: disputeIds.flatMap((id) => [
      {
        address: CONTRACTS.jurorCourt,
        abi: jurorCourtAbi,
        functionName: "getDispute",
        args: [id],
      },
      {
        address: CONTRACTS.jurorCourt,
        abi: jurorCourtAbi,
        functionName: "getDrawnJurors",
        args: [id],
      },
      ...(address
        ? [
            {
              address: CONTRACTS.jurorCourt,
              abi: jurorCourtAbi,
              functionName: "hasVoted",
              args: [id, address],
            },
          ]
        : []),
    ]),
    query: { enabled: courtEnabled && disputeIds.length > 0, refetchInterval: 10_000 },
  });

  const step = address ? 3 : 2;
  const disputes: { dispute: OnChainDispute; jurors: `0x${string}`[]; iHaveVoted: boolean }[] =
    disputeIds.map((id, i) => ({
      dispute: (coreResults?.[i * step]?.result ?? {
        id,
        claimId: 0n,
        claimer: "0x0" as `0x${string}`,
        challenger: "0x0" as `0x${string}`,
        status: 0,
        votingDeadline: 0n,
        votesForClaim: 0n,
        votesAgainstClaim: 0n,
        claimCorrect: false,
      }) as OnChainDispute,
      jurors: ((coreResults?.[i * step + 1]?.result as `0x${string}`[] | undefined) ?? []) as `0x${string}`[],
      iHaveVoted: Boolean(coreResults?.[i * step + 2]?.result),
    }));

  // Per-juror vote reads for the drawn panels
  const jurorVoteContracts = disputes.flatMap((d) =>
    d.jurors.flatMap((juror) => [
      {
        address: CONTRACTS.jurorCourt,
        abi: jurorCourtAbi,
        functionName: "hasVoted",
        args: [d.dispute.id, juror],
      },
      {
        address: CONTRACTS.jurorCourt,
        abi: jurorCourtAbi,
        functionName: "voteDirection",
        args: [d.dispute.id, juror],
      },
    ])
  );
  const { data: jurorVoteResults } = useReadContracts({
    contracts: jurorVoteContracts,
    query: { enabled: jurorVoteContracts.length > 0, refetchInterval: 10_000 },
  });

  function getJurorVotes(disputeIdx: number, jurorCount: number) {
    // 2 reads per juror, laid out in the same flat order as jurorVoteContracts
    const base = disputes.slice(0, disputeIdx).reduce((acc, d) => acc + d.jurors.length * 2, 0);
    return Array.from({ length: jurorCount }, (_, j) => ({
      voted: Boolean(jurorVoteResults?.[base + j * 2]?.result),
      direction: Boolean(jurorVoteResults?.[base + j * 2 + 1]?.result),
    }));
  }

  async function handleVote(disputeId: bigint, supportClaim: boolean) {
    setBusy(`vote-${disputeId}`);
    try {
      await vote(disputeId, supportClaim);
      refetch();
    } catch {
      // toast already shown by hook
    } finally {
      setBusy(null);
    }
  }

  async function handleResolve(disputeId: bigint) {
    setBusy(`resolve-${disputeId}`);
    try {
      await resolveDispute(disputeId);
      refetch();
    } catch {
      // toast already shown by hook
    } finally {
      setBusy(null);
    }
  }

  if (!courtEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Gavel className="h-12 w-12 text-muted-foreground/50" />
        <h1 className="mt-4 text-xl font-semibold">Jury &amp; Disputes</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The JurorCourt contract address is not configured yet. Deploy the contracts and set
          NEXT_PUBLIC_JUROR_COURT_CONTRACT to enable this page.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jury &amp; Disputes</h1>
          <p className="text-sm text-muted-foreground">
            Challenged claims are decided by randomly drawn juror panels — majority rules
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {disputeCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Gavel className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">
            No disputes yet. Disputes appear here when an attested claim is challenged.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map(({ dispute: d, jurors, iHaveVoted }, i) => {
            const isActive = d.status === 1;
            const isResolved = d.status === 2;
            const now = BigInt(Math.floor(Date.now() / 1000));
            const votingClosed = d.votingDeadline > 0n && now >= d.votingDeadline;
            const iAmJuror = Boolean(address && jurors.some((j) => j.toLowerCase() === address!.toLowerCase()));
            const jurorVotes = getJurorVotes(i, jurors.length);

            return (
              <motion.div
                key={d.id.toString()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="transition-all hover:border-primary/30">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                          <Gavel className="h-5 w-5 text-destructive" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Dispute #{d.id.toString()}</span>
                            {isActive && <Badge variant={votingClosed ? "warning" : "default"}>{votingClosed ? "Awaiting resolution" : "Voting open"}</Badge>}
                            {isResolved && (
                              <Badge variant={d.claimCorrect ? "success" : "danger"}>
                                {d.claimCorrect ? "Claim upheld" : "Claim rejected"}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            On-chain claim #{d.claimId.toString()} &middot; Challenger: {formatAddress(d.challenger)}
                          </p>
                        </div>
                      </div>
                      {isActive && !votingClosed && (
                        <span className="flex items-center gap-1 text-xs text-amber-400">
                          <Clock className="h-3 w-3" />
                          Voting ends {new Date(Number(d.votingDeadline) * 1000).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Jury panel */}
                    <div className="mt-4">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> Jury panel ({jurors.length})
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {jurors.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            No jurors drawn — panel draw requires registered jurors
                          </span>
                        )}
                        {jurors.map((juror, j) => {
                          const jv = jurorVotes[j];
                          const isMe = address && juror.toLowerCase() === address.toLowerCase();
                          return (
                            <span
                              key={juror}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                                isMe ? "border-primary/50 bg-primary/10" : "border-border bg-secondary/50"
                              }`}
                            >
                              {isMe && <span className="font-semibold">You</span>}
                              <span className="font-mono">{formatAddress(juror)}</span>
                              {jv?.voted ? (
                                jv.direction ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-red-400" />
                                )
                              ) : (
                                <Clock className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Vote tally */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> For claim: {d.votesForClaim.toString()}
                      </span>
                      <span className="flex items-center gap-1 text-red-400">
                        <XCircle className="h-3 w-3" /> Against claim: {d.votesAgainstClaim.toString()}
                      </span>
                    </div>

                    {/* Actions */}
                    {isActive && !votingClosed && iAmJuror && !iHaveVoted && isConnected && (
                      <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
                        <p className="text-xs font-medium mb-2">
                          You were drawn into this panel — review the claim evidence and cast your vote:
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleVote(d.id, true)}
                            disabled={busy !== null || isConfirming}
                            className="gap-2"
                          >
                            {(busy === `vote-${d.id}` || isConfirming) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Claim is correct
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVote(d.id, false)}
                            disabled={busy !== null || isConfirming}
                            className="gap-2"
                          >
                            Claim is incorrect
                          </Button>
                        </div>
                      </div>
                    )}
                    {isActive && !votingClosed && iAmJuror && iHaveVoted && (
                      <p className="mt-3 text-xs text-emerald-400">Your vote has been recorded.</p>
                    )}
                    {isActive && votingClosed && (
                      <div className="mt-4">
                        <Button
                          size="sm"
                          onClick={() => handleResolve(d.id)}
                          disabled={busy !== null || isConfirming}
                          className="gap-2"
                        >
                          {(busy === `resolve-${d.id}` || isConfirming) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Resolve &amp; Execute Ruling
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
