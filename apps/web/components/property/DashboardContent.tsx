"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { PropertyCard } from "./PropertyCard";

const MapView = dynamic(() => import("./MapView").then((mod) => ({ default: mod.MapView })), {
  ssr: false,
  loading: () => <MapPlaceholder>Loading map...</MapPlaceholder>,
});

function MapPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[500px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-gray-500">{children}</p>
    </div>
  );
}

interface Property {
  id: string;
  title: string;
  price: number;
  currency: string;
  city?: string | null;
  country?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  area?: number | null;
  areaUnit?: string | null;
  propertyType: string;
  listingType: string;
  provider: string;
  images: string[];
  isFavorite: boolean;
  url: string;
  latitude?: number | null;
  longitude?: number | null;
  rawPayload?: unknown;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  savedAt?: Date | string | null;
  savedUpdatedAt?: Date | string | null;
  notes?: string | null;
  priceHistory?: Array<{ id: string; price: number; currency: string; recordedAt: Date | string }> | null;
}

interface MapMarker {
  id: string;
  title: string;
  price: number;
  currency: string;
  city?: string | null;
  listingType: string;
  url: string;
  latitude: number;
  longitude: number;
  isApproximate: boolean;
  radiusMeters: number | null;
}

interface DashboardContentProps {
  properties: Property[];
  /** Serialized filters, so the map covers every match rather than this page. */
  mapQuery: string;
  showDeleted?: boolean;
  readOnly?: boolean;
}

export function DashboardContent({ properties, mapQuery, showDeleted, readOnly }: DashboardContentProps) {
  const [view, setView] = useState<"list" | "map">("list");
  const [items, setItems] = useState(properties);

  // Markers span every listing matching the filters, so they are fetched only
  // once the map is actually opened.
  const [markers, setMarkers] = useState<MapMarker[] | null>(null);
  const [markersError, setMarkersError] = useState(false);

  useEffect(() => {
    if (view !== "map" || markers || markersError) return;

    let cancelled = false;
    fetch(`/api/properties/map?${mapQuery}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setMarkers(data.markers);
      })
      .catch(() => {
        if (!cancelled) setMarkersError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [view, markers, markersError, mapQuery]);

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    setMarkers((prev) => prev?.filter((m) => m.id !== id) ?? null);
  }, []);

  return (
    <>
      <div className="mb-4 flex gap-2">
        {(["list", "map"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setView(mode)}
            aria-pressed={view === mode}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm ${
              view === mode
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "border border-gray-300 dark:border-gray-700"
            }`}
          >
            {mode === "list" ? "List" : "Map"}
          </button>
        ))}
      </div>

      {view === "list" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((property, index) => (
            <PropertyCard
              key={property.id}
              property={property}
              showDeleted={showDeleted}
              readOnly={readOnly}
              priority={index === 0}
              onRemove={handleRemove}
            />
          ))}
        </div>
      ) : markersError ? (
        <MapPlaceholder>Could not load map data.</MapPlaceholder>
      ) : markers ? (
        <MapView properties={markers} />
      ) : (
        <MapPlaceholder>Loading map...</MapPlaceholder>
      )}
    </>
  );
}
