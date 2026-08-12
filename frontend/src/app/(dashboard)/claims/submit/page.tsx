"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAccount, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { keccak256, toHex, decodeEventLog } from "viem";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, Info, Loader2 } from "lucide-react";
import { dataCentersApi, claimsApi, uploadsApi } from "@/lib/api";
import { useClaims } from "@/hooks/useClaims";
import { claimVerificationAbi } from "@/lib/abis";
import type { DataCenter } from "@/types";

// Must match the on-chain FactType enum order
const FACT_TYPES = [
  { value: "INTERCONNECTION_QUEUE", label: "Interconnection Queue Status" },
  { value: "OWNERSHIP", label: "Ownership / Operator" },
  { value: "GRID_STATUS", label: "Grid Connection Status" },
  { value: "POWER_CAPACITY", label: "Power Capacity" },
  { value: "CONSTRUCTION_STATUS", label: "Construction Status" },
  { value: "TRANSACTION_HISTORY", label: "Transaction History" },
  { value: "LAND_USE", label: "Land Use" },
  { value: "WATER_COOLING", label: "Water Cooling" },
  { value: "FIBER_CONNECTIVITY", label: "Fiber Connectivity" },
  { value: "OTHER", label: "Other" },
];

export default function SubmitClaimPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedDC = searchParams.get("dc") || "";

  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { submitClaim, isConfirming } = useClaims();

  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [selectedDC, setSelectedDC] = useState(preselectedDC);
  const [factType, setFactType] = useState("");
  const [factData, setFactData] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadDataCenters();
  }, []);

  async function loadDataCenters() {
    try {
      const res = await dataCentersApi.list({ limit: 100 });
      setDataCenters(res.data.data || res.data);
    } catch {
      setDataCenters([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDC || !factType || !factData) return;

    setSubmitting(true);
    try {
      // 1. Upload proof document to backend (optional)
      let proofUrl: string | undefined;
      if (proofFile) {
        const uploadToast = toast.loading("Uploading proof document...");
        try {
          const res = await uploadsApi.upload(proofFile);
          proofUrl = res.data.url;
          toast.success("Proof uploaded", { id: uploadToast });
        } catch {
          toast.error("Proof upload failed — continuing without it", { id: uploadToast });
        }
      }

      // 2. Submit the claim on-chain (locks contributor stake)
      const dc = dataCenters.find((d) => d.id === selectedDC);
      const onChainDcId = BigInt(dc?.onChainId ?? (Number(selectedDC) || 1));
      const factTypeIndex = FACT_TYPES.findIndex((ft) => ft.value === factType);
      const proofHash = keccak256(toHex(factData));

      const txHash = await submitClaim(onChainDcId, factTypeIndex, factData, proofHash);

      // 3. Parse the on-chain claim id from the receipt
      let onChainClaimId: number | undefined;
      if (txHash && publicClient) {
        try {
          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({ abi: claimVerificationAbi, ...log });
              if (decoded.eventName === "ClaimSubmitted") {
                onChainClaimId = Number(decoded.args.claimId);
                break;
              }
            } catch {
              /* unrelated log */
            }
          }
        } catch {
          /* receipt parse is best-effort */
        }
      }

      // 4. Mirror metadata to the backend for indexing
      try {
        await claimsApi.submit({
          dataCenterId: selectedDC,
          factType,
          factData,
          proofDocumentUrl: proofUrl,
          proofHash,
          onChainClaimId,
          txHash,
        });
      } catch {
        /* backend mirror is best-effort; the on-chain record is canonical */
      }

      toast.success("Claim submitted on-chain");
      router.push("/claims");
    } catch {
      // toast already shown by hook
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
              Contribute verified data about a data center. A 20 USDC stake is locked
              from your deposit and returned with a reward when your claim is verified.
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

              {/* Proof File */}
              <div className="space-y-2">
                <Label>Proof Document (optional)</Label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground hover:border-primary/50 transition-colors">
                  <Upload className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {proofFile ? proofFile.name : "Upload image, PDF, or document (max 10 MB)"}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.txt,.csv"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                <p>
                  20 USDC is locked from your Stake deposit. It is returned plus a reward
                  when the claim finalizes; if a jury rules it incorrect, it is slashed.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex gap-3">
              {!isConnected ? (
                <ConnectButton />
              ) : (
                <Button
                  type="submit"
                  disabled={submitting || isConfirming || !selectedDC || !factType || !factData}
                  className="flex-1 gap-2"
                >
                  {(submitting || isConfirming) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting ? "Submitting..." : "Submit Claim On-Chain"}
                </Button>
              )}
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
