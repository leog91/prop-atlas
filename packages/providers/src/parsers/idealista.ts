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

    return {
      provider: Provider.IDEALISTA,
      providerListingId,
      listingType,
      title,
      description: jsonLd?.description ?? dom.description,
      price,
      currency: country === "Portugal" ? "EUR" : "EUR",
      propertyType: this.mapPropertyType(jsonLd?.propertyType ?? dom.propertyType),
      bedrooms: jsonLd?.bedrooms ?? dom.bedrooms,
      bathrooms: jsonLd?.bathrooms ?? dom.bathrooms,
      area: jsonLd?.area ?? dom.area,
      areaUnit: "m²",
      address: jsonLd?.address ?? dom.address,
      city: dom.city,
      country,
      postalCode: dom.postalCode,
      latitude: jsonLd?.latitude ?? meta.latitude,
      longitude: jsonLd?.longitude ?? meta.longitude,
      images,
      url: document.URL,
      rawPayload: { jsonLd, meta, dom },
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

    return {
      title: titleText || "",
      description: descriptionText,
      price: this.parsePrice(priceText),
      bedrooms: this.extractBedrooms(featuresText) ?? this.extractFromInfoData(document, "rooms"),
      bathrooms: this.extractBathrooms(featuresText) ?? this.extractFromInfoData(document, "bathrooms"),
      area: this.parseArea(text("[class*='area']") || text(".info-data-feature")),
      propertyType: text("[class*='property-type']") || text(".detail-type"),
      address: text('[data-testid="address"]') || text(".detail-location"),
      city: text(".detail-location-city"),
      postalCode: text("[class*='postal-code']"),
      listingId: attr('[data-listing-id]', "data-listing-id") || attr('[data-element-id]', "data-element-id"),
      images,
    };
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

  private parsePrice(value?: string | number | null): number {
    if (!value) return 0;
    if (typeof value === "number") return value;
    const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
    const match = cleaned.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
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
}
