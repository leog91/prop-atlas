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

function getSimpleSelector(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls =
    el.className && typeof el.className === "string"
      ? `.${el.className.split(/\s+/).filter(Boolean).join(".")}`
      : "";
  return `${tag}${id}${cls}`;
}

function getSelectorPath(el: Element): string {
  const parts: string[] = [];
  let curr: Element | null = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    parts.unshift(getSimpleSelector(curr));
    curr = curr.parentElement;
  }
  return parts.join(" > ");
}

function buildSemanticMap(document: Document) {
  const meta: Record<string, string> = {};
  document.querySelectorAll("meta").forEach((m) => {
    const name = m.getAttribute("name") || m.getAttribute("property") || "";
    const content = m.getAttribute("content") || "";
    if (name && content) {
      meta[name] = content;
    }
  });

  const jsonLd: unknown[] = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || "");
      jsonLd.push(data);
    } catch {}
  });

  const relevantTags = new Set([
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "span", "div", "a", "img", "li", "dt", "dd", "strong", "b", "em",
  ]);

  const skipTags = new Set(["script", "style", "noscript", "iframe", "canvas", "svg"]);

  const nodes: {
    selector: string;
    tag: string;
    text?: string;
    attributes?: Record<string, string>;
  }[] = [];

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        if (skipTags.has(tag)) return NodeFilter.FILTER_REJECT;
        if (!relevantTags.has(tag)) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
 );

  let count = 0;
  const MAX_NODES = 600;
  while (walker.nextNode() && count < MAX_NODES) {
    const el = walker.currentNode as Element;
    const tag = el.tagName.toLowerCase();
    const text = el.textContent?.trim();

    // Only keep nodes that have meaningful text or are images/links
    const isImage = tag === "img";
    const isLink = tag === "a";
    const hasText = text && text.length > 0 && text.length < 500;

    if (!isImage && !isLink && !hasText) continue;

    const attributes: Record<string, string> = {};
    if (el.className && typeof el.className === "string") {
      attributes.class = el.className;
    }
    if (el.id) attributes.id = el.id;
    if (isLink) {
      const href = el.getAttribute("href");
      if (href) attributes.href = href;
    }
    if (isImage) {
      const src = el.getAttribute("src") || el.getAttribute("data-src");
      if (src) attributes.src = src;
      const alt = el.getAttribute("alt");
      if (alt) attributes.alt = alt;
    }

    // Include data-* attributes (often used by React/Vue for test IDs)
    for (const attr of el.attributes) {
      if (attr.name.startsWith("data-")) {
        attributes[attr.name] = attr.value;
      }
    }

    nodes.push({
      selector: getSelectorPath(el),
      tag,
      ...(text && text.length > 0 ? { text: text.slice(0, 500) } : {}),
      ...(Object.keys(attributes).length > 0 ? { attributes } : {}),
    });

    count++;
  }

  // Also capture a limited text dump of the body for regex analysis
  const pageText = (document.body as any)?.innerText?.slice(0, 6000) || "";

  // Capture <script> tags with IDs (e.g., __NEXT_DATA__) for framework state
  const scripts: { id?: string; type?: string; text?: string }[] = [];
  document.querySelectorAll("script").forEach((script) => {
    const id = script.id || script.getAttribute("data-name") || "";
    const type = script.type || "";
    if (
      id === "__NEXT_DATA__" ||
      id.includes("initial") ||
      id.includes("state") ||
      id.includes("data") ||
      type.includes("json")
    ) {
      const text = script.textContent?.slice(0, 10000) || "";
      if (text.length > 0) {
        try {
          // If it's valid JSON, parse it to make the snapshot cleaner
          const parsed = JSON.parse(text);
          scripts.push({ id, type, text: JSON.stringify(parsed).slice(0, 5000) });
        } catch {
          scripts.push({ id, type, text: text.slice(0, 5000) });
        }
      }
    }
  });

  return {
    title: document.title,
    url: window.location.href,
    meta,
    jsonLd,
    scripts,
    nodes,
    pageText,
  };
}

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
    return;
  }

  if (message.type === "ANALYZE_STRUCTURE") {
    const url = window.location.href;
    const parser = detectProvider(url, defaultParsers);
    const provider = parser?.name ?? "unknown";
    console.log("[EXT CONTENT] analyzing structure for provider:", provider);

    const snapshot = buildSemanticMap(document);
    console.log(
      "[EXT CONTENT] semantic map nodes:",
      snapshot.nodes.length,
      "pageText length:", snapshot.pageText.length
    );

    sendResponse({ provider, snapshot });
    return;
  }
});
