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
    const scriptData = this.extractScriptData(document);

    const providerListingId =
      jsonLd?.identifier ||
      meta.listingId ||
      dom.listingId ||
      scriptData.listingId ||
      this.extractIdFromUrl(document.URL);

    if (!providerListingId) return null;

    const listingType = this.detectListingType(document.URL);
    const price = jsonLd?.price ?? meta.price ?? dom.price;
    const title = jsonLd?.name ?? dom.title ?? meta.title ?? "";
    const images = this.collectImages([
      jsonLd?.images,
      meta.images,
      dom.images,
    ]);
    const country = this.detectCountry(document.URL);
    const location = this.extractLocation(document);
    const coords = this.extractCoordinates(document);
    const listingDate = this.extractListingDate(document);
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
      latitude: jsonLd?.latitude ?? meta.latitude ?? coords.latitude ?? scriptData.latitude,
      longitude: jsonLd?.longitude ?? meta.longitude ?? coords.longitude ?? scriptData.longitude,
      images,
      url: document.URL,
      listedAt: listingDate?.isoDate,
      floor: dom.floor,
      hasElevator: dom.hasElevator,
      hasParking: dom.hasParking,
      isFurnished: dom.isFurnished,
      rawPayload: {
        jsonLd,
        meta,
        dom,
        scriptData,
        idealistaUpdatedAtText: listingDate?.sourceText,
        isApproximateLocation: location.isApproximate,
        locationPrecision: location.isApproximate ? "approximate" : "exact",
        locationRadiusMeters: location.isApproximate ? 650 : undefined,
        locationParts: location.parts,
        geocodeQueries: this.buildGeocodeQueries(location, country),
      },
    };
  }

  private extractScriptData(document: Document) {
    const scriptText = Array.from(document.querySelectorAll("script"))
      .map((script) => script.textContent || "")
      .join("\n");

    const listingId = scriptText.match(/adId:\s*(\d+)/)?.[1];
    const mapCenter = scriptText.match(/staticmap\?[^"']*center=([\d.-]+)%2C([\d.-]+)/);
    const latitude = mapCenter ? parseFloat(mapCenter[1]) : undefined;
    const longitude = mapCenter ? parseFloat(mapCenter[2]) : undefined;

    return {
      listingId,
      latitude: Number.isFinite(latitude) ? latitude : undefined,
      longitude: Number.isFinite(longitude) ? longitude : undefined,
    };
  }

  private extractJsonLd(document: Document): Record<string, any> | null {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "");
        const types = Array.isArray(data) ? data.map((d) => d["@type"]) : [data["@type"]];
        if (
          types.some((t) =>
            ["Residence", "RealEstateListing", "Place", "Apartment", "House", "Studio"].includes(t)
          )
        ) {
          const item = Array.isArray(data) ? data.find((d) => !["BreadcrumbList", "WebSite", "Organization"].includes(d["@type"])) : data;
          if (!item) continue;
          return {
            name: item.name,
            description: item.description,
            price: this.parsePrice(item.price ?? item.offers?.price),
            propertyType: item.accommodationType ?? item["@type"],
            bedrooms: item.numberOfRooms ?? this.extractBedrooms(item.description),
            bathrooms: item.numberOfBathroomsTotal ?? this.extractBathrooms(item.description),
            area: this.parseArea(item.floorSize?.value ?? item.livingArea),
            address: this.formatAddress(item.address),
            latitude: item.geo?.latitude,
            longitude: item.geo?.longitude,
            images: this.normalizeImages(item.image),
            identifier: item.identifier,
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
      text(".info-data-price") ||
      text("span.price");
    const titleText = text("h1") || text(".detail-title") || text("span.main-info__title-main");
    const descriptionText = text(".detail-description") || text("[class*='description']") || text(".comment");

    const images = this.extractImagesFromDom(document);

    const featuresText = document.body.textContent || "";

    // Parse floor, elevator, parking from info-features
    const infoFeaturesText = text(".info-features") || "";
    const floorMatch = infoFeaturesText.match(/(\d+ª?\s*(?:planta|piso|floor))/i);
    const hasElevator = /(?:sin\s+ascensor|no\s+elevator|without\s+(?:an\s+)?elevator|without\s+lift)/i.test(featuresText)
      ? false
      : /(?:ascensor|elevator|lift)/i.test(infoFeaturesText)
        ? true
        : undefined;
    const hasParking = /(?:garaje|parking|plaza\s+de\s+aparcamiento)/i.test(infoFeaturesText);
    const isFurnished = /(?:sin\s+amueblar|unfurnished)/i.test(featuresText)
      ? false
      : /(?:amueblado|furnished)/i.test(featuresText)
        ? true
        : undefined;

    const location = this.extractLocation(document);

    return {
      title: titleText || "",
      description: descriptionText,
      price: this.parsePrice(priceText),
      bedrooms: this.extractBedrooms(featuresText) ?? this.extractFromInfoData(document, "rooms"),
      bathrooms: this.extractBathrooms(featuresText) ?? this.extractFromInfoData(document, "bathrooms"),
      area: this.parseArea(text(".info-features") || text("[class*='area']") || text(".info-data-feature")),
      propertyType: text("[class*='property-type']") || text(".detail-type") || text("strong.typology"),
      address: location.address,
      city: location.city ?? text(".detail-location-city"),
      postalCode: location.postalCode ?? text("[class*='postal-code']"),
      floor: floorMatch ? floorMatch[1] : undefined,
      hasElevator,
      hasParking: hasParking || undefined,
      isFurnished,
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
          !/^(ampliar mapa|ver mapa|mapa)$/i.test(line) &&
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
    const ignored = /^(barrio|distrito|urb\.?|area|área|ampliar mapa|ver mapa|mapa)\b/i;
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
      .filter((query) => query.trim().length > 0 && query !== country);

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
    return this.parseLocalizedNumber(value);
  }

  private parseArea(value?: string | number | null): number | undefined {
    if (!value) return undefined;
    if (typeof value === "number") return value;
    return this.parseLocalizedNumber(value);
  }

  private parseLocalizedNumber(value: string): number | undefined {
    const match = value.match(/\d[\d.,]*/);
    if (!match) return undefined;

    let normalized = match[0];
    const lastDot = normalized.lastIndexOf(".");
    const lastComma = normalized.lastIndexOf(",");

    if (lastDot !== -1 && lastComma !== -1) {
      const decimalSeparator = lastDot > lastComma ? "." : ",";
      const thousandSeparator = decimalSeparator === "." ? "," : ".";
      normalized = normalized
        .replace(new RegExp(`\\${thousandSeparator}`, "g"), "")
        .replace(decimalSeparator, ".");
    } else if (lastDot !== -1) {
      normalized = /\.\d{3}(\D|$)/.test(normalized)
        ? normalized.replace(/\./g, "")
        : normalized;
    } else if (lastComma !== -1) {
      normalized = /,\d{3}(\D|$)/.test(normalized)
        ? normalized.replace(/,/g, "")
        : normalized.replace(",", ".");
    }

    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
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

  private collectImages(sources: (string | string[] | null | undefined)[]): string[] {
    const seen = new Set<string>();
    const results: string[] = [];
    for (const source of sources) {
      const urls = this.normalizeImages(source);
      for (const url of urls) {
        if (!seen.has(url)) {
          seen.add(url);
          results.push(url);
        }
      }
    }
    return results;
  }

  private extractImagesFromDom(document: Document): string[] {
    const seen = new Set<string>();
    const results: string[] = [];

    const addUrl = (url?: string | null) => {
      if (!url) return;
      if (url.startsWith("http") && !seen.has(url)) {
        seen.add(url);
        results.push(url);
      }
    };

    const selectors = [
      '.detail-multimedia img',
      '[class*="gallery"] img',
      '[data-testid="gallery"] img',
      '[class*="carousel"] img',
      '[class*="slider"] img',
      '[class*="photo"] img',
      '[class*="image"] img',
      'img[src*="idealista"]',
      'img[src*="img3.idealista"]',
    ];

    for (const selector of selectors) {
      for (const img of document.querySelectorAll(selector)) {
        const src =
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy-src") ||
          img.getAttribute("data-original") ||
          img.getAttribute("src");
        addUrl(src);

        const srcset = img.getAttribute("srcset");
        if (srcset) {
          const urls = srcset.split(",").map((s) => s.trim().split(" ")[0]);
          for (const u of urls) addUrl(u);
        }
      }
    }

    for (const el of document.querySelectorAll('[style*="background-image"]')) {
      const style = el.getAttribute("style") || "";
      const match = style.match(/url\(["']?([^"')]+)["']?\)/);
      addUrl(match?.[1]);
    }

    for (const script of document.querySelectorAll('script[type="application/json"], script[id*="data"], script:not([src])')) {
      const text = script.textContent || "";
      const urls = text.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi) || [];
      for (const u of urls) addUrl(u);
    }

    return results;
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

    // 2. Check for JSON-LD with geo but different structure
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

    // 3. Check for meta tags with various names
    const getMeta = (name: string) =>
      document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content");
    const metaLat = parseFloat(getMeta("og:latitude") || getMeta("latitude") || "");
    const metaLng = parseFloat(getMeta("og:longitude") || getMeta("longitude") || "");
    if (!isNaN(metaLat) && !isNaN(metaLng) && metaLat !== 0 && metaLng !== 0) {
      return { latitude: metaLat, longitude: metaLng };
    }

    return {};
  }

  private extractListingDate(document: Document): { isoDate: string; sourceText: string } | undefined {
    const bodyText = document.body.textContent?.replace(/\s+/g, " ") || "";
    const match = bodyText.match(/Anuncio actualizado el\s+(\d{1,2})\s+de\s+([a-záéíóúñ]+)/i);
    if (!match) return undefined;

    const [, day, monthName] = match;
    const month = this.parseSpanishMonth(monthName);
    if (month == null) return undefined;

    const now = new Date();
    let year = now.getFullYear();
    const parsed = new Date(year, month, parseInt(day, 10), 12);

    if (parsed.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
      year -= 1;
      parsed.setFullYear(year);
    }

    return {
      isoDate: parsed.toISOString(),
      sourceText: match[0],
    };
  }

  private parseSpanishMonth(month: string): number | undefined {
    const months: Record<string, number> = {
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      setiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11,
    };

    return months[month.toLowerCase()];
  }
}
