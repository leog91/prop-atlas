import type { ProviderParser, ParsedProperty } from "@prop-atlas/types";
import { Provider, ListingType, PropertyType } from "@prop-atlas/types";

export class ZonapropParser implements ProviderParser {
  readonly name = Provider.ZONAPROP;

  canHandle(url: string): boolean {
    return url.includes("zonaprop.com.ar");
  }

  parse(document: Document): ParsedProperty | null {
    const jsonLd = this.extractJsonLd(document);
    const meta = this.extractMeta(document);
    const dom = this.extractFromDom(document);

    console.log("[ZONAPROP] jsonLd:", JSON.stringify(jsonLd));
    console.log("[ZONAPROP] meta:", JSON.stringify(meta));
    console.log("[ZONAPROP] dom:", JSON.stringify(dom));

    const providerListingId =
      jsonLd?.identifier ||
      meta.listingId ||
      dom.listingId ||
      this.extractIdFromUrl(document.URL);

    if (!providerListingId) {
      console.log("[ZONAPROP] No providerListingId found");
      return null;
    }

    const pageText = (document.body as any)?.innerText ?? document.body?.textContent ?? "";
    const listingType = this.detectListingType(document.URL, pageText);
    const price = jsonLd?.price ?? meta.price ?? dom.price;
    const currency = jsonLd?.currency ?? meta.currency ?? dom.currency ?? "ARS";
    const expenses = jsonLd?.expenses ?? dom.expenses;
    const expensesCurrency = jsonLd?.expensesCurrency ?? dom.expensesCurrency;

    // Prefer numberOfBedrooms over numberOfRooms from JSON-LD
    const bedrooms = jsonLd?.numberOfBedrooms ?? jsonLd?.bedrooms ?? dom.bedrooms;
    const bathrooms = jsonLd?.numberOfBathroomsTotal ?? jsonLd?.bathrooms ?? dom.bathrooms;

    return {
      provider: Provider.ZONAPROP,
      providerListingId,
      listingType,
      title: jsonLd?.name ?? meta.title ?? dom.title ?? "",
      description: jsonLd?.description ?? dom.description,
      price,
      currency,
      expenses,
      expensesCurrency,
      propertyType: this.mapPropertyType(jsonLd?.propertyType ?? dom.propertyType),
      bedrooms,
      bathrooms,
      area: jsonLd?.area ?? dom.area,
      areaUnit: "m²",
      address: jsonLd?.address ?? dom.address,
      city: dom.city,
      country: "Argentina",
      latitude: jsonLd?.latitude ?? meta.latitude,
      longitude: jsonLd?.longitude ?? meta.longitude,
      images: jsonLd?.images ?? meta.images ?? dom.images ?? [],
      url: document.URL,
      listedAt: dom.listedAt,
      floor: dom.floor,
      hasElevator: dom.hasElevator,
      hasParking: dom.hasParking,
      isFurnished: dom.isFurnished,
      rawPayload: { jsonLd, meta, dom, locationLine: dom.locationLine },
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
            currency: this.parseCurrency(item.priceCurrency),
            propertyType: item.accommodationType ?? item.propertyType ?? item["@type"],
            bedrooms: item.numberOfRooms,
            numberOfBedrooms: item.numberOfBedrooms,
            numberOfBathroomsTotal: item.numberOfBathroomsTotal,
            bathrooms: item.numberOfBathroomsTotal,
            area: this.parseArea(item.floorSize?.value),
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
      currency: this.parseCurrency(getMeta("product:price:currency")),
      images: this.normalizeImages(getMeta("og:image")),
      listingId: this.extractIdFromMeta(getMeta("og:url")),
      latitude: parseFloat(getMeta("place:location:latitude") || "0") || undefined,
      longitude: parseFloat(getMeta("place:location:longitude") || "0") || undefined,
    };
  }

  private extractFromDom(document: Document) {
    const text = (selector: string) => document.querySelector(selector)?.textContent?.trim();
    const allText = (selector: string) =>
      Array.from(document.querySelectorAll(selector))
        .map((el) => el.textContent?.trim())
        .filter((t): t is string => !!t);

    const titleText = text("h1") || text('[data-testid="title"]');

    // --- Price: innerText preserves spaces between elements, so it's better for
    //     patterns split across tags (e.g. <span>USD</span> <span>59.000</span>).
    const pageText = (document.body as any)?.innerText ?? document.body?.textContent ?? "";
    console.log("[ZONAPROP] pageText length:", pageText.length, "first 800 chars:", pageText.slice(0, 800));
    const priceText = this.findPriceLikeText(pageText);
    console.log("[ZONAPROP] priceText:", priceText);

    // --- Expenses (expensas): look for "Expensas" followed by a price-like pattern ---
    const expensesMatch = pageText.match(/Expensas\s*[:\-]?\s*(.+?)(?:\n|$)/i);
    console.log("[ZONAPROP] expenses raw match:", expensesMatch?.[1] ?? null);
    const expensesText = expensesMatch?.[1] ? this.findPriceLikeText(expensesMatch[1]) : undefined;
    console.log("[ZONAPROP] expensesText:", expensesText);
    const currencyText = priceText ?? pageText;

    // --- Location: Zonaprop shows the address line right after pricing.
    //     Don't trust the DOM city selector — it often returns the big
    //     municipality ("Quilmes") instead of the actual neighborhood ("Bernal").
    const locationLine = this.findLocationLine(pageText);
    console.log("[ZONAPROP] locationLine:", locationLine);
    const { address, city } = this.parseZonapropLocation(locationLine);
    console.log("[ZONAPROP] parsed address:", address, "city:", city);

    // --- Area: scan all text for "46m²" patterns ---
    let areaText: string | undefined;
    for (const t of allText("*")) {
      if (/\d+\s*m²?/.test(t)) {
        areaText = t;
        break;
      }
    }

    const imageElements = document.querySelectorAll('[class*="gallery"] img, [data-testid="gallery"] img');
    const images = Array.from(imageElements)
      .map((img) => img.getAttribute("src") || img.getAttribute("data-src"))
      .filter((src): src is string => !!src && src.startsWith("http"));

    // Extract floor, elevator, parking, furnished from page text
    const floorMatch = pageText.match(/(\d+ª?\s*(?:planta|piso))/i);
    const hasElevator = /(?:ascensor|elevator)/i.test(pageText);
    const hasParking = /(?:cochera|garaje|estacionamiento|parking)/i.test(pageText);
    const isFurnished = /(?:amoblado|amueblado|furnished)/i.test(pageText);

    // Listed date
    const listedAtMatch = pageText.match(/Publicado\s+hace\s+(\d+)\s+(?:día|días|mes|meses)/i);

    return {
      title: titleText || "",
      description: text("[class*='description']"),
      price: this.parsePrice(priceText),
      currency: this.parseCurrency(currencyText),
      expenses: this.parsePrice(expensesText),
      expensesCurrency: this.parseCurrency(expensesText) ?? this.parseCurrency(expensesMatch?.[1] ?? ""),
      bedrooms: this.extractBedrooms(text("[class*='room']") || text("[class*='bed']")),
      bathrooms: this.extractBathrooms(text("[class*='bath']")),
      area: this.parseArea(text("[class*='area']") || text("[class*='surface']") || areaText),
      propertyType: text("[class*='type']"),
      address,
      city,
      locationLine,
      floor: floorMatch ? floorMatch[1] : undefined,
      hasElevator: hasElevator || undefined,
      hasParking: hasParking || undefined,
      isFurnished: isFurnished || undefined,
      listedAt: listedAtMatch ? listedAtMatch[0] : undefined,
      listingId: document.querySelector('[data-listing-id]')?.getAttribute("data-listing-id"),
      images,
    };
  }

  private findLocationLine(pageText: string): string | undefined {
    const lines = pageText.split("\n").map((l) => l.trim()).filter(Boolean);
    let passedPrice = false;
    for (const line of lines) {
      // Skip until we see the price line
      if (!passedPrice) {
        if (this.findPriceLikeText(line)) passedPrice = true;
        continue;
      }
      // Skip known non-location patterns
      if (/^avisarme si baja/i.test(line)) continue;
      if (/^publicidad$/i.test(line)) continue;
      if (/^garantías/i.test(line)) continue;
      if (/^solicitá/i.test(line)) continue;
      if (/^100\s*%/i.test(line)) continue;
      if (/^contactar/i.test(line)) continue;
      if (/^ver teléfono/i.test(line)) continue;
      if (/^acepto/i.test(line)) continue;
      if (/^términos/i.test(line)) continue;
      if (/^política/i.test(line)) continue;
      if (/^compartir$/i.test(line)) continue;
      if (/^notas personales/i.test(line)) continue;
      if (/^ocultar aviso/i.test(line)) continue;
      if (/^favorito$/i.test(line)) continue;
      if (/^ver todas las fotos/i.test(line)) continue;
      if (/^departamento\s*·/i.test(line)) continue;
      if (/^local comercial\s*·/i.test(line)) continue;
      if (/^casa\s*·/i.test(line)) continue;
      if (/^oficina\s*·/i.test(line)) continue;
      if (/^ph\s*·/i.test(line)) continue;
      if (/^terreno\s*·/i.test(line)) continue;
      // Area specs start with numbers + units
      if (/^\d+\s*m²/i.test(line)) continue;
      if (/^\d+\s*(tot\.|cub\.|amb\.|baño|dorm\.)/i.test(line)) continue;
      // Location line must contain a comma and look like an address
      if (line.includes(",") && /[a-záéíóúñ]/i.test(line) && line.length > 10 && line.length < 120) {
        return line;
      }
    }
    return undefined;
  }

  private parseZonapropLocation(locationText?: string): { address?: string; city?: string } {
    if (!locationText) return {};
    // Zonaprop format: "Street Number, Neighborhood, Municipality" or "Street Number, City, Province, Country"
    // e.g. "Belgrano al 300, Bernal Este, Quilmes" (street, neighborhood, parent municipality)
    //      "Alvear 709, Quilmes, Buenos Aires, Argentina., Quilmes, Quilmes"
    let parts = locationText.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return {};
    if (parts.length === 1) return { city: parts[0] };

    // First part is usually the street address
    const address = parts[0];

    // Strip trailing country/province and generic prefixes
    parts = parts.slice(1); // remove address
    parts = parts.filter((p) => !/^argentina\.?$/i.test(p));
    parts = parts.filter((p) => !/^buenos aires$/i.test(p));
    parts = parts.filter((p) => !/^provincia de buenos aires$/i.test(p));
    parts = parts.map((p) => p.replace(/^barrio\s+/i, "").trim());
    // Remove exact duplicates that appear consecutively
    parts = parts.filter((p, i) => i === 0 || p.toLowerCase() !== parts[i - 1].toLowerCase());

    if (parts.length === 0) return { address };

    // Heuristic: for Argentina, the most useful city for geocoding is the
    // *most specific* place before the parent municipality.
    // "Belgrano al 300, Bernal Este, Quilmes" → "Bernal Este" (not "Quilmes")
    // "Alvear 709, Quilmes" → "Quilmes"
    // Prefer the second-to-last remaining part when there are 2+ parts,
    // because the last part is often the broad municipality.
    const city = parts.length >= 2 ? parts[parts.length - 2] : parts[parts.length - 1];

    return { address, city: city || undefined };
  }

  private detectListingType(url: string, pageText?: string): ListingType {
    if (url.includes("/alquiler") || url.includes("/rent")) return ListingType.RENT;
    if (url.includes("/venta") || url.includes("/sale")) return ListingType.BUY;
    // URLs like /propiedades/clasificado/... don't indicate operation type;
    // Scan the rendered page text (innerText) but only the first ~2000 chars
    // where the listing header lives. Footers and related listings further down
    // can contain "venta" and cause false positives.
    if (pageText) {
      const window = pageText.slice(0, 2000);
      if (/\bAlquiler\b/.test(window)) return ListingType.RENT;
      if (/\bVenta\b/.test(window)) return ListingType.BUY;
    }
    return ListingType.RENT;
  }

  private mapPropertyType(type?: string): PropertyType {
    if (!type) return PropertyType.OTHER;
    const lower = type.toLowerCase();
    if (lower.includes("apartment") || lower.includes("departamento")) return PropertyType.APARTMENT;
    if (lower.includes("house") || lower.includes("casa")) return PropertyType.HOUSE;
    if (lower.includes("studio") || lower.includes("monoambiente")) return PropertyType.STUDIO;
    if (lower.includes("room") || lower.includes("habitaci")) return PropertyType.ROOM;
    if (lower.includes("ph")) return PropertyType.HOUSE;
    if (lower.includes("terreno") || lower.includes("land")) return PropertyType.LAND;
    if (lower.includes("local") || lower.includes("comercial")) return PropertyType.COMMERCIAL;
    return PropertyType.OTHER;
  }

  private findPriceLikeText(text?: string): string | undefined {
    if (!text) return undefined;
    // Look for patterns like "USD 59.000", "U$S 59.000", "$ 120.000", "59.000 USD"
    const match = text.match(/(?:USD|U\$S|US\$|\$)\s*[\d.,]+|[\d.,]+\s*(?:USD|U\$S|US\$)/i);
    return match ? match[0] : undefined;
  }

  private parseCurrency(value?: string | null): string | undefined {
    if (!value) return undefined;
    const upper = value.toUpperCase();
    if (upper.includes("USD") || upper.includes("U$S") || upper.includes("US$")) return "USD";
    if (upper.includes("ARS") || upper.includes("$")) return "ARS";
    return undefined;
  }

  private parsePrice(value?: string | number | null): number | undefined {
    if (value == null) return undefined;
    if (typeof value === "number") return value || undefined;

    const cleaned = value.replace(/[^\d.,]/g, "");
    if (!cleaned) return undefined;

    const hasComma = cleaned.includes(",");
    const hasDot = cleaned.includes(".");

    if (hasComma && hasDot) {
      // Mixed: e.g. 1.200.000,50 → Spanish style (comma = decimal, dots = thousands)
      const [intPart, decPart] = cleaned.split(",");
      const integer = intPart.replace(/\./g, "");
      const numStr = decPart ? `${integer}.${decPart}` : integer;
      const num = parseFloat(numStr);
      return isNaN(num) ? undefined : num;
    }

    if (hasComma && !hasDot) {
      // Only commas: could be 1,200 (US thousands) or 1,50 (Spanish decimal)
      const parts = cleaned.split(",");
      if (parts.length === 2 && parts[1].length <= 2) {
        // Spanish decimal: 1200,50
        const num = parseFloat(`${parts[0]}.${parts[1]}`);
        return isNaN(num) ? undefined : num;
      }
      // US thousands: 1,200,000
      const num = parseFloat(cleaned.replace(/,/g, ""));
      return isNaN(num) ? undefined : num;
    }

    if (hasDot && !hasComma) {
      // Only dots: could be 1.200 (Spanish thousands) or 1.50 (US decimal)
      const parts = cleaned.split(".");
      // Spanish: every segment after the first is exactly 3 digits (1.200.000 or 73.000)
      if (parts.length >= 2 && parts.slice(1).every((p) => p.length === 3)) {
        const num = parseFloat(cleaned.replace(/\./g, ""));
        return isNaN(num) ? undefined : num;
      }
      // US decimal: 1.50
      const num = parseFloat(cleaned);
      return isNaN(num) ? undefined : num;
    }

    // No separators
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  private parseArea(value?: string | number | null): number | undefined {
    if (!value) return undefined;
    if (typeof value === "number") return value;
    const match = value.replace(/[^\d.]/g, "").match(/[\d.]+/);
    return match ? parseFloat(match[0]) : undefined;
  }

  private extractBedrooms(text?: string | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }

  private extractBathrooms(text?: string | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)/);
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
    return [address.streetAddress, address.addressLocality].filter(Boolean).join(", ");
  }

  private extractIdFromUrl(url: string): string {
    const match = url.match(/-(\d+)\.html/i) || url.match(/\/(\d+)(?:\?|$|#)/);
    return match ? match[1] : url.split("/").pop()?.replace(/\..*$/, "") || "";
  }

  private extractIdFromMeta(url?: string | null): string | undefined {
    if (!url) return undefined;
    return this.extractIdFromUrl(url);
  }
}
