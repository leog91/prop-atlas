"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";

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
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
    savedAt?: Date | string | null;
    savedUpdatedAt?: Date | string | null;
    expenses?: number | null;
    expensesCurrency?: string | null;
    notes?: string | null;
    priceHistory?: Array<{ id: string; price: number; currency: string; recordedAt: Date | string }> | null;
  };
  onToggleFavorite?: (id: string) => void;
  showDeleted?: boolean;
  readOnly?: boolean;
  priority?: boolean;
  onRemove?: (id: string) => void;
}

function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);

  const prev = useCallback(() => {
    setIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  }, [images.length]);

  const next = useCallback(() => {
    setIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && images.length > 1) {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight" && images.length > 1) {
        e.preventDefault();
        next();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, prev, next, images.length]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-4 top-4 z-10 cursor-pointer rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        aria-label="Close"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="Previous image"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 cursor-pointer rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          aria-label="Next image"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      <div className="max-h-[85vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index]}
          alt=""
          referrerPolicy="no-referrer"
          className="max-h-[85vh] max-w-[90vw] object-contain"
        />
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}

export function PropertyCard({ property, onToggleFavorite, showDeleted, readOnly, priority, onRemove }: PropertyCardProps) {
  const [isFav, setIsFav] = useState(property.isFavorite);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  
  const [notes, setNotes] = useState(property.notes || "");
  const [notesSaving, setNotesSaving] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const handleSaveNotes = async (text: string) => {
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/properties/${property.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: text || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || "");
        setIsEditingNotes(false);
      }
    } catch (err) {
      console.error("Failed to save notes:", err);
    } finally {
      setNotesSaving(false);
    }
  };

  const getPriceTrend = () => {
    if (!property.priceHistory || property.priceHistory.length <= 1) return null;
    const prices = property.priceHistory.map((h) => h.price);
    const maxPrice = Math.max(...prices);
    
    if (property.price > 0 && maxPrice > property.price) {
      const percentDrop = Math.round(((maxPrice - property.price) / maxPrice) * 100);
      return {
        percentDrop,
        maxPrice,
      };
    }
    return null;
  };

  const priceTrend = getPriceTrend();

  const images = property.images.length > 0 ? property.images : ["/placeholder-property.svg"];
  const currentImage = images[imageIndex];
  const hasMultiple = images.length > 1;

  const nextImage = useCallback(() => {
    setImageIndex((i) => (i === images.length - 1 ? 0 : i + 1));
  }, [images.length]);

  const prevImage = useCallback(() => {
    setImageIndex((i) => (i === 0 ? images.length - 1 : i - 1));
  }, [images.length]);

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

  const formatDate = (input: string | Date) => {
    let date: Date;

    if (input instanceof Date) {
      date = input;
    } else {
      // Providers use dd/mm/yyyy. Parse explicitly before generic Date parsing
      // to avoid JavaScript interpreting "11/05/2026" as 5 November.
      const slashMatch = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (slashMatch) {
        const [, day, month, year] = slashMatch;
        date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        const parsedIso = new Date(input);
        if (!isNaN(parsedIso.getTime())) {
          date = parsedIso;
        } else {
          return { formatted: input, relative: '' };
        }
      }
    }

    if (isNaN(date.getTime())) {
      return { formatted: typeof input === 'string' ? input : input.toISOString(), relative: '' };
    }

    const formatted = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Listed dates should not be in the future. If they are, just show the date.
    if (diffMs < 0) {
      return { formatted, relative: '' };
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let relative = '';
    if (diffDays === 0) relative = 'Today';
    else if (diffDays === 1) relative = 'Yesterday';
    else if (diffDays < 7) relative = `${diffDays} days ago`;
    else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      relative = `${weeks} week${weeks === 1 ? '' : 's'} ago`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      relative = `${months} month${months === 1 ? '' : 's'} ago`;
    } else {
      const years = Math.floor(diffDays / 365);
      relative = `${years} year${years === 1 ? '' : 's'} ago`;
    }

    return { formatted, relative };
  };

  return (
    <>
      <div className="group overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImage}
            alt={property.title}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            referrerPolicy="no-referrer"
            onClick={() => setLightboxOpen(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105 cursor-pointer ${showDeleted ? "grayscale opacity-60" : ""}`}
          />

          {hasMultiple && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/50 group-hover:opacity-100"
                aria-label="Previous image"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white opacity-0 transition-opacity hover:bg-black/50 group-hover:opacity-100"
                aria-label="Next image"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setImageIndex(i); }}
                    className={`h-1.5 rounded-full transition-all ${i === imageIndex ? "w-4 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80"}`}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          {!readOnly && <div className="absolute right-2 top-2 flex gap-2">
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
          </div>}
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

          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <p className="text-lg font-semibold">
              {property.price === 0 ? (
                <span className="text-base font-normal text-gray-500">Contact for price</span>
              ) : (
                <>
                  {formatPrice(property.price, property.currency)}
                  {property.listingType === "rent" && (
                    <span className="text-sm font-normal text-gray-500">/mo</span>
                  )}
                </>
              )}
            </p>
            {priceTrend && (
              <span 
                className="inline-flex items-center gap-0.5 rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                title={`Price dropped from ${formatPrice(priceTrend.maxPrice, property.currency)}`}
              >
                <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {priceTrend.percentDrop}%
              </span>
            )}
          </div>

          {property.expenses != null && property.expenses > 0 && (
            <p className="mt-0.5 text-xs text-gray-500">
              Expenses {formatPrice(property.expenses, property.expensesCurrency || "ARS")}/mo
            </p>
          )}

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

          {(property.savedAt || property.updatedAt) && (
            <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
              {property.savedAt && (() => {
                const { formatted, relative } = formatDate(property.savedAt);
                return (
                  <span>
                    Saved {formatted}
                    {relative && ` (${relative})`}
                  </span>
                );
              })()}
              {property.updatedAt && (() => {
                const { formatted, relative } = formatDate(property.updatedAt);
                return (
                  <span>
                    Updated {formatted}
                    {relative && ` (${relative})`}
                  </span>
                );
              })()}
            </div>
          )}

          {/* Notes Section */}
          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Notes</span>
              {!readOnly && !isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {notes ? "Edit" : "Add Note"}
                </button>
              )}
            </div>
            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  defaultValue={notes}
                  id={`notes-${property.id}`}
                  placeholder="Add notes about this listing..."
                  rows={2}
                  className="w-full rounded-md border border-gray-300 p-1.5 text-xs focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditingNotes(false)}
                    className="rounded border border-gray-300 px-2.5 py-1 text-[10px] font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const el = document.getElementById(`notes-${property.id}`) as HTMLTextAreaElement;
                      handleSaveNotes(el.value);
                    }}
                    disabled={notesSaving}
                    className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {notesSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 italic">
                {notes || "No notes added yet."}
              </p>
            )}
          </div>

          <a
            href={property.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block text-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            View on {property.provider}
          </a>

          {showDeleted && !readOnly && (
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

      {lightboxOpen && (
        <ImageLightbox
          images={images}
          initialIndex={imageIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
