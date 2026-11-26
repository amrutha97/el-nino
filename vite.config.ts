import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

const base = process.env.GITHUB_PAGES ? "/el-nino/" : "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["icons/favicon-32.png", "icons/apple-touch-icon.png", "textures/earth.jpg"],
      manifest: {
        name: "ENSO Recharge Oscillator",
        short_name: "Recharge",
        description: "Play Fei-Fei Jin’s 1997 recharge oscillator for El Niño.",
        start_url: ".",
        scope: ".",
        display: "standalone",
        orientation: "any",
        background_color: "#fafafa",
        theme_color: "#fafafa",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,jpg,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
