import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import fs from "fs";
import path from "path";

// Helper to auto-detect all HTML files in pages folder for rollup
function getPageEntries() {
  const pagesDir = path.resolve(__dirname, "pages");
  const entries: Record<string, string> = {};

  fs.readdirSync(pagesDir).forEach((dir) => {
    const pageDir = path.join(pagesDir, dir);
    const htmlFile = path.join(pageDir, `${dir}.html`);
    if (fs.existsSync(htmlFile)) {
      entries[dir] = htmlFile;
    }
  });

  return entries;
}

// Middleware plugin to handle route fallbacks.
// Forces Vite to serve index.html for /pages/<slug> routes.
// This allows SPA-like routing behavior in MPA mode.
function routeFallback(): Plugin {
  // shared handler for both dev + preview
  const handler = (req: any, _res: any, next: any) => {
    const url = (req.url || "").split("?")[0];

    // Match `/pages/<slug>` or `/pages/<slug>/`
    // BUT NOT `/pages/<slug>/something`
    if (/^\/pages\/[^/]+\/?$/.test(url)) {
      // Internally ask Vite for `/` (index.html)
      // Browser URL stays `/pages/<slug>`
      req.url = "/";
    }

    next();
  };

  return {
    name: "modal-route-fallback",

    // dev server
    configureServer(server) {
      server.middlewares.use(handler);
    },

    // preview server
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}


export default defineConfig({
  appType: "mpa",
  root: ".",
  plugins: [
    routeFallback(),
    viteStaticCopy({
      targets: [
        {
          src: "images",
          dest: "",
        },
        {
          src: "images_gifify",
          dest: "",
        },
      ],
    }),
  ],
  build: {
    outDir: "dist",
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        ...getPageEntries(),
      },
    },
  },
  server: {
    port: 3000,
    middlewareMode: false,
    watch: {
      usePolling: true,
    },
    fs: {
      strict: true,
    },
  },
});
