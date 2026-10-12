import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plannr lives in a subfolder of a larger repository; keep builds scoped to it.
  outputFileTracingRoot: import.meta.dirname,
  // React-PDF uses Node APIs and native font parsing; keep it out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  // Font files for the PDF reports are read from disk at runtime.
  outputFileTracingIncludes: {
    "/api/**": ["./assets/fonts/**"],
  },
  turbopack: {
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
