import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server (server.js + traced node_modules) for the droplet deploy, see scripts/package-release.sh.
  output: "standalone",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
