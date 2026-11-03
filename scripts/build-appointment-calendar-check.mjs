import path from "node:path";
import { build } from "vite";
import react from "@vitejs/plugin-react";

// Frontend-only verification; never load project environment files or server
// plugins, start Express, empty shared output, or connect to external services.
const root = path.resolve(import.meta.dirname, "..");
await build({
  configFile: false, envFile: false, root: path.join(root, "client"), plugins: [react()],
  resolve: { alias: { "@": path.join(root, "client/src"), "@shared": path.join(root, "shared"), "@assets": path.join(root, "attached_assets") } },
  build: { outDir: path.join(root, "dist/appointment-calendar-check"), emptyOutDir: false },
});
