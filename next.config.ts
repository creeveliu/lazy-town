import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "imgs.gamersky.com" },
      { protocol: "https", hostname: "image.gamersky.com" },
      { protocol: "http", hostname: "image.gamersky.com" },
    ],
  },
};

export default nextConfig;
