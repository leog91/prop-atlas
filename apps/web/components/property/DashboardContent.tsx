"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { PropertyCard } from "./PropertyCard";

const MapView = dynamic(() => import("./MapView").then((mod) => ({ default: mod.MapView })), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-gray-500">Loading map...</p>
    </div>
  ),
});

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
}

interface DashboardContentProps {
  properties: Property[];
}

export function DashboardContent({ properties }: DashboardContentProps) {
  const [view, setView] = useState<"list" | "map">("list");

  return (
    <>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setView("list")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            view === "list"
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "border border-gray-300 dark:border-gray-700"
          }`}
        >
          List
        </button>
        <button
          onClick={() => setView("map")}
          className={`rounded-md px-3 py-1.5 text-sm ${
            view === "map"
              ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
              : "border border-gray-300 dark:border-gray-700"
          }`}
        >
          Map
        </button>
      </div>

      {view === "list" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <MapView
          properties={properties.map((p) => ({
            id: p.id,
            title: p.title,
            price: p.price,
            currency: p.currency,
            latitude: p.latitude ?? 0,
            longitude: p.longitude ?? 0,
            city: p.city,
            listingType: p.listingType,
            url: p.url,
          }))}
        />
      )}
    </>
  );
}
