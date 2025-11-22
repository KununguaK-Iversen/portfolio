// scripts/gifify.js
// Usage:
//   node scripts/gifify.js <images_dir> <scale_or_width>
// Examples:
//   node scripts/gifify.js images 0.5   // scale to 50%
//   node scripts/gifify.js images 640   // max width = 640 px

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const inputDir = process.argv[2] || "images";
const sizeArg = process.argv[3] || "0.5";
const isScale = !/^\d+$/.test(String(sizeArg));
const scale = isScale ? parseFloat(sizeArg) : null;
const maxWidth = isScale ? null : parseInt(sizeArg, 10);

// output sibling-folder: <inputDir>_gifify
const absIn = path.resolve(inputDir);
const outDir = path.join(path.dirname(absIn), `${path.basename(absIn)}_gifify`);

const exts = new Set([".png", ".jpg", ".jpeg", ".gif"]);

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const files = entries
    .filter(e => e.isFile() && exts.has(path.extname(e.name).toLowerCase()))
    .map(e => path.join(inputDir, e.name));

  if (files.length === 0) {
    console.log(`No PNG/JPG/JPEG/GIF files found in ${inputDir}`);
    return;
  }

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const name = path.basename(file, ext);
    const outPath = path.join(outDir, `${name}.gif`);

    try {
      // IMPORTANT: do NOT set { animated: true } -> Sharp defaults to first frame
      let img = sharp(file);

      const meta = await img.metadata();
      const targetW =
        (scale && meta.width) ? Math.max(1, Math.round(meta.width * scale))
          : (maxWidth || undefined);

      await img
        .resize(targetW ? { width: targetW, withoutEnlargement: true } : undefined)
        .blur(2)
        .toFormat("gif")
        .toFile(outPath);

    } catch (err) {
      console.error(`Failed on ${file}:`, err?.message || err);
    }
  }

  console.log(`Done. Output in: ${outDir}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});