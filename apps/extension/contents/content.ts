import { detectProvider, defaultParsers } from "@prop-atlas/providers";
import type { PlasmoCSConfig } from "plasmo";

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.daft.ie/*",
    "https://www.idealista.com/*",
    "https://www.idealista.es/*",
    "https://www.idealista.it/*",
    "https://www.idealista.pt/*",
    "https://www.kamernet.nl/*",
    "https://www.zonaprop.com.ar/*",
  ],
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[EXT CONTENT] received message:", message.type);
  if (message.type === "PARSE_LISTING") {
    const url = window.location.href;
    console.log("[EXT CONTENT] url:", url);
    const parser = detectProvider(url, defaultParsers);
    console.log("[EXT CONTENT] parser found:", parser?.name ?? null);

    if (!parser) {
      sendResponse({ error: "Unsupported provider" });
      return;
    }

    const property = parser.parse(document);
    console.log("[EXT CONTENT] parsed property:", JSON.stringify(property, null, 2));
    sendResponse({ property });
  }
});
