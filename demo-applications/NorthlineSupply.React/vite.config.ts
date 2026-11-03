import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const assistantUrl = "/assistant/ai-assistant.umd.js";

function findWidgetDirectory(start: string): string {
  let current = path.resolve(start);
  for (;;) {
    const candidate = path.join(current, "widget");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Could not find the widget folder by walking up from this app.");
    }
    current = parent;
  }
}

function assistantFile(): string {
  return path.join(findWidgetDirectory(appDir), "dist", "lib", "ai-assistant.umd.js");
}

function serveAssistant(umdFile: string) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = (req.url ?? "").split("?")[0];
    if (pathname !== assistantUrl || req.method !== "GET") {
      next();
      return;
    }
    if (!fs.existsSync(umdFile)) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Assistant script is missing.");
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(umdFile).pipe(res);
  };
}

function assistantPlugin(): Plugin {
  const umdFile = assistantFile();
  const attach = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use(serveAssistant(umdFile));
  };
  return {
    name: "northline-assistant-script",
    configureServer: attach,
    configurePreviewServer: attach,
    generateBundle() {
      if (!fs.existsSync(umdFile)) {
        this.error("Widget bundle is missing. Expected widget/dist/lib/ai-assistant.umd.js.");
      }
      this.emitFile({
        type: "asset",
        fileName: "assistant/ai-assistant.umd.js",
        source: fs.readFileSync(umdFile),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), assistantPlugin()],
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 5174,
    strictPort: true,
  },
});
