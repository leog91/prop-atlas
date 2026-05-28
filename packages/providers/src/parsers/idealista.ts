import type { ProviderParser, ParsedProperty } from "@prop-atlas/types";
import { Provider, ListingType, PropertyType } from "@prop-atlas/types";

export class IdealistaParser implements ProviderParser {
  readonly name = Provider.IDEALISTA;

  canHandle(url: string): boolean {
    return /idealista\.(com|es|it|pt|fr)/.test(url);
  }

  parse(document: Document): ParsedProperty | null {
    const jsonLd = this.extractJsonLd(document);
    const meta = this.extractMeta(document);
    const dom = this.extractFromDom(document);

    const providerListingId =
      jsonLd?.identifier ||
      meta.listingId ||
      dom.listingId ||
      this.extractIdFromUrl(document.URL);

    if (!providerListingId) return null;

    const listingType = this.detectListingType(document.URL);
    const price = jsonLd?.price ?? meta.price ?? dom.price ?? 0;
    const title = jsonLd?.name ?? meta.title ?? dom.title ?? "";
    const images = jsonLd?.images ?? meta.images ?? dom.images ?? [];
    const country = this.detectCountry(document.URL);
    const location = this.extractLocation(document);
    const coords = this.extractCoordinates(document);
    const displayAddress = location.isApproximate
      ? location.address ?? jsonLd?.address
      : jsonLd?.address ?? location.address;

    return {
      provider: Provider.IDEALISTA,
      providerListingId,
      listingType,
      title,
      description: jsonLd?.description ?? dom.description,
      price,
      currency: "EUR",
      propertyType: this.mapPropertyType(jsonLd?.propertyType ?? dom.propertyType),
      bedrooms: jsonLd?.bedrooms ?? dom.bedrooms,
      bathrooms: jsonLd?.bathrooms ?? dom.bathrooms,
      area: jsonLd?.area ?? dom.area,
      areaUnit: "m²",
      address: displayAddress,
      city: location.city ?? dom.city,
      country,
      postalCode: location.postalCode ?? dom.postalCode,
      latitude: jsonLd?.latitude ?? meta.latitude ?? coords.latitude,
      longitude: jsonLd?.longitude ?? meta.longitude ?? coords.longitude,
      images,
      url: document.URL,
      rawPayload: {
        jsonLd,
        meta,
        dom,
        isApproximateLocation: location.isApproximate,
        locationPrecision: location.isApproximate ? "approximate" : "exact",
        locationRadiusMeters: location.isApproximate ? 650 : undefined,
        locationParts: location.parts,
        geocodeQueries: this.buildGeocodeQueries(location, country),
      },
    };
  }

  private extractJsonLd(document: Document): Record<string, any> | null {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "");
        if (
          data["@type"] === "Residence" ||
          data["@type"] === "RealEstateListing" ||
          data["@type"] === "Apartment" ||
          data["@type"] === "House" ||
          data["@type"] === "Place"
        ) {
          return {
            name: data.name,
            description: data.description,
            price: this.parsePrice(data.price ?? data.offers?.price),
            propertyType: data.accommodationType ?? data["@type"],
            bedrooms: data.numberOfRooms ?? this.extractBedrooms(data.description),
            bathrooms: data.numberOfBathroomsTotal ?? this.extractBathrooms(data.description),
            area: this.parseArea(data.floorSize?.value ?? data.livingArea),
            address: this.formatAddress(data.address),
            latitude: data.geo?.latitude,
            longitude: data.geo?.longitude,
            images: this.normalizeImages(data.image),
            identifier: data.identifier,
          };
        }
      } catch {}
    }
    return null;
  }

  private extractMeta(document: Document) {
    const getMeta = (name: string) =>
      document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content");

    return {
      title: getMeta("og:title") || getMeta("twitter:title"),
      price: this.parsePrice(getMeta("product:price:amount")),
      images: this.normalizeImages(getMeta("og:image")),
      listingId: this.extractIdFromMeta(getMeta("og:url")),
      latitude: parseFloat(getMeta("place:location:latitude") || "0") || undefined,
      longitude: parseFloat(getMeta("place:location:longitude") || "0") || undefined,
    };
  }

  private extractFromDom(document: Document) {
    const text = (selector: string) => document.querySelector(selector)?.textContent?.trim();
    const attr = (selector: string, attribute: string) => document.querySelector(selector)?.getAttribute(attribute);

    const priceText =
      text('[data-testid="price"]') ||
      text(".detail-price") ||
      text("[class*='price']") ||
      text(".info-data-price");
    const titleText = text("h1") || text(".detail-title");
    const descriptionText = text(".detail-description") || text("[class*='description']") || text(".comment");

    const imageElements = document.querySelectorAll(
      '.detail-multimedia img, [class*="gallery"] img, [data-testid="gallery"] img'
    );
    const images = Array.from(imageElements)
      .map((img) => img.getAttribute("src") || img.getAttribute("data-src"))
      .filter((src): src is string => !!src && src.startsWith("http"));

    const featuresText = document.body.textContent || "";

    const location = this.extractLocation(document);

    return {
      title: titleText || "",
      description: descriptionText,
      price: this.parsePrice(priceText),
      bedrooms: this.extractBedrooms(featuresText) ?? this.extractFromInfoData(document, "rooms"),
      bathrooms: this.extractBathrooms(featuresText) ?? this.extractFromInfoData(document, "bathrooms"),
      area: this.parseArea(text("[class*='area']") || text(".info-data-feature")),
      propertyType: text("[class*='property-type']") || text(".detail-type"),
      address: location.address,
      city: location.city ?? text(".detail-location-city"),
      postalCode: location.postalCode ?? text("[class*='postal-code']"),
      listingId: attr('[data-listing-id]', "data-listing-id") || attr('[data-element-id]', "data-element-id"),
      images,
    };
  }

  private extractLocation(document: Document): {
    address: string | undefined;
    city: string | undefined;
    postalCode: string | undefined;
    parts: string[];
    isApproximate: boolean;
  } {
    const locationHeader = Array.from(document.querySelectorAll("h2, h3")).find((heading) =>
      /^(ubicaci(o|ó)n|location|localiza(ç|c)(a|ã)o)$/i.test(heading.textContent?.trim() || "")
    );

    const addressContainer =
      locationHeader?.closest(".ide-box-detail.overlay-box") ||
      locationHeader?.closest("section") ||
      locationHeader?.parentElement ||
      document.querySelector('[data-testid="address"], .detail-location');

    if (!addressContainer) {
      return {
        address: undefined,
        city: undefined,
        postalCode: undefined,
        parts: [],
        isApproximate: false,
      };
    }

    const raw = addressContainer.textContent?.trim() || "";
    const isApproximate = /privacidad|privacidade|privacy|no ha indicado la ubicaci/i.test(raw);
    const parts = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        return (
          line.length > 0 &&
          !/privacidad|privacidade|privacy|no ha indicado la ubicaci/i.test(line) &&
          !/^(ubicaci(o|ó)n|location|localiza(ç|c)(a|ã)o)$/i.test(line)
        );
      });

    const postalCode = parts
      .map((part) => part.match(/\b\d{4,5}\b/)?.[0])
      .find(Boolean);
    const city = this.extractCity(parts);
    const address = parts.length > 0 ? parts.slice(0, 6).join(", ") : undefined;

    return {
      address,
      city,
      postalCode,
      parts,
      isApproximate,
    };
  }

  private extractCity(parts: string[]): string | undefined {
    const ignored = /^(barrio|distrito|urb\.?|area|área)\b/i;
    const city = [...parts].reverse().find((part) => {
      return !ignored.test(part) && !/\b\d{4,5}\b/.test(part) && !part.includes(",");
    });

    return city;
  }

  private buildGeocodeQueries(
    location: { address?: string; city?: string; postalCode?: string; parts: string[] },
    country: string
  ): string[] {
    const [street, ...rest] = location.parts;
    const neighborhood = rest.find((part) => /^barrio\b/i.test(part));
    const district = rest.find((part) => /^distrito\b/i.test(part));
    const city = location.city;
    const queries = [
      [street, location.postalCode, city, country],
      [street, city, country],
      [neighborhood, city, country],
      [district, city, country],
      [location.address, city, country],
    ]
      .map((parts) => parts.filter(Boolean).join(", "))
      .filter((query) => query.trim().length > 0);

    return Array.from(new Set(queries));
  }

  private extractFromInfoData(document: Document, type: string): number | undefined {
    const elements = document.querySelectorAll(".info-data-feature");
    for (const el of elements) {
      const text = el.textContent || "";
      if (type === "rooms" && /hab|room|bed/i.test(text)) {
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : undefined;
      }
      if (type === "bathrooms" && /ba[ñn]o|bath/i.test(text)) {
        const match = text.match(/(\d+)/);
        return match ? parseInt(match[1]) : undefined;
      }
    }
    return undefined;
  }

  private detectListingType(url: string): ListingType {
    if (url.includes("/alquiler") || url.includes("/affitto") || url.includes("/arrendamento") || url.includes("/rent")) {
      return ListingType.RENT;
    }
    if (url.includes("/venta") || url.includes("/vendita") || url.includes("/venda") || url.includes("/sale")) {
      return ListingType.BUY;
    }
    return ListingType.RENT;
  }

  private detectCountry(url: string): string {
    if (url.includes("idealista.es")) return "Spain";
    if (url.includes("idealista.it")) return "Italy";
    if (url.includes("idealista.pt")) return "Portugal";
    if (url.includes("idealista.fr")) return "France";
    return "Spain";
  }

  private mapPropertyType(type?: string): PropertyType {
    if (!type) return PropertyType.OTHER;
    const lower = type.toLowerCase();
    if (lower.includes("apartment") || lower.includes("piso") || lower.includes("appartamento") || lower.includes("apartamento")) {
      return PropertyType.APARTMENT;
    }
    if (lower.includes("house") || lower.includes("casa") || lower.includes("chalet") || lower.includes("villa")) {
      return PropertyType.HOUSE;
    }
    if (lower.includes("studio") || lower.includes("estudio") || lower.includes("monolocale")) {
      return PropertyType.STUDIO;
    }
    if (lower.includes("room") || lower.includes("habitaci") || lower.includes("quarto") || lower.includes("stanza")) {
      return PropertyType.ROOM;
    }
    return PropertyType.OTHER;
  }

  private parsePrice(value?: string | number | null): number | undefined {
    if (value == null) return undefined;
    if (typeof value === "number") return value || undefined;
    const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
    const match = cleaned.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : undefined;
  }

  private parseArea(value?: string | number | null): number | undefined {
    if (!value) return undefined;
    if (typeof value === "number") return value;
    const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
    const match = cleaned.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : undefined;
  }

  private extractBedrooms(text?: string | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)\s*(hab|room|bed|stanz|quarto)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  private extractBathrooms(text?: string | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)\s*(ba[ñn]o|bath|bagno|casa de banho)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  private normalizeImages(images: string | string[] | null | undefined): string[] {
    if (!images) return [];
    if (typeof images === "string") return [images];
    return images.filter((url) => url.startsWith("http"));
  }

  private formatAddress(address: any): string | undefined {
    if (!address) return undefined;
    if (typeof address === "string") return address;
    return [address.streetAddress, address.addressLocality, address.addressRegion]
      .filter(Boolean)
      .join(", ");
  }

  private extractIdFromUrl(url: string): string {
    const match = url.match(/\/inmueble\/(\d+)/i) || url.match(/\/(\d+)(?:\.htm|\?|$|#)/);
    return match ? match[1] : url.split("/").pop()?.replace(/\..*$/, "") || "";
  }

  private extractIdFromMeta(url?: string | null): string | undefined {
    if (!url) return undefined;
    return this.extractIdFromUrl(url);
  }

  private extractCoordinates(document: Document): { latitude?: number; longitude?: number } {
    // 1. Check for data attributes on map containers
    const mapEl = document.querySelector('[data-testid="map"], .map, [id*="map"]');
    if (mapEl) {
      const lat = parseFloat(mapEl.getAttribute("data-lat") || mapEl.getAttribute("data-latitude") || "");
      const lng = parseFloat(mapEl.getAttribute("data-lng") || mapEl.getAttribute("data-longitude") || "");
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return { latitude: lat, longitude: lng };
      }
    }

    // 2. Check all script tags for coordinate patterns
    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const text = script.textContent || "";
      // Look for patterns like "latitude":41.3851 or lat:41.3851
      const latMatch =
        text.match(/"latitude"\s*:\s*(-?[\d.]+)/) ||
        text.match(/\blat(?:itude)?\s*:\s*(-?[\d.]+)/i);
      const lngMatch =
        text.match(/"longitude"\s*:\s*(-?[\d.]+)/) ||
        text.match(/\b(?:lng|lon|longitude)\s*:\s*(-?[\d.]+)/i);
      if (latMatch && lngMatch) {
        const lat = parseFloat(latMatch[1]);
        const lng = parseFloat(lngMatch[1]);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          return { latitude: lat, longitude: lng };
        }
      }
    }

    // 3. Check for JSON-LD with geo but different structure
    const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of ldScripts) {
      try {
        const data = JSON.parse(script.textContent || "");
        // Handle array of JSON-LD objects
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          const lat = item.geo?.latitude ?? item.latitude ?? item.lat;
          const lng = item.geo?.longitude ?? item.longitude ?? item.lng ?? item.lon;
          if (lat != null && lng != null) {
            const parsedLat = parseFloat(String(lat));
            const parsedLng = parseFloat(String(lng));
            if (!isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat !== 0 && parsedLng !== 0) {
              return { latitude: parsedLat, longitude: parsedLng };
            }
          }
        }
      } catch {}
    }

    // 4. Check for meta tags with various names
    const getMeta = (name: string) =>
      document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content");
    const metaLat = parseFloat(getMeta("og:latitude") || getMeta("latitude") || "");
    const metaLng = parseFloat(getMeta("og:longitude") || getMeta("longitude") || "");
    if (!isNaN(metaLat) && !isNaN(metaLng) && metaLat !== 0 && metaLng !== 0) {
      return { latitude: metaLat, longitude: metaLng };
    }

    return {};
  }
}
