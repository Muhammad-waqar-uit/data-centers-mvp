"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShieldCheck, Eye, ThumbsUp, ThumbsDown, Clock } from "lucide-react";
import { claimsApi } from "@/lib/api";
import type { Claim } from "@/types";

export default function VerifyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadPendingClaims();
  }, []);

  async function loadPendingClaims() {
    try {
      const res = await claimsApi.pending();
      setClaims(res.data.data || res.data);
    } catch {
      setClaims([
        { id: "c4", dataCenterId: "1", claimerId: "u5", factType: "INTERCONNECTION_QUEUE", factData: "In PJM interconnection queue, position #45, expected completion 2026", proofDocumentUrl: null, proofHash: null, stakeAmount: 40, status: "pending", txHash: null, onChainClaimId: null, verifierId: null, verifierWallet: null, verifierStakeAmount: null, attestedAt: null, challengeWindowEnd: null, challengerId: null, challengeReason: null, challengedAt: null, createdAt: "2024-03-20" },
        { id: "c5", dataCenterId: "2", claimerId: "u6", factType: "CONSTRUCTION_STATUS", factData: "Phase 2 construction 60% complete, expected online Q4 2024", proofDocumentUrl: null, proofHash: null, stakeAmount: 35, status: "pending", txHash: null, onChainClaimId: null, verifierId: null, verifierWallet: null, verifierStakeAmount: null, attestedAt: null, challengeWindowEnd: null, challengerId: null, challengeReason: null, challengedAt: null, createdAt: "2024-03-22" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAttest() {
    if (!selectedClaim) return;
    setActionLoading(true);
    try {
      await claimsApi.attest(selectedClaim.id);
      setClaims((prev) => prev.filter((c) => c.id !== selectedClaim.id));
      setSelectedClaim(null);
    } catch (err) {
      console.error("Failed to attest:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleChallenge() {
    if (!selectedClaim) return;
    setActionLoading(true);
    try {
      await claimsApi.challenge(selectedClaim.id, { reason: "Data appears inaccurate based on public records" });
      setClaims((prev) => prev.filter((c) => c.id !== selectedClaim.id));
      setSelectedClaim(null);
    } catch (err) {
      console.error("Failed to challenge:", err);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Verify Claims</h1>
        <p className="text-sm text-muted-foreground">Review pending claims and attest or challenge them. Attesting requires staking USDC.</p>
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
                    <span className="text-xs text-muted-foreground">Stake: ${claim.stakeAmount}</span>
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
      <Dialog open={!!selectedClaim} onOpenChange={() => setSelectedClaim(null)}>
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
                  <p className="font-medium">${selectedClaim.stakeAmount}</p>
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
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="destructive"
              onClick={handleChallenge}
              disabled={actionLoading}
              className="gap-2"
            >
              <ThumbsDown className="h-4 w-4" /> Challenge
            </Button>
            <Button
              onClick={handleAttest}
              disabled={actionLoading}
              className="gap-2"
            >
              <ThumbsUp className="h-4 w-4" /> Attest (Stake $200)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
