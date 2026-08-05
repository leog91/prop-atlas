"use client";

import { Fragment } from "react";
import { Circle, MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapProperty {
  id: string;
  title: string;
  price: number;
  currency: string;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  listingType: string;
  url: string;
  rawPayload?: unknown;
}

interface MapViewProps {
  properties: MapProperty[];
  center?: [number, number];
  zoom?: number;
}

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const approximateIcon = L.divIcon({
  className: "",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#f59e0b;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,0.45);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

L.Marker.prototype.options.icon = defaultIcon;

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function getLocationMeta(rawPayload: unknown) {
  const payload = rawPayload as Record<string, unknown> | undefined;
  const isApproximate =
    payload?.isApproximateLocation === true ||
    payload?.locationPrecision === "approximate";
  const radius = Number(payload?.locationRadiusMeters);

  return {
    isApproximate,
    radiusMeters: Number.isFinite(radius) && radius > 0 ? radius : 650,
  };
}

function hasValidCoordinates(property: MapProperty): property is MapProperty & { latitude: number; longitude: number } {
  return (
    typeof property.latitude === "number" &&
    typeof property.longitude === "number" &&
    Number.isFinite(property.latitude) &&
    Number.isFinite(property.longitude)
  );
}

export function MapView({ properties, center, zoom = 5 }: MapViewProps) {
  const validProperties = properties.filter(hasValidCoordinates);

  if (validProperties.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <div className="px-6 text-center">
          <p className="font-medium text-gray-700 dark:text-gray-300">No properties with location data</p>
          {properties.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              Save or update listings again so Prop Atlas can geocode their Idealista location text.
            </p>
          )}
        </div>
      </div>
    );
  }

  const bounds = validProperties.reduce(
    (acc, p) => ({
      minLat: Math.min(acc.minLat, p.latitude),
      maxLat: Math.max(acc.maxLat, p.latitude),
      minLng: Math.min(acc.minLng, p.longitude),
      maxLng: Math.max(acc.maxLng, p.longitude),
    }),
    {
      minLat: validProperties[0].latitude,
      maxLat: validProperties[0].latitude,
      minLng: validProperties[0].longitude,
      maxLng: validProperties[0].longitude,
    }
  );

  const computedCenter: [number, number] = [
    (bounds.minLat + bounds.maxLat) / 2,
    (bounds.minLng + bounds.maxLng) / 2,
  ];
  const mapBounds: [[number, number], [number, number]] = [
    [bounds.minLat, bounds.minLng],
    [bounds.maxLat, bounds.maxLng],
  ];
  const shouldFitBounds = !center && validProperties.length > 1;

  return (
    <div className="h-[500px] w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
      <MapContainer
        center={
          shouldFitBounds
            ? undefined
            : validProperties.length === 1
              ? [validProperties[0].latitude, validProperties[0].longitude]
              : (center ?? computedCenter)
        }
        zoom={shouldFitBounds ? undefined : (validProperties.length === 1 ? 13 : zoom)}
        bounds={shouldFitBounds ? mapBounds : undefined}
        boundsOptions={{ padding: [32, 32], maxZoom: 13 }}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validProperties.map((property) => {
          const locationMeta = getLocationMeta(property.rawPayload);
          const position: [number, number] = [property.latitude, property.longitude];

          return (
            <Fragment key={property.id}>
              {locationMeta.isApproximate && (
                <Circle
                  center={position}
                  radius={locationMeta.radiusMeters}
                  pathOptions={{
                    color: "#d97706",
                    fillColor: "#f59e0b",
                    fillOpacity: 0.18,
                    opacity: 0.75,
                    weight: 2,
                  }}
                />
              )}
              <Marker
                position={position}
                icon={locationMeta.isApproximate ? approximateIcon : defaultIcon}
              >
                <Popup>
                  <div className="min-w-[150px]">
                    <p className="text-sm font-medium line-clamp-1">{property.title}</p>
                    <p className="text-sm font-semibold">
                      {property.price === 0 ? (
                        <span className="text-xs font-normal text-gray-500">Contact for price</span>
                      ) : (
                        <>
                          {formatPrice(property.price, property.currency)}
                          {property.listingType === "rent" && "/mo"}
                        </>
                      )}
                    </p>
                    {locationMeta.isApproximate && (
                      <p className="mt-1 text-xs font-medium text-amber-700">Approximate area</p>
                    )}
                    {property.city && (
                      <p className="text-xs text-gray-500">{property.city}</p>
                    )}
                    <a
                      href={property.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                    >
                      View listing
                    </a>
                  </div>
                </Popup>
              </Marker>
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
