"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Search, X, Zap, Building2, Clock } from "lucide-react";
import { cn, getStatusColor } from "@/lib/utils";
import { mapApi } from "@/lib/api";
import type { GeoJSONCollection, GeoJSONFeature } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  operating: "#10b981",
  under_construction: "#f59e0b",
  planned: "#3b82f6",
  stalled: "#ef4444",
  decommissioned: "#6b7280",
};

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedDC, setSelectedDC] = useState<GeoJSONFeature | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLayers, setShowLayers] = useState(false);
  const [geojson, setGeojson] = useState<GeoJSONCollection | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [0, 30],
      zoom: 2,
      attributionControl: false,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.current.on("load", () => {
      setLoaded(true);
      loadDataCenters();
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  async function loadDataCenters() {
    try {
      const res = await mapApi.geojson();
      const data = res.data as GeoJSONCollection;
      setGeojson(data);
      addMarkers(data);
    } catch {
      // Use sample data for demo
      const sampleData: GeoJSONCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-77.0364, 38.8951] },
            properties: { id: "1", name: "AWS US-East-1", status: "operating", country: "US", region: "Virginia", city: "Ashburn", ownerType: "hyperscale", ownerName: "Amazon", powerCapacityMW: 500, sizeMW: 300 },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-122.4194, 37.7749] },
            properties: { id: "2", name: "Google Cloud us-west1", status: "operating", country: "US", region: "Oregon", city: "The Dalles", ownerType: "hyperscale", ownerName: "Google", powerCapacityMW: 350, sizeMW: 200 },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [0.1276, 51.5072] },
            properties: { id: "3", name: "Equinix LD8", status: "under_construction", country: "UK", region: "London", city: "London", ownerType: "colocation", ownerName: "Equinix", powerCapacityMW: 150, sizeMW: 100 },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [139.6917, 35.6895] },
            properties: { id: "4", name: "NTT Tokyo DC", status: "planned", country: "JP", region: "Tokyo", city: "Tokyo", ownerType: "colocation", ownerName: "NTT", powerCapacityMW: 200, sizeMW: 150 },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [103.8198, 1.3521] },
            properties: { id: "5", name: "Digital Realty SIN", status: "operating", country: "SG", region: "Singapore", city: "Singapore", ownerType: "colocation", ownerName: "Digital Realty", powerCapacityMW: 180, sizeMW: 120 },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [8.6821, 50.1109] },
            properties: { id: "6", name: "CyrusOne FRA", status: "stalled", country: "DE", region: "Frankfurt", city: "Frankfurt", ownerType: "colocation", ownerName: "CyrusOne", powerCapacityMW: 120, sizeMW: 80 },
          },
        ],
      };
      setGeojson(sampleData);
      addMarkers(sampleData);
    }
  }

  function addMarkers(data: GeoJSONCollection) {
    if (!map.current) return;

    data.features.forEach((feature) => {
      if (!map.current) return;
      const color = STATUS_COLORS[feature.properties.status] || "#6b7280";

      const el = document.createElement("div");
      el.className = "dc-marker";
      el.style.cssText = `width: 14px; height: 14px; border-radius: 50%; background: ${color}; border: 2px solid rgba(255,255,255,0.3); cursor: pointer; box-shadow: 0 0 12px ${color}40;`;

      el.addEventListener("click", () => {
        setSelectedDC(feature);
      });

      new maplibregl.Marker({ element: el })
        .setLngLat(feature.geometry.coordinates as [number, number])
        .addTo(map.current!);
    });
  }

  function toggleFilter(status: string) {
    setActiveFilters((prev) =>
      prev.includes(status) ? prev.filter((f) => f !== status) : [...prev, status]
    );
  }

  const filteredDCs = geojson?.features.filter((f) => {
    if (activeFilters.length > 0 && !activeFilters.includes(f.properties.status)) return false;
    if (searchQuery && !f.properties.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="relative -m-6 h-[calc(100vh-4rem)]">
      {/* Map Container */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* Search Bar */}
      <div className="absolute top-4 left-4 z-10 w-80">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search data centers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card/90 backdrop-blur-md border-border"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Search Results */}
        {searchQuery && filteredDCs && filteredDCs.length > 0 && (
          <Card className="mt-2 max-h-60 overflow-y-auto p-2 bg-card/90 backdrop-blur-md">
            {filteredDCs.slice(0, 8).map((dc) => (
              <button
                key={dc.properties.id}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedDC(dc);
                  setSearchQuery("");
                  map.current?.flyTo({
                    center: dc.geometry.coordinates as [number, number],
                    zoom: 10,
                    duration: 1500,
                  });
                }}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[dc.properties.status] }}
                />
                <div className="min-w-0">
                  <div className="font-medium truncate">{dc.properties.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {dc.properties.region}, {dc.properties.country}
                  </div>
                </div>
              </button>
            ))}
          </Card>
        )}
      </div>

      {/* Layer Toggle */}
      <div className="absolute top-4 right-16 z-10">
        <Button
          variant="outline"
          size="sm"
          className="bg-card/90 backdrop-blur-md gap-2"
          onClick={() => setShowLayers(!showLayers)}
        >
          <Layers className="h-4 w-4" /> Layers
        </Button>
        {showLayers && (
          <Card className="mt-2 p-3 bg-card/95 backdrop-blur-md w-48">
            <p className="text-xs font-medium text-muted-foreground mb-2">Filter by Status</p>
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <button
                key={status}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer",
                  activeFilters.includes(status) ? "bg-secondary" : "hover:bg-secondary/50"
                )}
                onClick={() => toggleFilter(status)}
              >
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize">{status.replace("_", " ")}</span>
              </button>
            ))}
          </Card>
        )}
      </div>

      {/* Selected DC Popup */}
      {selectedDC && (
        <div className="absolute bottom-6 left-4 z-10 w-96">
          <Card className="overflow-hidden bg-card/95 backdrop-blur-md">
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{selectedDC.properties.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedDC.properties.region}, {selectedDC.properties.country}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setSelectedDC(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={selectedDC.properties.status === "operating" ? "success" : selectedDC.properties.status === "stalled" ? "danger" : "warning"}
                  >
                    {selectedDC.properties.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-3.5 w-3.5" />
                  {selectedDC.properties.powerCapacityMW} MW
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-3.5 w-3.5" />
                  {selectedDC.properties.sizeMW} MW capacity
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  12 claims
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button size="sm" className="flex-1" asChild>
                  <a href={`/data-centers/${selectedDC.properties.id}`}>View Details</a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/claims/submit?dc=${selectedDC.properties.id}`}>Submit Claim</a>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 right-4 z-10">
        <Card className="p-3 bg-card/90 backdrop-blur-md">
          <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
          <div className="space-y-1">
            {Object.entries(STATUS_COLORS).slice(0, 4).map(([status, color]) => (
              <div key={status} className="flex items-center gap-2 text-xs">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize text-muted-foreground">{status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
