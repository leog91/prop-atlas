import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@prop-atlas/types",
    "@prop-atlas/db",
    "@prop-atlas/providers",
  ],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.daft.ie",
      },
      {
        protocol: "https",
        hostname: "st3.idealista.com",
      },
      {
        protocol: "https",
        hostname: "st4.idealista.com",
      },
      {
        protocol: "https",
        hostname: "img.idealista.com",
      },
      {
        protocol: "https",
        hostname: "images.kamernet.nl",
      },
      {
        protocol: "https",
        hostname: "resources.kamernet.nl",
      },
      {
        protocol: "https",
        hostname: "imganuncios.mitula.net",
      },
      {
        protocol: "https",
        hostname: "http2.mlstatic.com",
      },
      {
        protocol: "https",
        hostname: "**.zonaprop.com.ar",
      },
    ],
  },
};

export default nextConfig;
