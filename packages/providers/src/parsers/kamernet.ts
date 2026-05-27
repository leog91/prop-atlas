import type { ProviderParser, ParsedProperty } from "@prop-atlas/types";
import { Provider, ListingType, PropertyType } from "@prop-atlas/types";

export class KamernetParser implements ProviderParser {
  readonly name = Provider.KAMERNET;

  canHandle(url: string): boolean {
    return url.includes("kamernet.nl");
  }

  parse(document: Document): ParsedProperty | null {
    const nextData = this.extractNextData(document);
    const jsonLd = this.extractJsonLd(document);
    const meta = this.extractMeta(document);
    const dom = this.extractFromDom(document);

    const providerListingId =
      nextData?.listingId ||
      jsonLd?.identifier ||
      meta.listingId ||
      dom.listingId ||
      this.extractIdFromUrl(document.URL);

    if (!providerListingId) return null;

    return {
      provider: Provider.KAMERNET,
      providerListingId,
      listingType: ListingType.RENT,
      title: nextData?.title ?? jsonLd?.name ?? meta.title ?? dom.title ?? "",
      description: nextData?.description ?? jsonLd?.description ?? dom.description,
      price: nextData?.price ?? jsonLd?.price ?? meta.price ?? dom.price ?? 0,
      currency: "EUR",
      propertyType: nextData?.propertyType ?? this.mapPropertyType(jsonLd?.propertyType ?? dom.propertyType),
      bedrooms: jsonLd?.bedrooms ?? dom.bedrooms,
      area: nextData?.area ?? jsonLd?.area ?? dom.area,
      areaUnit: "m²",
      address: nextData?.address ?? jsonLd?.address ?? dom.address,
      city: nextData?.city ?? dom.city,
      country: "Netherlands",
      latitude: nextData?.latitude ?? jsonLd?.latitude ?? meta.latitude,
      longitude: nextData?.longitude ?? jsonLd?.longitude ?? meta.longitude,
      images: nextData?.images ?? jsonLd?.images ?? meta.images ?? dom.images ?? [],
      url: document.URL,
      listedAt: nextData?.listedAt,
      rawPayload: { nextData, jsonLd, meta, dom },
    };
  }

  private extractNextData(document: Document): Record<string, any> | null {
    const script = document.querySelector('#__NEXT_DATA__');
    if (!script?.textContent) return null;

    try {
      const data = JSON.parse(script.textContent);
      const listing = data?.props?.pageProps?.targetPageProps?.listingDetails;
      if (!listing) return null;

      const title = listing.dutchTitle || listing.englishTitle;
      const description = listing.dutchDescription || listing.englishDescription;
      const price = listing.rentalPrice;
      const area = listing.surfaceArea;
      const city = listing.computedCityName;
      const street = listing.computedStreetName;
      const address = street && city ? `${street}, ${city}` : city;
      
      const imageIds = listing.imageList || [];
      const images = imageIds.map((id: string) => 
        `https://resources.kamernet.nl/image/${id}`
      );

      const propertyType = this.mapListingTypeId(listing.listingTypeId);
      const latitude = listing.postalCodeLat;
      const longitude = listing.postalCodeLong;
      const listedAt = listing.publishDate;

      return {
        listingId: String(listing.listingId),
        title,
        description,
        price,
        area,
        city,
        address,
        images,
        propertyType,
        latitude,
        longitude,
        listedAt,
      };
    } catch (e) {
      console.error('Failed to parse __NEXT_DATA__:', e);
      return null;
    }
  }

  private mapListingTypeId(typeId: number): PropertyType {
    // Based on Kamernet's listing type IDs
    switch (typeId) {
      case 1: return PropertyType.ROOM;
      case 2: return PropertyType.STUDIO;
      case 3: return PropertyType.APARTMENT;
      case 4: return PropertyType.HOUSE;
      default: return PropertyType.OTHER;
    }
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
      area: this.parseArea(text("[class*='area']") || text("[class*='size']")),
      propertyType: text("[class*='type']"),
      address: text('[data-testid="address"]') || text("[class*='address']"),
      city: text("[class*='city']"),
      listingId: document.querySelector('[data-listing-id]')?.getAttribute("data-listing-id"),
      images,
    };
  }

  private mapPropertyType(type?: string): PropertyType {
    if (!type) return PropertyType.OTHER;
    const lower = type.toLowerCase();
    if (lower.includes("apartment") || lower.includes("appartement")) return PropertyType.APARTMENT;
    if (lower.includes("house") || lower.includes("huis")) return PropertyType.HOUSE;
    if (lower.includes("studio")) return PropertyType.STUDIO;
    if (lower.includes("room") || lower.includes("kamer")) return PropertyType.ROOM;
    return PropertyType.OTHER;
  }

  private parsePrice(value?: string | number | null): number {
    if (!value) return 0;
    if (typeof value === "number") return value;
    const match = value.replace(/[^\d.]/g, "").match(/[\d.]+/);
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
    const match = url.match(/\/(\d+)(?:\?|$|#)/);
    return match ? match[1] : url.split("/").pop() || "";
  }

  private extractIdFromMeta(url?: string | null): string | undefined {
    if (!url) return undefined;
    return this.extractIdFromUrl(url);
  }
}
