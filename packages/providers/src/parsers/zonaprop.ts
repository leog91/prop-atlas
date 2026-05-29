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

    const listingType = this.detectListingType(document.URL, document);
    const price = jsonLd?.price ?? meta.price ?? dom.price;
    const currency = jsonLd?.currency ?? meta.currency ?? dom.currency ?? "ARS";

    console.log("[ZONAPROP] resolved price:", price, "currency:", currency, "listingType:", listingType);

    return {
      provider: Provider.ZONAPROP,
      providerListingId,
      listingType,
      title: jsonLd?.name ?? meta.title ?? dom.title ?? "",
      description: jsonLd?.description ?? dom.description,
      price,
      currency,
      propertyType: this.mapPropertyType(jsonLd?.propertyType ?? dom.propertyType),
      bedrooms: jsonLd?.bedrooms ?? dom.bedrooms,
      bathrooms: jsonLd?.bathrooms ?? dom.bathrooms,
      area: jsonLd?.area ?? dom.area,
      areaUnit: "m²",
      address: jsonLd?.address ?? dom.address,
      city: dom.city,
      country: "Argentina",
      latitude: jsonLd?.latitude ?? meta.latitude,
      longitude: jsonLd?.longitude ?? meta.longitude,
      images: jsonLd?.images ?? meta.images ?? dom.images ?? [],
      url: document.URL,
      rawPayload: { jsonLd, meta, dom },
    };
  }

  private extractJsonLd(document: Document): Record<string, any> | null {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "");
        if (data["@type"] === "Residence" || data["@type"] === "RealEstateListing" || data["@type"] === "Place") {
          const offer = data.offers || data;
          return {
            name: data.name,
            description: data.description,
            price: this.parsePrice(offer.price),
            currency: this.parseCurrency(offer.priceCurrency),
            propertyType: data.accommodationType ?? data.propertyType,
            bedrooms: data.numberOfRooms,
            bathrooms: data.numberOfBathroomsTotal,
            area: this.parseArea(data.floorSize?.value),
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
    console.log("[ZONAPROP] pageText length:", pageText.length, "first 500 chars:", pageText.slice(0, 500));
    const priceText = this.findPriceLikeText(pageText);
    console.log("[ZONAPROP] priceText:", priceText);
    const currencyText = priceText ?? pageText;

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

    return {
      title: titleText || "",
      description: text("[class*='description']"),
      price: this.parsePrice(priceText),
      currency: this.parseCurrency(currencyText),
      bedrooms: this.extractBedrooms(text("[class*='room']") || text("[class*='bed']")),
      bathrooms: this.extractBathrooms(text("[class*='bath']")),
      area: this.parseArea(text("[class*='area']") || text("[class*='surface']") || areaText),
      propertyType: text("[class*='type']"),
      address: text('[data-testid="address"]') || text("[class*='address']"),
      city: text("[class*='location']"),
      listingId: document.querySelector('[data-listing-id]')?.getAttribute("data-listing-id"),
      images,
    };
  }

  private detectListingType(url: string, document?: Document): ListingType {
    if (url.includes("/alquiler") || url.includes("/rent")) return ListingType.RENT;
    if (url.includes("/venta") || url.includes("/sale")) return ListingType.BUY;
    // URLs like /propiedades/clasificado/... don't indicate operation type;
    // fall back to scanning the page text.
    // Note: "Alquilar" appears in the nav menu of every page, so we can't use
    // simple indexOf. We look for "venta" in the actual listing content.
    if (document) {
      const bodyText = document.body?.textContent?.toLowerCase() ?? "";
      if (bodyText.includes("venta")) return ListingType.BUY;
      if (bodyText.includes("alquiler")) return ListingType.RENT;
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
