// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { JSDOM } from "jsdom";
import { DaftParser } from "../parsers/daft";
import { KamernetParser } from "../parsers/kamernet";
import { IdealistaParser } from "../parsers/idealista";
import { ZonapropParser } from "../parsers/zonaprop";

describe("DaftParser", () => {
  it("should parse listing info from __NEXT_DATA__", () => {
    const parser = new DaftParser();
    const html = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "listing": {
                    "id": 1234567,
                    "title": "Stunning Penthouse Apartment",
                    "description": "Luxurious property with views of Dublin city.",
                    "price": 2500,
                    "propertyType": "apartment",
                    "bedrooms": 3,
                    "bathrooms": 2,
                    "floorArea": 1200,
                    "displayAddress": "Apt 20, Grand Canal, Dublin 2",
                    "town": "Dublin",
                    "latitude": 53.342,
                    "longitude": -6.239,
                    "images": ["https://media.daft.ie/YWJjMTIzP3c9MjAw.jpg"]
                  }
                }
              }
            }
          </script>
        </body>
      </html>
    `;
    const dom = new JSDOM(html, { url: "https://daft.ie/for-rent/apartment-apt-20-grand-canal-dublin-2/1234567" });
    const result = parser.parse(dom.window.document);
    expect(result).not.toBeNull();
    expect(result?.providerListingId).toBe("1234567");
    expect(result?.title).toBe("Stunning Penthouse Apartment");
    expect(result?.price).toBe(2500);
    expect(result?.bedrooms).toBe(3);
    expect(result?.bathrooms).toBe(2);
    expect(result?.area).toBe(1200);
    expect(result?.city).toBe("Dublin");
    expect(result?.images).toContain("https://media.daft.ie/YWJjMTIzP3c9MjAw.jpg");
  });
});

describe("KamernetParser", () => {
  it("should parse listing details from __NEXT_DATA__", () => {
    const parser = new KamernetParser();
    const html = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "targetPageProps": {
                    "listingDetails": {
                      "listingId": 987654,
                      "dutchTitle": "Gezellige studentenkamer in Utrecht",
                      "rentalPrice": 500,
                      "surfaceArea": 18,
                      "computedCityName": "Utrecht",
                      "computedStreetName": "Nobelstraat",
                      "listingTypeId": 1,
                      "postalCodeLat": 52.09,
                      "postalCodeLong": 5.12,
                      "publishDate": "2026-06-02",
                      "deposit": 650,
                      "isFurnished": true,
                      "imageList": ["kamernet-img-abc"]
                    }
                  }
                }
              }
            }
          </script>
        </body>
      </html>
    `;
    const dom = new JSDOM(html, { url: "https://kamernet.nl/details/987654" });
    const result = parser.parse(dom.window.document);
    expect(result).not.toBeNull();
    expect(result?.providerListingId).toBe("987654");
    expect(result?.title).toBe("Gezellige studentenkamer in Utrecht");
    expect(result?.price).toBe(500);
    expect(result?.area).toBe(18);
    expect(result?.city).toBe("Utrecht");
    expect(result?.deposit).toBe(650);
    expect(result?.isFurnished).toBe(true);
    expect(result?.images).toContain("https://resources.kamernet.nl/image/kamernet-img-abc");
  });

  it("should parse current Kamernet listing details shape", () => {
    const parser = new KamernetParser();
    const html = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "targetPageProps": {
                    "listingDetails": {
                      "listingId": 2391417,
                      "englishTitle": "Safe Cozy StudentRoom Amsterdam",
                      "englishDescription": "Looking for a safe, quiet student room.",
                      "listingTypeId": 1,
                      "numOfBedrooms": 2,
                      "computedCityName": "Amsterdam",
                      "computedStreetName": "Fleerde",
                      "surfaceArea": 110,
                      "imageList": ["d21b2edb-d176-4af9-b7ef-cac6f85db04b"],
                      "postalCode": "1102AV",
                      "postalCodeLat": 52.317673,
                      "postalCodeLong": 4.955051,
                      "totalRentalPrice": 1700,
                      "deposit": 2000,
                      "furnishingId": 4,
                      "publishDate": "2026-07-09T18:48:07.853"
                    }
                  }
                }
              }
            }
          </script>
        </body>
      </html>
    `;
    const dom = new JSDOM(html, { url: "https://kamernet.nl/en/for-rent/room-amsterdam/fleerde/room-2391417" });
    const result = parser.parse(dom.window.document);
    expect(result).not.toBeNull();
    expect(result?.providerListingId).toBe("2391417");
    expect(result?.title).toBe("Safe Cozy StudentRoom Amsterdam");
    expect(result?.price).toBe(1700);
    expect(result?.bedrooms).toBe(2);
    expect(result?.area).toBe(110);
    expect(result?.address).toBe("Fleerde, Amsterdam");
    expect(result?.postalCode).toBe("1102AV");
    expect(result?.deposit).toBe(2000);
    expect(result?.isFurnished).toBe(true);
    expect(result?.images).toContain("https://resources.kamernet.nl/image/d21b2edb-d176-4af9-b7ef-cac6f85db04b");
  });

  it("should parse matching listing from Kamernet search payload when URL includes listing id", () => {
    const parser = new KamernetParser();
    const html = `
      <html>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "targetPageProps": {
                    "findListingsResponse": {
                      "listings": [
                        {
                          "listingId": 2391417,
                          "street": "Fleerde",
                          "city": "Amsterdam",
                          "surfaceArea": 110,
                          "listingType": 1,
                          "totalRentalPrice": 1700,
                          "resizedFullPreviewImageUrl": "https://resources.kamernet.nl/image/d21b2edb-d176-4af9-b7ef-cac6f85db04b/resize/422-225"
                        }
                      ],
                      "topAdListings": []
                    }
                  }
                }
              }
            }
          </script>
        </body>
      </html>
    `;
    const dom = new JSDOM(html, { url: "https://kamernet.nl/en/for-rent/room-amsterdam/fleerde/room-2391417" });
    const result = parser.parse(dom.window.document);
    expect(result).not.toBeNull();
    expect(result?.providerListingId).toBe("2391417");
    expect(result?.title).toBe("Room for rent in Fleerde, Amsterdam");
    expect(result?.price).toBe(1700);
    expect(result?.area).toBe(110);
    expect(result?.images).toContain("https://resources.kamernet.nl/image/d21b2edb-d176-4af9-b7ef-cac6f85db04b/resize/422-225");
  });
});

describe("IdealistaParser", () => {
  it("should parse property data from JSON-LD schema", () => {
    const parser = new IdealistaParser();
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Apartment",
              "identifier": "998877",
              "name": "Piso céntrico reformado",
              "description": "Increíble piso de 2 habitaciones al lado de Gran Vía.",
              "price": 1200,
              "floorSize": {
                "value": 75
              },
              "numberOfRooms": 2,
              "numberOfBathroomsTotal": 1,
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "Gran Vía 12",
                "addressLocality": "Madrid"
              },
              "geo": {
                "@type": "GeoCoordinates",
                "latitude": 40.42,
                "longitude": -3.70
              },
              "image": ["https://img3.idealista.com/123.jpg"]
            }
          </script>
        </head>
        <body>
          <div class="ide-box-detail overlay-box">
            <h2>Ubicación</h2>
            Gran Vía 12
            Centro
            Madrid
          </div>
        </body>
      </html>
    `;
    const dom = new JSDOM(html, { url: "https://www.idealista.com/inmueble/998877/" });
    const result = parser.parse(dom.window.document);
    expect(result).not.toBeNull();
    expect(result?.providerListingId).toBe("998877");
    expect(result?.title).toBe("Piso céntrico reformado");
    expect(result?.price).toBe(1200);
    expect(result?.area).toBe(75);
    expect(result?.bedrooms).toBe(2);
    expect(result?.bathrooms).toBe(1);
    expect(result?.city).toBe("Madrid");
    expect(result?.country).toBe("Spain");
    expect(result?.images).toContain("https://img3.idealista.com/123.jpg");
  });
});

describe("ZonapropParser", () => {
  it("should parse listing info from page elements and JSON-LD", () => {
    const parser = new ZonapropParser();
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@type": "Apartment",
              "identifier": "554433",
              "name": "Departamento de Categoría en Palermo",
              "description": "Excelente depto de 3 ambientes muy luminoso.",
              "price": 850,
              "priceCurrency": "USD",
              "floorSize": {
                "value": 90
              },
              "numberOfRooms": 3,
              "numberOfBedrooms": 2,
              "numberOfBathroomsTotal": 2,
              "image": ["https://imgar.zonaprop.com.ar/depto1.jpg"]
            }
          </script>
        </head>
        <body>
          <h1 data-testid="title">Departamento de Categoría en Palermo</h1>
          <div>
            USD 850
            Expensas $ 45.000
          </div>
          <div>
            Av. Santa Fe 3400, Palermo, Capital Federal
          </div>
        </body>
      </html>
    `;
    const dom = new JSDOM(html, { url: "https://www.zonaprop.com.ar/propiedades/departamento-de-categoria-554433.html" });
    
    // Mock the body innerText logic by overriding innerText on JSDOM document body
    Object.defineProperty(dom.window.document.body, "innerText", {
      get: () => `
        Departamento de Categoría en Palermo
        USD 850
        Expensas $ 45.000
        Av. Santa Fe 3400, Palermo, Capital Federal
        90 m²
      `
    });

    const result = parser.parse(dom.window.document);
    expect(result).not.toBeNull();
    expect(result?.providerListingId).toBe("554433");
    expect(result?.title).toBe("Departamento de Categoría en Palermo");
    expect(result?.price).toBe(850);
    expect(result?.currency).toBe("USD");
    expect(result?.expenses).toBe(45000);
    expect(result?.expensesCurrency).toBe("ARS");
    expect(result?.bedrooms).toBe(2);
    expect(result?.bathrooms).toBe(2);
    expect(result?.area).toBe(90);
    expect(result?.country).toBe("Argentina");
    expect(result?.images).toContain("https://imgar.zonaprop.com.ar/depto1.jpg");
  });
});
