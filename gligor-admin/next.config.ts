import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dit dashboard staat in een submap van een grotere repository.
  outputFileTracingRoot: import.meta.dirname,
  turbopack: { root: import.meta.dirname },
  // Databasestuurprogramma's (PGlite gebruikt WebAssembly) niet bundelen.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // De migraties worden in de demo-modus vanaf schijf gelezen.
  outputFileTracingIncludes: { "/**": ["./supabase/**/*.sql"] },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
