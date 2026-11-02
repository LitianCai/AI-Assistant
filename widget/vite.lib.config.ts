import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/embed.tsx",
      name: "AiAssistant",
      formats: ["es", "umd"],
      fileName: (format) => `ai-assistant.${format}.js`,
    },
    outDir: "dist/lib",
    emptyOutDir: true,
  },
});
