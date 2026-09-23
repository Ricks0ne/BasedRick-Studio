import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/indexer-proxy/:path*",
        destination: "http://34.31.10.170:42069/:path*", 
      },
    ];
  },
};

export default nextConfig;