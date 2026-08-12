"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShieldCheck, Eye, ThumbsUp, ThumbsDown, Loader2, Gavel } from "lucide-react";
import { claimsApi } from "@/lib/api";
import { useClaims } from "@/hooks/useClaims";
import { formatUsdc } from "@/lib/contracts";
import type { Claim } from "@/types";

export default function VerifyClaimsPage() {
  const { address, isConnected } = useAccount();
  const { attestClaim, challengeClaim, isConfirming } = useClaims();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [challengeMode, setChallengeMode] = useState(false);
  const [challengeReason, setChallengeReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadPendingClaims();
  }, []);

  async function loadPendingClaims() {
    setLoading(true);
    try {
      const res = await claimsApi.pending();
      setClaims(res.data.data || res.data);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAttest() {
    if (!selectedClaim?.onChainClaimId) {
      toast.error("This claim has no on-chain record yet");
      return;
    }
    setActionLoading(true);
    try {
      await attestClaim(BigInt(selectedClaim.onChainClaimId));
      // Mirror to backend for indexing/profiles
      try {
        await claimsApi.attest(selectedClaim.id, { verifierWallet: address });
      } catch {
        /* mirror is best-effort */
      }
      toast.success("Claim attested — UMA assertion created");
      setClaims((prev) => prev.filter((c) => c.id !== selectedClaim.id));
      setSelectedClaim(null);
    } catch {
      // toast handled by hook
    } finally {
      setActionLoading(false);
    }
  }

  async function handleChallenge() {
    if (!selectedClaim?.onChainClaimId) {
      toast.error("This claim has no on-chain record yet");
      return;
    }
    if (!challengeReason.trim()) {
      toast.error("Please provide a challenge reason");
      return;
    }
    setActionLoading(true);
    try {
      await challengeClaim(BigInt(selectedClaim.onChainClaimId), challengeReason);
      try {
        await claimsApi.challenge(selectedClaim.id, {
          reason: challengeReason,
          challengerWallet: address,
        });
      } catch {
        /* mirror is best-effort */
      }
      toast.success("Claim challenged — dispute sent to the jury");
      setClaims((prev) => prev.filter((c) => c.id !== selectedClaim.id));
      setSelectedClaim(null);
      setChallengeMode(false);
      setChallengeReason("");
    } catch {
      // toast handled by hook
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verify Claims</h1>
          <p className="text-sm text-muted-foreground">
            Attest claims on-chain (locks verifier stake + UMA assertion) or challenge them to a jury.
          </p>
        </div>
        {!isConnected && <ConnectButton />}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : claims.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldCheck className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No pending claims to review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim, i) => (
            <motion.div key={claim.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="transition-all hover:border-primary/30">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="warning">Pending Review</Badge>
                      <span className="ml-2 text-sm font-medium">{claim.factType.replace(/_/g, " ")}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{claim.factData}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Stake: {formatUsdc(BigInt(Math.round((claim.stakeAmount || 0) * 1e6)))} USDC
                      {claim.onChainClaimId ? ` · On-chain #${claim.onChainClaimId}` : " · not on-chain yet"}
                    </span>
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setSelectedClaim(claim)}>
                      <Eye className="h-3.5 w-3.5" /> Review
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog
        open={!!selectedClaim}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedClaim(null);
            setChallengeMode(false);
            setChallengeReason("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Claim</DialogTitle>
            <DialogDescription>
              Verify the accuracy of this claim before attesting or challenging.
            </DialogDescription>
          </DialogHeader>

          {selectedClaim && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Fact Type</p>
                <p className="font-medium">{selectedClaim.factType.replace(/_/g, " ")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Claim Data</p>
                <p className="text-sm">{selectedClaim.factData}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Contributor Stake</p>
                  <p className="font-medium">
                    {formatUsdc(BigInt(Math.round((selectedClaim.stakeAmount || 0) * 1e6)))} USDC
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Submitted</p>
                  <p className="font-medium">{new Date(selectedClaim.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              {selectedClaim.proofDocumentUrl && (
                <div>
                  <p className="text-xs text-muted-foreground">Proof Document</p>
                  <a href={selectedClaim.proofDocumentUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                    View Document
                  </a>
                </div>
              )}

              {challengeMode && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Challenge Reason</p>
                  <Textarea
                    placeholder="Explain why this claim is inaccurate..."
                    value={challengeReason}
                    onChange={(e) => setChallengeReason(e.target.value)}
                    rows={3}
                  />
                  <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                    <Gavel className="h-3 w-3" /> Challenging locks 300 USDC and routes the dispute to a random jury.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {!isConnected ? (
              <ConnectButton />
            ) : challengeMode ? (
              <>
                <Button variant="ghost" onClick={() => setChallengeMode(false)} disabled={actionLoading}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleChallenge}
                  disabled={actionLoading || isConfirming}
                  className="gap-2"
                >
                  {(actionLoading || isConfirming) && <Loader2 className="h-4 w-4 animate-spin" />}
                  <ThumbsDown className="h-4 w-4" /> Confirm Challenge
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  onClick={() => setChallengeMode(true)}
                  disabled={actionLoading}
                  className="gap-2"
                >
                  <ThumbsDown className="h-4 w-4" /> Challenge
                </Button>
                <Button
                  onClick={handleAttest}
                  disabled={actionLoading || isConfirming}
                  className="gap-2"
                >
                  {(actionLoading || isConfirming) && <Loader2 className="h-4 w-4 animate-spin" />}
                  <ThumbsUp className="h-4 w-4" /> Attest (Stake 200 USDC)
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
