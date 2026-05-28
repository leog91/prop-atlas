"use client";

import { useState, type ReactNode } from "react";

const PROVIDER_COUNTRY: Record<string, string> = {
  daft: "ireland",
  kamernet: "netherlands",
  idealista: "spain",
  zonaprop: "argentina",
};

const FLAGS: Record<string, ReactNode> = {
  ireland: (
    <svg viewBox="0 0 36 27" className="h-3 w-4 rounded-sm">
      <rect width="12" height="27" fill="#009A49" />
      <rect x="12" width="12" height="27" fill="#FFFFFF" />
      <rect x="24" width="12" height="27" fill="#FF7900" />
    </svg>
  ),
  netherlands: (
    <svg viewBox="0 0 36 27" className="h-3 w-4 rounded-sm">
      <rect width="36" height="9" fill="#AE1C28" />
      <rect y="9" width="36" height="9" fill="#FFFFFF" />
      <rect y="18" width="36" height="9" fill="#21468B" />
    </svg>
  ),
  spain: (
    <svg viewBox="0 0 36 27" className="h-3 w-4 rounded-sm">
      <rect width="36" height="6.75" fill="#AA151B" />
      <rect y="6.75" width="36" height="13.5" fill="#F1BF00" />
      <rect y="20.25" width="36" height="6.75" fill="#AA151B" />
    </svg>
  ),
  argentina: (
    <svg viewBox="0 0 36 27" className="h-3 w-4 rounded-sm">
      <rect width="36" height="9" fill="#74ACDF" />
      <rect y="9" width="36" height="9" fill="#FFFFFF" />
      <rect y="18" width="36" height="9" fill="#74ACDF" />
    </svg>
  ),
};

function FlagIcon({ country }: { country: string }) {
  return <>{FLAGS[country] || null}</>;
}

interface PropertyCardProps {
  property: {
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
    listedAt?: string | null;
    views?: number | null;
  };
  onToggleFavorite?: (id: string) => void;
  showDeleted?: boolean;
  onRemove?: (id: string) => void;
}

export function PropertyCard({ property, onToggleFavorite, showDeleted, onRemove }: PropertyCardProps) {
  const [isFav, setIsFav] = useState(property.isFavorite);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleFavorite = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/properties/${property.id}/favorite`, {
        method: "PATCH",
      });
      if (res.ok) {
        const data = await res.json();
        setIsFav(data.isFavorite);
        onToggleFavorite?.(property.id);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteToggle = async () => {
    if (deleteLoading) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/properties/${property.id}/delete`, {
        method: "PATCH",
      });
      if (res.ok) {
        onRemove?.(property.id);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (deleteLoading) return;
    if (!confirm("Are you sure you want to permanently delete this property? This cannot be undone.")) {
      return;
    }
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/properties/${property.id}/delete`, {
        method: "DELETE",
      });
      if (res.ok) {
        onRemove?.(property.id);
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat("en-EU", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const [, day, month, year] = match;
        return {
          formatted: `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`,
          relative: ''
        };
      }
      return { formatted: dateStr, relative: '' };
    }
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const formatted = `${day}/${month}/${year}`;
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    let relative = '';
    if (diffDays === 0) relative = 'Today';
    else if (diffDays === 1) relative = 'Yesterday';
    else if (diffDays < 7) relative = `${diffDays} days ago`;
    else if (diffDays < 30) relative = `${Math.floor(diffDays / 7)} weeks ago`;
    else if (diffDays < 365) relative = `${Math.floor(diffDays / 30)} months ago`;
    else relative = `${Math.floor(diffDays / 365)} years ago`;
    
    return { formatted, relative };
  };

  const mainImage = property.images[0] || "/placeholder-property.svg";

  return (
    <div className="group overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mainImage}
          alt={property.title}
          className={`absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105 ${showDeleted ? "grayscale opacity-60" : ""}`}
        />
        <div className="absolute right-2 top-2 flex gap-2">
          <button
            onClick={handleFavorite}
            disabled={loading}
            className="rounded-full bg-white/90 p-2 shadow-sm backdrop-blur-sm transition-colors hover:bg-white dark:bg-gray-900/90 dark:hover:bg-gray-900"
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <svg
              className={`h-5 w-5 ${isFav ? "fill-red-500 text-red-500" : "fill-none text-gray-600 dark:text-gray-400"}`}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
          <button
            onClick={handleDeleteToggle}
            disabled={deleteLoading}
            className="rounded-full bg-white/90 p-2 shadow-sm backdrop-blur-sm transition-colors hover:bg-white dark:bg-gray-900/90 dark:hover:bg-gray-900"
            aria-label={showDeleted ? "Restore property" : "Delete property"}
          >
            <svg
              className="h-5 w-5 text-gray-600 dark:text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              {showDeleted ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              )}
            </svg>
          </button>
        </div>
        <div className="absolute left-2 top-2 flex gap-1">
          <span className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
            {property.listingType === "rent" ? "Rent" : "Buy"}
          </span>
          <span className="flex items-center gap-1 rounded bg-gray-900/70 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            <FlagIcon country={PROVIDER_COUNTRY[property.provider]} />
            {property.provider}
          </span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-medium">{property.title}</h3>
        </div>

        <p className="mt-1 text-lg font-semibold">
          {formatPrice(property.price, property.currency)}
          {property.listingType === "rent" && (
            <span className="text-sm font-normal text-gray-500">/mo</span>
          )}
        </p>

        {(property.city || property.country) && (
          <p className="mt-1 text-sm text-gray-500">
            {[property.city, property.country].filter(Boolean).join(", ")}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          {property.bedrooms != null && (
            <span>{property.bedrooms} bed</span>
          )}
          {property.bathrooms != null && (
            <span>{property.bathrooms} bath</span>
          )}
          {property.area != null && (
            <span>
              {property.area} {property.areaUnit || "m²"}
            </span>
          )}
        </div>

        {(property.listedAt || property.views != null) && (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
            {property.listedAt && (() => {
              const { formatted, relative } = formatDate(property.listedAt);
              return (
                <span>
                  Listed {formatted}
                  {relative && ` (${relative})`}
                </span>
              );
            })()}
            {property.views != null && (
              <span>{property.views.toLocaleString()} views</span>
            )}
          </div>
        )}

        <a
          href={property.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          View on {property.provider}
        </a>

        {showDeleted && (
          <button
            onClick={handlePermanentDelete}
            disabled={deleteLoading}
            className="mt-2 w-full rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
          >
            Delete permanently
          </button>
        )}
      </div>
    </div>
  );
}
