#!/usr/bin/env node
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

console.log('Building content script with esbuild...');
execSync('bunx esbuild contents/content.ts --bundle --outfile=build/chrome-mv3-prod/content.js --format=iife --platform=browser --target=chrome120', {
  stdio: 'inherit'
});

console.log('Updating manifest.json...');
const manifestPath = 'build/chrome-mv3-prod/manifest.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const apiUrl = process.env.PLASMO_PUBLIC_API_URL || 'http://localhost:3000';
const apiOrigin = new URL(apiUrl).origin;

if (!apiOrigin.startsWith('http://') && !apiOrigin.startsWith('https://')) {
  throw new Error('PLASMO_PUBLIC_API_URL must use http or https.');
}

manifest.host_permissions = Array.from(new Set([
  ...(manifest.host_permissions || []),
  `${apiOrigin}/*`,
]));

manifest.content_scripts = [
  {
    matches: [
      "https://*.daft.ie/*",
      "https://daft.ie/*",
      "https://*.idealista.com/*",
      "https://idealista.com/*",
      "https://*.idealista.es/*",
      "https://idealista.es/*",
      "https://*.idealista.it/*",
      "https://idealista.it/*",
      "https://*.idealista.pt/*",
      "https://idealista.pt/*",
      "https://*.kamernet.nl/*",
      "https://kamernet.nl/*",
      "https://*.zonaprop.com.ar/*",
      "https://zonaprop.com.ar/*"
    ],
    js: ["content.js"],
    run_at: "document_idle"
  }
];

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✓ Build complete!');
