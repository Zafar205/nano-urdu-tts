import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The voice runs in the visitor's browser, so the site is plain static files
  // (free on Vercel, no serverless functions).
  output: "export",
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
