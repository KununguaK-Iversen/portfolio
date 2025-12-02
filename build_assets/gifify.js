// scripts/gifify.js
// Usage:
//   node scripts/gifify.js <assets_dir> <scale_or_width>
// Examples:
//   node scripts/gifify.js images 0.5   // scale to 50%
//   node scripts/gifify.js images 640   // max width = 640 px
//
// Now supports:
//   - Images: .png, .jpg, .jpeg, .gif
//   - Video:  .mp4, .m4v  (first frame via ffmpeg)
//
// NOTE: requires `ffmpeg` installed and available in PATH.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const inputDir = process.argv[2] || "images";
const outputDir = process.argv[3] || "images_gifify";
const sizeArg = process.argv[4] || "0.5";
const isScale = !/^\d+$/.test(String(sizeArg));
const scale = isScale ? parseFloat(sizeArg) : null;
const maxWidth = isScale ? null : parseInt(sizeArg, 10);

// file types
const imageExts = new Set([".png", ".jpg", ".jpeg", ".gif"]);
const videoExts = new Set([".mp4", ".m4v"]);
const allExts = new Set([...imageExts, ...videoExts]);

async function extractFirstFrame(videoPath) {
  // Returns a Buffer with a PNG of the first frame
  const { stdout } = await execFileAsync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-f",
      "image2pipe",
      "-vcodec",
      "png",
      "pipe:1",
    ],
    {
      encoding: "buffer",
      maxBuffer: 50 * 1024 * 1024, // 50MB safety margin
    },
  );

  return stdout;
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && allExts.has(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(inputDir, e.name));

  if (files.length === 0) {
    console.log(
      `No PNG/JPG/JPEG/GIF/MP4/M4V files found in ${inputDir}`,
    );
    return;
  }

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const name = path.basename(file, ext);
    const outPath = path.join(outputDir, `${name}.gif`);

    try {
      let img;

      if (imageExts.has(ext)) {
        // Regular image file → Sharp directly
        img = sharp(file);
      } else if (videoExts.has(ext)) {
        // Video file → grab first frame via ffmpeg, then Sharp
        const frameBuf = await extractFirstFrame(file);
        img = sharp(frameBuf);
      } else {
        // Shouldn’t happen, but just in case
        continue;
      }

      const meta = await img.metadata();
      const targetW =
        scale && meta.width
          ? Math.max(1, Math.round(meta.width * scale))
          : maxWidth || undefined;

      await img
        .resize(
          targetW
            ? { width: targetW, withoutEnlargement: true }
            : undefined,
        )
        .blur(2)
        .toFormat("gif")
        .toFile(outPath);

      console.log(`Created: ${outPath}`);
    } catch (err) {
      console.error(`Failed on ${file}:`, err?.message || err);
    }
  }

  console.log(`Done. Output in: ${outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
