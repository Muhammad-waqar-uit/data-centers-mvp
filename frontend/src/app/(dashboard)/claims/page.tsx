"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, FileText, Clock, ExternalLink } from "lucide-react";
import { claimsApi } from "@/lib/api";
import { formatAddress } from "@/lib/utils";
import type { Claim } from "@/types";

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClaims();
  }, []);

  async function loadClaims() {
    try {
      const res = await claimsApi.my();
      setClaims(res.data.data || res.data);
    } catch {
      setClaims([
        { id: "c1", dataCenterId: "1", claimerId: "u1", factType: "GRID_STATUS", factData: "Connected to PJM Interconnection", proofDocumentUrl: null, proofHash: null, stakeAmount: 50, status: "finalized", txHash: "0xabc123def456", onChainClaimId: 1, verifierId: "u2", verifierWallet: "0x123...", verifierStakeAmount: 200, attestedAt: "2024-02-10", challengeWindowEnd: "2024-02-17", challengerId: null, challengeReason: null, challengedAt: null, createdAt: "2024-02-08" },
        { id: "c2", dataCenterId: "2", claimerId: "u1", factType: "OWNERSHIP", factData: "Owned by Google LLC", proofDocumentUrl: null, proofHash: null, stakeAmount: 30, status: "attested", txHash: "0xdef789ghi012", onChainClaimId: 2, verifierId: "u3", verifierWallet: "0x456...", verifierStakeAmount: 300, attestedAt: "2024-03-05", challengeWindowEnd: "2024-03-12", challengerId: null, challengeReason: null, challengedAt: null, createdAt: "2024-03-01" },
        { id: "c3", dataCenterId: "3", claimerId: "u1", factType: "POWER_CAPACITY", factData: "150 MW planned capacity", proofDocumentUrl: null, proofHash: null, stakeAmount: 40, status: "pending", txHash: null, onChainClaimId: null, verifierId: null, verifierWallet: null, verifierStakeAmount: null, attestedAt: null, challengeWindowEnd: null, challengerId: null, challengeReason: null, challengedAt: null, createdAt: "2024-03-15" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "finalized": return "success" as const;
      case "attested": return "warning" as const;
      case "challenged": return "danger" as const;
      case "rejected": return "danger" as const;
      default: return "default" as const;
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Claims</h1>
          <p className="text-sm text-muted-foreground">Track your submitted claims and their verification status</p>
        </div>
        <Link href="/claims/submit">
          <Button className="gap-2"><Plus className="h-4 w-4" /> New Claim</Button>
        </Link>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="attested">Attested</TabsTrigger>
          <TabsTrigger value="finalized">Finalized</TabsTrigger>
          <TabsTrigger value="challenged">Challenged</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <ClaimsList claims={claims} loading={loading} statusVariant={statusVariant} />
        </TabsContent>
        <TabsContent value="pending">
          <ClaimsList claims={claims.filter(c => c.status === "pending")} loading={loading} statusVariant={statusVariant} />
        </TabsContent>
        <TabsContent value="attested">
          <ClaimsList claims={claims.filter(c => c.status === "attested")} loading={loading} statusVariant={statusVariant} />
        </TabsContent>
        <TabsContent value="finalized">
          <ClaimsList claims={claims.filter(c => c.status === "finalized")} loading={loading} statusVariant={statusVariant} />
        </TabsContent>
        <TabsContent value="challenged">
          <ClaimsList claims={claims.filter(c => c.status === "challenged")} loading={loading} statusVariant={statusVariant} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClaimsList({ claims, loading, statusVariant }: { claims: Claim[]; loading: boolean; statusVariant: (s: string) => "default" | "success" | "warning" | "danger" }) {
  if (loading) {
    return (
      <div className="space-y-3 mt-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-muted-foreground">No claims found.</p>
        <Link href="/claims/submit">
          <Button variant="outline" className="mt-4">Submit Your First Claim</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {claims.map((claim, i) => (
        <motion.div key={claim.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card className="transition-all hover:border-primary/30">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(claim.status)}>{claim.status}</Badge>
                  <span className="text-sm font-medium">{claim.factType.replace(/_/g, " ")}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(claim.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{claim.factData}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> Stake: ${claim.stakeAmount}</span>
                {claim.txHash && (
                  <span className="font-mono flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> {formatAddress(claim.txHash)}
                  </span>
                )}
                {claim.challengeWindowEnd && claim.status === "attested" && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Clock className="h-3 w-3" /> Window closes {new Date(claim.challengeWindowEnd).toLocaleDateString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
