"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, Wallet, Info } from "lucide-react";
import { dataCentersApi, claimsApi } from "@/lib/api";
import type { DataCenter } from "@/types";

const FACT_TYPES = [
  { value: "INTERCONNECTION_QUEUE", label: "Interconnection Queue Status" },
  { value: "OWNERSHIP", label: "Ownership / Operator" },
  { value: "GRID_STATUS", label: "Grid Connection Status" },
  { value: "POWER_CAPACITY", label: "Power Capacity" },
  { value: "CONSTRUCTION_STATUS", label: "Construction Status" },
  { value: "PERMIT_STATUS", label: "Permit / Zoning Status" },
  { value: "WATER_USAGE", label: "Water Usage" },
  { value: "OTHER", label: "Other" },
];

export default function SubmitClaimPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedDC = searchParams.get("dc") || "";

  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [selectedDC, setSelectedDC] = useState(preselectedDC);
  const [factType, setFactType] = useState("");
  const [factData, setFactData] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [stakeAmount, setStakeAmount] = useState("50");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDataCenters();
  }, []);

  async function loadDataCenters() {
    try {
      const res = await dataCentersApi.list({ limit: 100 });
      setDataCenters(res.data.data || res.data);
    } catch {
      setDataCenters([
        { id: "1", name: "AWS US-East-1", latitude: 38.8951, longitude: -77.0364, country: "US", region: "Virginia", city: "Ashburn", status: "operating", ownerType: "hyperscale", ownerName: "Amazon", powerCapacityMW: 500, sizeMW: 300, gridStatus: "connected", interconnectionQueueId: null, description: null, isPublic: true, imageUrl: null, onChainId: 1, createdAt: "2024-01-01" },
        { id: "2", name: "Google Cloud us-west1", latitude: 37.7749, longitude: -122.4194, country: "US", region: "Oregon", city: "The Dalles", status: "operating", ownerType: "hyperscale", ownerName: "Google", powerCapacityMW: 350, sizeMW: 200, gridStatus: "connected", interconnectionQueueId: null, description: null, isPublic: true, imageUrl: null, onChainId: 2, createdAt: "2024-01-15" },
        { id: "3", name: "Equinix LD8", latitude: 51.5072, longitude: 0.1276, country: "UK", region: "London", city: "London", status: "under_construction", ownerType: "colocation", ownerName: "Equinix", powerCapacityMW: 150, sizeMW: 100, gridStatus: "pending", interconnectionQueueId: null, description: null, isPublic: true, imageUrl: null, onChainId: 3, createdAt: "2024-02-01" },
      ]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDC || !factType || !factData) return;

    setSubmitting(true);
    try {
      await claimsApi.submit({
        dataCenterId: selectedDC,
        factType,
        factData,
        proofDocumentUrl: proofUrl || undefined,
      });
      router.push("/claims");
    } catch (err) {
      console.error("Failed to submit claim:", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Submit a Claim</CardTitle>
            <p className="text-sm text-muted-foreground">
              Submit verified data about a data center. You&apos;ll need to stake USDC which is returned if your claim is verified.
            </p>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5">
              {/* Data Center Selection */}
              <div className="space-y-2">
                <Label>Data Center</Label>
                <Select value={selectedDC} onValueChange={setSelectedDC}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a data center" />
                  </SelectTrigger>
                  <SelectContent>
                    {dataCenters.map((dc) => (
                      <SelectItem key={dc.id} value={dc.id}>
                        {dc.name} — {dc.city}, {dc.country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fact Type */}
              <div className="space-y-2">
                <Label>Fact Type</Label>
                <Select value={factType} onValueChange={setFactType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fact type" />
                  </SelectTrigger>
                  <SelectContent>
                    {FACT_TYPES.map((ft) => (
                      <SelectItem key={ft.value} value={ft.value}>
                        {ft.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fact Data */}
              <div className="space-y-2">
                <Label>Claim Data</Label>
                <Textarea
                  placeholder="Enter the verified information..."
                  value={factData}
                  onChange={(e) => setFactData(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Proof URL */}
              <div className="space-y-2">
                <Label>Proof Document URL (optional)</Label>
                <div className="relative">
                  <Upload className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="https://..."
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Stake Amount */}
              <div className="space-y-2">
                <Label>Stake Amount (USDC)</Label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="number"
                    min="10"
                    max="1000"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  <p>Minimum stake is $20 USDC. Your stake is returned when the claim is verified. If challenged and incorrect, your stake is slashed.</p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex gap-3">
              <Button type="submit" disabled={submitting || !selectedDC || !factType || !factData} className="flex-1">
                {submitting ? "Submitting..." : "Submit Claim"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
