import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/Fantacalcio.AuctionHelper/",
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
