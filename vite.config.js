import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  createReadStream,
  existsSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// MediaPipe Hands ships its Emscripten/WASM runtime as sibling asset files.
// We serve them from the SAME version that's installed in node_modules so the
// JS glue (hands.js) and the WASM/data binaries can never mismatch — a mismatch
// is the usual cause of the minified "n is not a function" crash. Loading from a
// third-party CDN also breaks offline and is occasionally rate-limited (503).
const MP_SRC = resolve(__dirname, 'node_modules/@mediapipe/hands');

const MIME = {
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.tflite': 'application/octet-stream',
  '.binarypb': 'application/octet-stream',
};

function mediapipeLocalAssets() {
  const isAsset = (f) =>
    f !== 'package.json' && f !== 'README.md' && !f.endsWith('.d.ts');

  return {
    name: 'mediapipe-local-assets',
    // Dev: stream files straight from node_modules at /mediapipe/*
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/mediapipe/')) return next();
        const name = req.url.slice('/mediapipe/'.length).split('?')[0];
        const full = resolve(MP_SRC, name);
        if (!full.startsWith(MP_SRC) || !existsSync(full)) return next();
        res.setHeader('Content-Type', MIME[extname(full)] || 'application/octet-stream');
        createReadStream(full).pipe(res);
      });
    },
    // Build: copy the asset files into dist/mediapipe so the bundle is self-contained
    closeBundle() {
      if (!existsSync(MP_SRC)) return;
      const outDir = resolve(__dirname, 'dist/mediapipe');
      mkdirSync(outDir, { recursive: true });
      for (const f of readdirSync(MP_SRC)) {
        if (!isAsset(f)) continue;
        copyFileSync(resolve(MP_SRC, f), resolve(outDir, f));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mediapipeLocalAssets()],
  // @mediapipe/hands is an Emscripten WASM bundle — it must be loaded as a plain
  // <script> (see useHandTracking.ts), never bundled by Rollup, which corrupts
  // the Emscripten Module global.
  build: {
    rollupOptions: {
      external: ['@mediapipe/hands'],
    },
  },
});
