import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/api/queries" instead of "../../api/queries"; mirrored in tsconfig.json "paths".
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    // Fonts stay real files: inlined as data: URIs they'd be blocked by the Content-Security-Policy
    // (font-src 'self', nginx.conf.template). Other small assets are inlined as usual.
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
  },
  server: {
    // The API only accepts calls from this exact origin (APP_UI_URL on the backend),
    // so never silently move to another port.
    port: 5173,
    strictPort: true,
  },
});
