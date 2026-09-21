import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl =
    env.VITE_SUPABASE_URL ?? "https://bpvaftobiosjesdbaany.supabase.co";

  return {
    plugins: [
      tanstackStart(),
      nitro(),
      viteReact(),
    ],
    server: {
      proxy: {
        "/__supabase": {
          target: supabaseUrl,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/__supabase/, ""),
        },
      },
    },
  };
});
