import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";

/**
 * Serves the Vercel-style functions in /api during `npm run dev`, so the chat
 * works locally without the Vercel CLI. Each file in /api exports handlers
 * named after HTTP methods (GET, POST, ...) that take a web-standard Request
 * and return a Response. Vercel does the same thing in production.
 */
function veeApiDevPlugin(): Plugin {
  return {
    name: "vee-api-dev",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api/")) return next();

        const name = url.slice("/api/".length).split("?")[0];
        if (!/^[a-z0-9-]+$/.test(name)) return next();
        const file = path.resolve(__dirname, "api", `${name}.ts`);
        if (!fs.existsSync(file)) return next();

        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`);
          const method = (req.method ?? "GET").toUpperCase();
          const handler = mod[method] ?? mod.default;
          if (typeof handler !== "function") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }

          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = chunks.length ? Buffer.concat(chunks) : undefined;

          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === "string") headers.set(k, v);
            else if (Array.isArray(v)) headers.set(k, v.join(", "));
          }

          const request = new Request(`http://${req.headers.host ?? "localhost"}${url}`, {
            method,
            headers,
            body: method === "GET" || method === "HEAD" ? undefined : body,
          });

          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          if (!response.body) {
            res.end();
            return;
          }
          const reader = response.body.getReader();
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } catch (err) {
          console.error(`[vee-api] ${url} failed:`, err);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "dev_handler_failed", message: String((err as Error).message ?? err) }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Make .env.local values (ANTHROPIC_API_KEY, VEE_*) visible to the API
  // handlers in dev. Vite only exposes VITE_* to the browser, which is what
  // we want: the key stays on the server side.
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of Object.keys(env)) {
    if ((key === "ANTHROPIC_API_KEY" || key.startsWith("VEE_")) && !process.env[key]) {
      process.env[key] = env[key];
    }
  }

  return {
    base: "/",
    plugins: [react(), veeApiDevPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: "::",
      port: 8080,
    },
  };
});
