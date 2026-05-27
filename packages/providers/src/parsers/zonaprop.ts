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

    const providerListingId =
      jsonLd?.identifier ||
      meta.listingId ||
      dom.listingId ||
      this.extractIdFromUrl(document.URL);

    if (!providerListingId) return null;

    const listingType = this.detectListingType(document.URL);

    return {
      provider: Provider.ZONAPROP,
      providerListingId,
      listingType,
      title: jsonLd?.name ?? meta.title ?? dom.title ?? "",
      description: jsonLd?.description ?? dom.description,
      price: jsonLd?.price ?? meta.price ?? dom.price ?? 0,
      currency: "ARS",
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
          return {
            name: data.name,
            description: data.description,
            price: this.parsePrice(data.price ?? data.offers?.price),
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
      images: this.normalizeImages(getMeta("og:image")),
      listingId: this.extractIdFromMeta(getMeta("og:url")),
      latitude: parseFloat(getMeta("place:location:latitude") || "0") || undefined,
      longitude: parseFloat(getMeta("place:location:longitude") || "0") || undefined,
    };
  }

  private extractFromDom(document: Document) {
    const text = (selector: string) => document.querySelector(selector)?.textContent?.trim();

    const priceText = text('[data-testid="price"]') || text("[class*='price']");
    const titleText = text("h1") || text('[data-testid="title"]');

    const imageElements = document.querySelectorAll('[class*="gallery"] img, [data-testid="gallery"] img');
    const images = Array.from(imageElements)
      .map((img) => img.getAttribute("src") || img.getAttribute("data-src"))
      .filter((src): src is string => !!src && src.startsWith("http"));

    return {
      title: titleText || "",
      description: text("[class*='description']"),
      price: this.parsePrice(priceText),
      bedrooms: this.extractBedrooms(text("[class*='room']") || text("[class*='bed']")),
      bathrooms: this.extractBathrooms(text("[class*='bath']")),
      area: this.parseArea(text("[class*='area']") || text("[class*='surface']")),
      propertyType: text("[class*='type']"),
      address: text('[data-testid="address"]') || text("[class*='address']"),
      city: text("[class*='location']"),
      listingId: document.querySelector('[data-listing-id]')?.getAttribute("data-listing-id"),
      images,
    };
  }

  private detectListingType(url: string): ListingType {
    if (url.includes("/alquiler") || url.includes("/rent")) return ListingType.RENT;
    if (url.includes("/venta") || url.includes("/sale")) return ListingType.BUY;
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

  private parsePrice(value?: string | number | null): number {
    if (!value) return 0;
    if (typeof value === "number") return value;
    const cleaned = value.replace(/[^\d.,]/g, "").replace(",", "");
    const match = cleaned.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
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
