import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import fs from "fs";
import path from "path";

// Helper to auto-detect all HTML files in pages
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

export default defineConfig({
  appType: "mpa",
  root: ".",
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "images",
          dest: "",
        },
        {
          src: "pages/projects.json",
          dest: "pages",
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
