"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Zap, MapPin, Building2 } from "lucide-react";
import { dataCentersApi } from "@/lib/api";
import type { DataCenter } from "@/types";

export default function DataCentersPage() {
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");

  useEffect(() => {
    loadDataCenters();
  }, []);

  async function loadDataCenters() {
    try {
      const res = await dataCentersApi.list();
      setDataCenters(res.data.data || res.data);
    } catch {
      // Sample data
      setDataCenters([
        { id: "1", name: "AWS US-East-1", latitude: 38.8951, longitude: -77.0364, country: "US", region: "Virginia", city: "Ashburn", status: "operating", ownerType: "hyperscale", ownerName: "Amazon", powerCapacityMW: 500, sizeMW: 300, gridStatus: "connected", interconnectionQueueId: null, description: "Major AWS availability zone in Northern Virginia", isPublic: true, imageUrl: null, onChainId: 1, createdAt: "2024-01-01" },
        { id: "2", name: "Google Cloud us-west1", latitude: 37.7749, longitude: -122.4194, country: "US", region: "Oregon", city: "The Dalles", status: "operating", ownerType: "hyperscale", ownerName: "Google", powerCapacityMW: 350, sizeMW: 200, gridStatus: "connected", interconnectionQueueId: null, description: "Google Cloud data center campus", isPublic: true, imageUrl: null, onChainId: 2, createdAt: "2024-01-15" },
        { id: "3", name: "Equinix LD8", latitude: 51.5072, longitude: 0.1276, country: "UK", region: "London", city: "London", status: "under_construction", ownerType: "colocation", ownerName: "Equinix", powerCapacityMW: 150, sizeMW: 100, gridStatus: "pending", interconnectionQueueId: "IQ-2024-001", description: "New Equinix facility in London Docklands", isPublic: true, imageUrl: null, onChainId: 3, createdAt: "2024-02-01" },
        { id: "4", name: "NTT Tokyo DC", latitude: 35.6895, longitude: 139.6917, country: "JP", region: "Tokyo", city: "Tokyo", status: "planned", ownerType: "colocation", ownerName: "NTT", powerCapacityMW: 200, sizeMW: 150, gridStatus: null, interconnectionQueueId: "IQ-2024-002", description: "Planned NTT data center in Tokyo", isPublic: true, imageUrl: null, onChainId: 4, createdAt: "2024-03-01" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = dataCenters.filter((dc) => {
    if (search && !dc.name.toLowerCase().includes(search.toLowerCase()) && !dc.country.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && dc.status !== statusFilter) return false;
    if (countryFilter !== "all" && dc.country !== countryFilter) return false;
    return true;
  });

  const statusVariant = (status: string) => {
    switch (status) {
      case "operating": return "success" as const;
      case "under_construction": return "warning" as const;
      case "planned": return "default" as const;
      case "stalled": return "danger" as const;
      default: return "default" as const;
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Centers</h1>
          <p className="text-sm text-muted-foreground">Browse and explore global data center infrastructure</p>
        </div>
        <Link href="/claims/submit">
          <Button className="gap-2"><Plus className="h-4 w-4" /> Submit Claim</Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search data centers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="operating">Operating</SelectItem>
            <SelectItem value="under_construction">Under Construction</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="stalled">Stalled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Countries</SelectItem>
            <SelectItem value="US">United States</SelectItem>
            <SelectItem value="UK">United Kingdom</SelectItem>
            <SelectItem value="DE">Germany</SelectItem>
            <SelectItem value="JP">Japan</SelectItem>
            <SelectItem value="SG">Singapore</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((dc, i) => (
          <motion.div
            key={dc.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link href={`/data-centers/${dc.id}`}>
              <Card className="h-full transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base group-hover:text-primary transition-colors">{dc.name}</CardTitle>
                    <Badge variant={statusVariant(dc.status)}>
                      {dc.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {dc.city}, {dc.country}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      <span>{dc.powerCapacityMW ?? "—"} MW</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{dc.sizeMW ?? "—"} MW size</span>
                    </div>
                  </div>
                  {dc.ownerName && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Owner: <span className="text-foreground">{dc.ownerName}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No data centers found matching your filters.</p>
        </div>
      )}
    </div>
  );
}
