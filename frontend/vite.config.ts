import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const httpsConfig = process.env.VITE_HTTPS_KEY && process.env.VITE_HTTPS_CERT
  ? {
      key: fs.readFileSync(process.env.VITE_HTTPS_KEY),
      cert: fs.readFileSync(process.env.VITE_HTTPS_CERT)
    }
  : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    https: httpsConfig,
    proxy: {
      "/api": "http://localhost:8080"
    }
  }
});
