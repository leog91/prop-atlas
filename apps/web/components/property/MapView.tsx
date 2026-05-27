"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapProperty {
  id: string;
  title: string;
  price: number;
  currency: string;
  latitude: number;
  longitude: number;
  city?: string | null;
  listingType: string;
  url: string;
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

L.Marker.prototype.options.icon = defaultIcon;

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

export function MapView({ properties, center = [48.8566, 2.3522], zoom = 5 }: MapViewProps) {
  const validProperties = properties.filter(
    (p) => p.latitude != null && p.longitude != null
  );

  if (validProperties.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-gray-500">No properties with location data</p>
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

  const mapCenter: [number, number] = [
    (bounds.minLat + bounds.maxLat) / 2,
    (bounds.minLng + bounds.maxLng) / 2,
  ];

  return (
    <div className="h-[500px] w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
      <MapContainer
        center={validProperties.length === 1 ? [validProperties[0].latitude, validProperties[0].longitude] : mapCenter}
        zoom={validProperties.length === 1 ? 13 : zoom}
        className="h-full w-full"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validProperties.map((property) => (
          <Marker
            key={property.id}
            position={[property.latitude, property.longitude]}
          >
            <Popup>
              <div className="min-w-[150px]">
                <p className="text-sm font-medium line-clamp-1">{property.title}</p>
                <p className="text-sm font-semibold">
                  {formatPrice(property.price, property.currency)}
                  {property.listingType === "rent" && "/mo"}
                </p>
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
        ))}
      </MapContainer>
    </div>
  );
}
