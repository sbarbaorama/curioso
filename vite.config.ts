import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serve l'app da https://sbarbaorama.github.io/curioso/
export default defineConfig({
  base: "/curioso/",
  plugins: [react()],
});
