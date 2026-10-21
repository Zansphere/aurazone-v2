import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@aurazone/ui",
    "@aurazone/api-client",
    "@aurazone/utils",
    "@aurazone/validators",
    "@aurazone/config-tailwind",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.aurazone.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
