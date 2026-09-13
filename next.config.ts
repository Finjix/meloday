import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@earendil-works/pi-coding-agent"],
  poweredByHeader: false,
};

export default nextConfig;
