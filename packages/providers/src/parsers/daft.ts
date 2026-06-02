import type { ProviderParser, ParsedProperty } from "@prop-atlas/types";
import { Provider, ListingType, PropertyType } from "@prop-atlas/types";

export class DaftParser implements ProviderParser {
  readonly name = Provider.DAFT;

  canHandle(url: string): boolean {
    return url.includes("daft.ie");
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

    const listingType = this.detectListingType(document.URL, meta);
    const price = nextData?.price ?? jsonLd?.price ?? meta.price ?? dom.price;
    const title = nextData?.title ?? jsonLd?.name ?? meta.title ?? dom.title ?? "";
    const rawImages = this.collectImages([
      nextData?.images,
      jsonLd?.images,
      meta.images,
      dom.images,
    ]);
    const images = this.dedupeAndFilterDaftImages(rawImages);

    return {
      provider: Provider.DAFT,
      providerListingId,
      listingType,
      title,
      description: nextData?.description ?? jsonLd?.description ?? dom.description,
      price,
      currency: "EUR",
      propertyType: this.mapPropertyType(nextData?.propertyType ?? jsonLd?.propertyType ?? dom.propertyType),
      bedrooms: nextData?.bedrooms ?? jsonLd?.bedrooms ?? dom.bedrooms,
      bathrooms: nextData?.bathrooms ?? jsonLd?.bathrooms ?? dom.bathrooms,
      area: nextData?.area ?? jsonLd?.area ?? dom.area,
      areaUnit: "sqft",
      address: nextData?.address ?? jsonLd?.address ?? dom.address,
      city: nextData?.city ?? dom.city,
      country: "Ireland",
      latitude: nextData?.latitude ?? jsonLd?.latitude ?? meta.latitude,
      longitude: nextData?.longitude ?? jsonLd?.longitude ?? meta.longitude,
      images,
      url: document.URL,
      listedAt: dom.listedAt,
      views: dom.views,
      deposit: nextData?.deposit ?? dom.deposit,
      depositCurrency: (nextData?.deposit ?? dom.deposit) ? "EUR" : undefined,
      floor: nextData?.floor ?? dom.floor,
      hasElevator: nextData?.hasElevator ?? dom.hasElevator,
      hasParking: nextData?.hasParking ?? dom.hasParking,
      isFurnished: nextData?.isFurnished ?? dom.isFurnished,
      rawPayload: { nextData, jsonLd, meta, dom },
    };
  }

  private extractNextData(document: Document): Record<string, any> | null {
    const script = document.querySelector('#__NEXT_DATA__');
    if (!script?.textContent) return null;

    try {
      const data = JSON.parse(script.textContent);
      const pageProps = data?.props?.pageProps ?? data;

      // Daft embeds listing data in various paths; try the most common ones
      const listing =
        pageProps?.listing ??
        pageProps?.targetPageProps?.listingDetails ??
        pageProps?.data ??
        pageProps?.property ??
        pageProps?.ad ??
        this.findListingObject(pageProps);

      if (!listing || typeof listing !== "object") return null;

      // Deep-search for image arrays/URLs inside the listing object
      const foundImages = this.deepFindImages(listing);

      return {
        listingId: String(listing.id ?? listing.listingId ?? listing.identifier ?? ""),
        title: listing.title ?? listing.name ?? listing.heading,
        description: listing.description ?? listing.metaDescription,
        price: this.parsePrice(listing.price ?? listing.monthlyRent ?? listing.rent),
        propertyType: listing.propertyType ?? listing.type ?? listing.category,
        bedrooms: listing.bedrooms ?? listing.beds ?? listing.numberOfBedrooms ?? this.extractBedrooms(listing.description),
        bathrooms: listing.bathrooms ?? listing.baths ?? listing.numberOfBathrooms,
        area: this.parseArea(listing.floorArea ?? listing.area ?? listing.squareFeet ?? listing.size),
        address: listing.displayAddress ?? listing.address ?? this.formatAddress(listing.location ?? listing.address),
        city: listing.town ?? listing.city ?? listing.addressLocality,
        latitude: listing.latitude ?? listing.lat ?? listing.geo?.latitude,
        longitude: listing.longitude ?? listing.lng ?? listing.lon ?? listing.geo?.longitude,
        images: foundImages.length > 0 ? foundImages : undefined,
        deposit: this.parsePrice(listing.deposit ?? listing.securityDeposit),
        floor: listing.floor ?? listing.floorNumber,
        hasElevator: listing.hasElevator ?? listing.lift ?? listing.elevator,
        hasParking: listing.hasParking ?? listing.parking ?? listing.garage,
        isFurnished: listing.isFurnished ?? listing.furnished,
      };
    } catch (e) {
      console.error('[DAFT] Failed to parse __NEXT_DATA__:', e);
      return null;
    }
  }

  private findListingObject(obj: any): any {
    if (!obj || typeof obj !== "object") return null;
    if (obj.id && (obj.images || obj.photos || obj.media || obj.gallery || obj.image)) return obj;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val && typeof val === "object") {
        const found = this.findListingObject(val);
        if (found) return found;
      }
    }
    return null;
  }

  private deepFindImages(obj: any): string[] {
    const seen = new Set<string>();
    const results: string[] = [];

    const isImageUrl = (val: any): boolean => {
      return typeof val === "string" && val.startsWith("http") && /\.(jpg|jpeg|png|webp)/i.test(val);
    };

    const addUrl = (val: any) => {
      if (!isImageUrl(val)) return;
      if (!seen.has(val)) {
        seen.add(val);
        results.push(val);
      }
    };

    const traverse = (current: any) => {
      if (!current || typeof current !== "object") return;
      if (Array.isArray(current)) {
        for (const item of current) {
          if (isImageUrl(item)) {
            addUrl(item);
          } else if (typeof item === "object") {
            traverse(item);
          }
        }
        return;
      }
      for (const [key, val] of Object.entries(current)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey === "image" ||
          lowerKey === "images" ||
          lowerKey === "photo" ||
          lowerKey === "photos" ||
          lowerKey === "picture" ||
          lowerKey === "pictures" ||
          lowerKey === "media" ||
          lowerKey === "gallery" ||
          lowerKey === "src" ||
          lowerKey === "url" ||
          lowerKey === "urls" ||
          lowerKey === "uri" ||
          lowerKey === "uris"
        ) {
          if (Array.isArray(val)) {
            for (const item of val) addUrl(item);
          } else if (typeof val === "object" && val !== null) {
            traverse(val);
          } else {
            addUrl(val);
          }
        } else if (typeof val === "object" && val !== null) {
          traverse(val);
        }
      }
    };

    traverse(obj);
    return this.dedupeAndFilterDaftImages(results);
  }

  private dedupeAndFilterDaftImages(urls: string[]): string[] {
    // Group images by their underlying S3 key, keep the largest variant,
    // and filter out thumbnails, avatars, and profile placeholders.
    const groups = new Map<string, { width: number; height: number; url: string }[]>();

    for (const rawUrl of urls) {
      let url = rawUrl;

      // Unwrap Next.js _next/image optimizer URLs
      if (url.includes("_next/image")) {
        try {
          const u = new URL(url);
          const wrapped = u.searchParams.get("url");
          if (wrapped) url = decodeURIComponent(wrapped);
        } catch {}
      }

      // Only process media.daft.ie URLs
      if (!url.includes("media.daft.ie/")) continue;

      const parts = url.split("media.daft.ie/");
      if (parts.length < 2) continue;
      const b64Part = parts[1].split("?")[0];

      try {
        const pad = 4 - (b64Part.length % 4);
        const padded = pad === 4 ? b64Part : b64Part + "=".repeat(pad);
        const decoded = JSON.parse(atob(padded));
        const key: string = decoded.key || "";
        const resize = decoded.edits?.resize || {};
        const width = resize.width || resize.w || 0;
        const height = resize.height || resize.h || 0;

        // Skip known non-property images
        const keyLower = key.toLowerCase();
        if (
          keyLower.includes("profile") ||
          keyLower.includes("avatar") ||
          keyLower.includes("_standard") ||
          keyLower.includes("no-profile") ||
          keyLower.includes("agent") ||
          keyLower.includes("logo") ||
          keyLower.includes("watermark")
        ) {
          continue;
        }

        // Skip tiny thumbnails (nav thumbs, agent icons, etc.)
        if (width > 0 && width < 150) continue;
        if (height > 0 && height < 100) continue;

        const list = groups.get(key) || [];
        list.push({ width, height, url: rawUrl });
        groups.set(key, list);
      } catch {
        // If we can't decode, keep the URL as a fallback
        const list = groups.get(url) || [];
        list.push({ width: 0, height: 0, url: rawUrl });
        groups.set(url, list);
      }
    }

    // For each key, pick the largest image by pixel area
    const bestUrls: string[] = [];
    for (const [, variants] of groups) {
      const best = variants.reduce((a, b) =>
        a.width * a.height >= b.width * b.height ? a : b
      );
      bestUrls.push(best.url);
    }

    return bestUrls;
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
          const item = Array.isArray(data) ? data.find((d) => d["@type"] !== "BreadcrumbList") : data;
          if (!item) continue;
          return {
            name: item.name,
            description: item.description,
            price: this.parsePrice(item.price ?? item.offers?.price),
            propertyType: item.accommodationType ?? item.propertyType ?? item["@type"],
            bedrooms: item.numberOfRooms ?? this.extractBedrooms(item.description),
            bathrooms: item.numberOfBathroomsTotal ?? this.extractBathrooms(item.description),
            area: this.parseArea(item.floorSize?.value),
            address: this.formatAddress(item.address),
            latitude: item.geo?.latitude,
            longitude: item.geo?.longitude,
            images: this.normalizeImages(item.image ?? item.photo),
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

    const images = this.extractImagesFromDom(document);

    const pageText = (document.body as any)?.innerText ?? "";

    // Extract new fields from DOM text
    const depositMatch = pageText.match(/deposit[\s:]*€?([\d,.]+)/i);
    const floorMatch = pageText.match(/(?:first|second|third|fourth|fifth|sixth|ground)\s+floor/i);
    const hasElevator = /elevator|lift/i.test(pageText);
    const hasParking = /(?:parking|garage|car\s+space)/i.test(pageText);
    const isFurnished = /(?:furnished|fully\s+furnished)/i.test(pageText);

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
      deposit: depositMatch ? this.parsePrice(depositMatch[1]) : undefined,
      floor: floorMatch ? floorMatch[0] : undefined,
      hasElevator: hasElevator || undefined,
      hasParking: hasParking || undefined,
      isFurnished: isFurnished || undefined,
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

    // 1. Standard img tags with various lazy-load attributes
    const selectors = [
      '[data-testid="gallery-image"] img',
      '.Gallery img',
      '[class*="gallery"] img',
      '[class*="carousel"] img',
      '[class*="slider"] img',
      '[class*="photo"] img',
      '[class*="image"] img',
      'img[src*="daftcdn"]',
      'img[src*="media.daft"]',
    ];

    for (const selector of selectors) {
      for (const img of document.querySelectorAll(selector)) {
        const src =
          img.getAttribute("data-src") ||
          img.getAttribute("data-lazy-src") ||
          img.getAttribute("data-original") ||
          img.getAttribute("src");
        addUrl(src);

        // Parse srcset for additional URLs
        const srcset = img.getAttribute("srcset");
        if (srcset) {
          const urls = srcset.split(",").map((s) => s.trim().split(" ")[0]);
          for (const u of urls) addUrl(u);
        }
      }
    }

    // 2. Background images from inline styles (common in some gallery implementations)
    for (const el of document.querySelectorAll('[style*="background-image"]')) {
      const style = el.getAttribute("style") || "";
      const match = style.match(/url\(["']?([^"')]+)["']?\)/);
      addUrl(match?.[1]);
    }

    // 3. Look for image URLs in script/json data (some sites embed galleries in JSON)
    for (const script of document.querySelectorAll('script[type="application/json"], script[id*="data"]')) {
      const text = script.textContent || "";
      const urls = text.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/gi) || [];
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
