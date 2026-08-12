"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Gavel, Clock, AlertTriangle } from "lucide-react";
import { disputesApi } from "@/lib/api";
import { formatAddress } from "@/lib/utils";
import type { Dispute } from "@/types";

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDisputes();
  }, []);

  async function loadDisputes() {
    try {
      const res = await disputesApi.list();
      setDisputes(res.data.data || res.data);
    } catch {
      setDisputes([
        { id: "d1", claimId: "c2", challengerId: "u7", challengerWallet: "0x789...", challengeStake: 500, reason: "Public records show different ownership structure", resolution: "pending", juryDecision: null, resolvedBy: null, resolvedAt: null, createdAt: "2024-03-10" },
        { id: "d2", claimId: "c6", challengerId: "u8", challengerWallet: "0xabc...", challengeStake: 300, reason: "Grid connection status has been updated by utility company", resolution: "claim_correct", juryDecision: "Claim verified as accurate", resolvedBy: "jury", resolvedAt: "2024-03-15", createdAt: "2024-03-05" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const resolutionVariant = (resolution: string) => {
    switch (resolution) {
      case "pending": return "warning" as const;
      case "claim_correct": return "success" as const;
      case "claim_incorrect": return "danger" as const;
      default: return "default" as const;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Disputes</h1>
        <p className="text-sm text-muted-foreground">Track active and resolved disputes on claimed data</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Gavel className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No disputes found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute, i) => (
            <motion.div key={dispute.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="transition-all hover:border-primary/30">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                        <Gavel className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Dispute #{dispute.id.slice(0, 6)}</span>
                          <Badge variant={resolutionVariant(dispute.resolution)}>
                            {dispute.resolution.replace("_", " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Claim: {dispute.claimId.slice(0, 8)} &middot; Challenger: {formatAddress(dispute.challengerWallet || "0x0")}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(dispute.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {dispute.reason && (
                    <div className="mt-3 rounded-lg bg-secondary/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Challenge Reason</p>
                      <p className="text-sm">{dispute.reason}</p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Challenge Stake: ${dispute.challengeStake}
                    </span>
                    {dispute.resolvedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Resolved {new Date(dispute.resolvedAt).toLocaleDateString()}
                      </span>
                    )}
                    {dispute.resolution === "pending" && (
                      <span className="flex items-center gap-1 text-amber-400">
                        <Clock className="h-3 w-3" /> Awaiting jury decision
                      </span>
                    )}
                  </div>

                  {dispute.juryDecision && (
                    <div className="mt-3 rounded-lg border border-border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Jury Decision</p>
                      <p className="text-sm">{dispute.juryDecision}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
