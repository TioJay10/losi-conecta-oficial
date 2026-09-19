import { defineConfig, type Plugin } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

/**
 * WebContainer/Vite 8 can expose TanStack Start virtual modules without the
 * encoded null-byte prefix. Rewrite those development requests before Vite
 * tries to resolve them.
 */
function tanstackStartVirtualModuleShim(): Plugin {
  return {
    name: "tanstack-start:virtual-module-shim",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.startsWith("/@id/virtual:tanstack-start-")) {
          req.url = req.url.replace(
            "/@id/virtual:",
            "/@id/__x00__virtual:",
          );
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    tanstackStartVirtualModuleShim(),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
});
