# Portfolio 2026 🌐 

A lightweight, modern portfolio built with **Vite 7**, **Alpine.js**, and **Pico CSS** — animated with **SAL.js**, optimized with **Sharp**, and deployable as static assets.

---

## Tech Stack

- Vite (^7.1.12)
- Alpine.js (^3.15.1)
- Pico CSS (^2.1.1)
- SAL.js (^0.8.5)
- Lucide Static (^0.548.0) & Simple Icons (^15.18.0)
- Sass (^1.93.2)
- Sharp (^0.34.4)
- vite-plugin-static-copy (^3.1.4)

---

## Requirements

- Node: 22.21.0 (pinned via Volta)
- npm: 11.6.2 (pinned via Volta)

Volta.sh ensures consistent Node/npm versions across machines.

---

## Getting Started
```
git clone https://github.com/KununguaK-Iversen/portfolio.git
cd portfolio
npm install
npm run dev
```

---

## NPM Scripts

| Script    | Description                          |
|---------- |--------------------------------------|
| dev       | Start Vite dev server                |
| build     | Build production bundle              |
| preview   | Preview the production build         |
| gifify    | Convert imgs and vids to blurry gifs |

---

## Asset Optimization (GIFify)

**Batch-convert images and videos to blurred/optimized GIFs:**

  npm run gifify
  (runs: node build_assets/gifify.js images images_gifify 40)

Adjust the input folder (`images`), the output folder (`images_gifify`) and the width
parameter (`40`) as needed.

---

## Vite Config Notes

- Uses `vite-plugin-static-copy` to move static assets at build time.
- Uses Node built-ins (`fs`, `path`) under ESM; for TypeScript IntelliSense, add `@types/node`.
- Resolves paths via `import.meta.url` / `fileURLToPath` for an ESM-friendly `__dirname`.

---

## Tips

- Project uses ES Modules (`"type": "module"` in `package.json`).
- With Volta, the specified Node/npm versions auto-activate inside the project.

---

## License

© 2025 KununguaK Iversen — All rights reserved.
