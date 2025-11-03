// scripts/png-to-gif.js
// Usage: node scripts/png-to-gif.js <images_dir> <scale_or_width>
// Examples:
//   node scripts/png-to-gif.js images 0.5        // scale to 50%
//   node scripts/png-to-gif.js images 640        // max width = 640 px

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const dir = process.argv[2] || "images";
const sizeArg = process.argv[3] || "0.5"; // default: 50%
const isScale = !Number.isInteger(Number(sizeArg)) && !/^\d+$/.test(sizeArg);
const scale = isScale ? parseFloat(sizeArg) : null;
const maxWidth = isScale ? null : parseInt(sizeArg, 10);

async function main() {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const pngs = entries
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith(".png"))
    .map(e => path.join(dir, e.name));

  if (pngs.length === 0) {
    console.log("No PNGs found in", dir);
    return;
  }

  for (const file of pngs) {
    const base = path.basename(file, path.extname(file));
    const outPath = path.join(path.dirname(file), `${base}.gif`);

    const img = sharp(file);
    const meta = await img.metadata();
    let targetW;

    if (scale) {
      targetW = Math.max(1, Math.round((meta.width || 0) * scale));
    } else if (maxWidth) {
      targetW = maxWidth;
    }

    // Resize (keeps aspect ratio), convert to GIF, write with same basename
    await img
      .resize(targetW ? { width: targetW, withoutEnlargement: true } : undefined)
      .blur(2)
      .toFormat("gif")
      .toFile(outPath);

    console.log(`→ ${outPath}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
