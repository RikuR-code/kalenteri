import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/lahti-api": {
        target: "https://www.tapahtumat.lahti.fi",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/lahti-api/, "/api"),
      },
      "/elakeliitto": {
        target: "https://paijat-hame.elakeliitto.fi",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/elakeliitto/, ""),
      },
    },
  },
});
