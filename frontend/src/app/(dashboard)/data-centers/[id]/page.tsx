"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin, Zap, Building2, Globe, Shield, FileText,
  ArrowLeft, ExternalLink, Clock,
} from "lucide-react";
import { dataCentersApi, claimsApi } from "@/lib/api";
import { formatAddress } from "@/lib/utils";
import type { DataCenter, Claim } from "@/types";

export default function DataCenterDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [dc, setDc] = useState<DataCenter | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    try {
      const [dcRes, claimsRes] = await Promise.all([
        dataCentersApi.get(id),
        claimsApi.list({ dataCenterId: id }),
      ]);
      setDc(dcRes.data);
      setClaims(claimsRes.data.data || claimsRes.data || []);
    } catch {
      // Sample data
      setDc({
        id, name: "AWS US-East-1", latitude: 38.8951, longitude: -77.0364,
        country: "US", region: "Virginia", city: "Ashburn", status: "operating",
        ownerType: "hyperscale", ownerName: "Amazon", powerCapacityMW: 500,
        sizeMW: 300, gridStatus: "connected", interconnectionQueueId: "IQ-2023-456",
        description: "Major AWS availability zone in Northern Virginia. One of the largest data center clusters in the world.",
        isPublic: true, imageUrl: null, onChainId: 1, createdAt: "2024-01-01",
      });
      setClaims([
        { id: "c1", dataCenterId: id, claimerId: "u1", factType: "GRID_STATUS", factData: "Connected to PJM Interconnection", proofDocumentUrl: null, proofHash: null, stakeAmount: 50, status: "finalized", txHash: "0xabc...", onChainClaimId: 1, verifierId: "u2", verifierWallet: "0x123...", verifierStakeAmount: 200, attestedAt: "2024-02-10", challengeWindowEnd: "2024-02-17", challengerId: null, challengeReason: null, challengedAt: null, createdAt: "2024-02-08" },
        { id: "c2", dataCenterId: id, claimerId: "u3", factType: "OWNERSHIP", factData: "Owned by Amazon Web Services LLC", proofDocumentUrl: null, proofHash: null, stakeAmount: 30, status: "attested", txHash: "0xdef...", onChainClaimId: 2, verifierId: "u4", verifierWallet: "0x456...", verifierStakeAmount: 300, attestedAt: "2024-03-05", challengeWindowEnd: "2024-03-12", challengerId: null, challengeReason: null, challengedAt: null, createdAt: "2024-03-01" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "operating": return "success" as const;
      case "under_construction": return "warning" as const;
      case "planned": return "default" as const;
      case "stalled": return "danger" as const;
      case "finalized": return "success" as const;
      case "attested": return "warning" as const;
      case "challenged": return "danger" as const;
      case "pending": return "default" as const;
      default: return "default" as const;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!dc) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-muted-foreground">Data center not found.</p>
        <Link href="/data-centers"><Button variant="outline" className="mt-4">Back to List</Button></Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back nav */}
      <Link href="/data-centers" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Data Centers
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{dc.name}</h1>
              <Badge variant={statusVariant(dc.status)}>{dc.status.replace("_", " ")}</Badge>
            </div>
            <div className="mt-2 flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{dc.city}, {dc.region}, {dc.country}</span>
            </div>
          </div>
          <Link href={`/claims/submit?dc=${dc.id}`}>
            <Button className="gap-2">
              <FileText className="h-4 w-4" /> Submit Claim
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Info Cards */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-6 grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Power Capacity
            </div>
            <p className="text-2xl font-bold">{dc.powerCapacityMW ?? "—"} <span className="text-sm text-muted-foreground font-normal">MW</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Building2 className="h-3.5 w-3.5" /> Size
            </div>
            <p className="text-2xl font-bold">{dc.sizeMW ?? "—"} <span className="text-sm text-muted-foreground font-normal">MW</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Globe className="h-3.5 w-3.5" /> Grid Status
            </div>
            <p className="text-lg font-semibold capitalize">{dc.gridStatus ?? "Unknown"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Shield className="h-3.5 w-3.5" /> Owner
            </div>
            <p className="text-lg font-semibold">{dc.ownerName ?? "—"}</p>
            <p className="text-xs text-muted-foreground capitalize">{dc.ownerType}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Description */}
      {dc.description && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">About</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{dc.description}</p>
              {dc.interconnectionQueueId && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Interconnection Queue: <span className="text-foreground font-mono">{dc.interconnectionQueueId}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Claims History */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Claims History</h2>
          <div className="space-y-3">
            {claims.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No claims submitted yet for this data center.</p>
                <Link href={`/claims/submit?dc=${dc.id}`}>
                  <Button variant="outline" className="mt-4">Submit First Claim</Button>
                </Link>
              </Card>
            ) : (
              claims.map((claim) => (
                <Card key={claim.id} className="transition-all hover:border-primary/30">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={statusVariant(claim.status)}>{claim.status}</Badge>
                        <span className="text-sm font-medium">{claim.factType.replace("_", " ")}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(claim.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{claim.factData}</p>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Stake: ${claim.stakeAmount}</span>
                      {claim.txHash && (
                        <span className="font-mono flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {formatAddress(claim.txHash)}
                        </span>
                      )}
                      {claim.challengeWindowEnd && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Window ends {new Date(claim.challengeWindowEnd).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
