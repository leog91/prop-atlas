import type { ProviderParser, ParsedProperty } from "@prop-atlas/types";
import { Provider, ListingType, PropertyType } from "@prop-atlas/types";

export class DaftParser implements ProviderParser {
  readonly name = Provider.DAFT;

  canHandle(url: string): boolean {
    return url.includes("daft.ie");
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

    const listingType = this.detectListingType(document.URL, meta);
    const price = jsonLd?.price || meta.price || dom.price;
    const title = jsonLd?.name || meta.title || dom.title || "";
    const images = (jsonLd?.images?.length ? jsonLd.images : null) || 
                   (meta.images?.length ? meta.images : null) || 
                   (dom.images?.length ? dom.images : null) || [];

    return {
      provider: Provider.DAFT,
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
      areaUnit: "sqft",
      address: jsonLd?.address ?? dom.address,
      city: dom.city,
      country: "Ireland",
      latitude: jsonLd?.latitude ?? meta.latitude,
      longitude: jsonLd?.longitude ?? meta.longitude,
      images,
      url: document.URL,
      listedAt: dom.listedAt,
      views: dom.views,
      rawPayload: { jsonLd, meta, dom },
    };
  }

  private extractJsonLd(document: Document): Record<string, any> | null {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || "");
        if (data["@type"] === "Residence" || data["@type"] === "RealEstateListing" || data["@type"] === "Place") {
          return {
            name: data.name,
            description: data.description,
            price: this.parsePrice(data.price ?? data.offers?.price),
            propertyType: data.accommodationType ?? data.propertyType,
            bedrooms: data.numberOfRooms ?? this.extractBedrooms(data.description),
            bathrooms: data.numberOfBathroomsTotal ?? this.extractBathrooms(data.description),
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
      price: this.parsePrice(getMeta("product:price:amount") || getMeta("og:price")),
      images: this.normalizeImages(getMeta("og:image")),
      listingId: getMeta("daft:listing_id") || this.extractIdFromMeta(getMeta("og:url")),
      latitude: parseFloat(getMeta("place:location:latitude") || "0") || undefined,
      longitude: parseFloat(getMeta("place:location:longitude") || "0") || undefined,
    };
  }

  private extractFromDom(document: Document) {
    const text = (selector: string) => document.querySelector(selector)?.textContent?.trim();
    const attr = (selector: string, attribute: string) => document.querySelector(selector)?.getAttribute(attribute);

    const priceText = text('[data-testid="price"]') || text(".Price") || text("[class*='price']");
    const titleText = text("h1") || text('[data-testid="title"]');
    const descriptionText = text('[data-testid="description"]') || text("[class*='description']");

    const imageElements = document.querySelectorAll('[data-testid="gallery-image"] img, .Gallery img, [class*="gallery"] img');
    const images = Array.from(imageElements)
      .map((img) => img.getAttribute("src") || img.getAttribute("data-src"))
      .filter((src): src is string => !!src && src.startsWith("http"));

    return {
      title: titleText || "",
      description: descriptionText,
      price: this.parsePrice(priceText),
      bedrooms: this.extractBedrooms(text("[class*='bed']") || text('[data-testid="bedrooms"]')),
      bathrooms: this.extractBathrooms(text("[class*='bath']") || text('[data-testid="bathrooms"]')),
      area: this.parseArea(text("[class*='area']") || text('[data-testid="floor-area"]')),
      propertyType: text("[class*='property-type']") || text('[data-testid="property-type"]'),
      address: text('[data-testid="address"]') || text("[class*='address']"),
      city: text('[data-testid="city"]'),
      listingId: attr('[data-listing-id]', "data-listing-id"),
      listedAt: this.extractListedDate(document),
      views: this.extractViews(document),
      images,
    };
  }

  private detectListingType(url: string, _meta: { title?: string | null }): ListingType {
    if (url.includes("/for-rent") || url.includes("/to-rent") || url.includes("/sharing")) {
      return ListingType.RENT;
    }
    if (url.includes("/for-sale") || url.includes("/to-sale")) {
      return ListingType.BUY;
    }
    return ListingType.RENT;
  }

  private mapPropertyType(type?: string): PropertyType {
    if (!type) return PropertyType.OTHER;
    const lower = type.toLowerCase();
    if (lower.includes("apartment") || lower.includes("apt")) return PropertyType.APARTMENT;
    if (lower.includes("house") || lower.includes("detached") || lower.includes("semi")) return PropertyType.HOUSE;
    if (lower.includes("studio")) return PropertyType.STUDIO;
    if (lower.includes("room") || lower.includes("sharing")) return PropertyType.ROOM;
    return PropertyType.OTHER;
  }

  private parsePrice(value?: string | number | null): number | undefined {
    if (value == null) return undefined;
    if (typeof value === "number") return value || undefined;
    const match = value.replace(/[^\d.]/g, "").match(/[\d.]+/);
    return match ? parseFloat(match[0]) : undefined;
  }

  private parseArea(value?: string | number | null): number | undefined {
    if (!value) return undefined;
    if (typeof value === "number") return value;
    const match = value.replace(/[^\d.]/g, "").match(/[\d.]+/);
    return match ? parseFloat(match[0]) : undefined;
  }

  private extractBedrooms(text?: string | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)\s*(bed|bedroom)/i);
    return match ? parseInt(match[1]) : undefined;
  }

  private extractBathrooms(text?: string | null): number | undefined {
    if (!text) return undefined;
    const match = text.match(/(\d+)\s*(bath|bathroom)/i);
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
    const match = url.match(/\/(\d+)(?:\?|$|#)/);
    return match ? match[1] : url.split("/").pop() || "";
  }

  private extractIdFromMeta(url?: string | null): string | undefined {
    if (!url) return undefined;
    return this.extractIdFromUrl(url);
  }

  private extractListedDate(document: Document): string | undefined {
    const allElements = document.querySelectorAll("li, dt, dd, [class*='label'], [class*='title'], p, span");
    for (const element of allElements) {
      const text = element.textContent?.trim() || "";
      const match = text.match(/date\s*listed\s*[:\-]?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  private extractViews(document: Document): number | undefined {
    const allElements = document.querySelectorAll("li, dt, dd, [class*='label'], [class*='title'], p, span");
    for (const element of allElements) {
      const text = element.textContent?.trim() || "";
      const match = text.match(/views?\s*[:\-]?\s*([\d,]+)/i);
      if (match) {
        const views = match[1].replace(/,/g, "");
        return parseInt(views);
      }
    }
    return undefined;
  }
}
