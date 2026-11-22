// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://gligor.ai",
  trailingSlash: "ignore",
  build: { inlineStylesheets: "always" },
  vite: { plugins: [tailwindcss()] },
});
