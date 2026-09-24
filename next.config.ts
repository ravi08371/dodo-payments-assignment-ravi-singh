import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Locally the demo runs on localhost and the checkout on 127.0.0.1, so they're different origins.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
