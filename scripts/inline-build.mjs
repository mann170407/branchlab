// Post-build step: inline the built JS and CSS (fonts are already data URIs) into
// dist/index.html so the whole site is ONE self-contained file. It then works on
// any static host and also when opened directly from disk (double-click), with no
// server or internet connection.
import { readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const htmlPath = join(dist, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
const inlined = new Set();

// A replacer *function* is used so "$" sequences in the code are not treated as patterns.
html = html.replace(/<link rel="stylesheet"[^>]*?href="\.\/(assets\/[^"]+\.css)"[^>]*>/g, (_, file) => {
  inlined.add(file);
  return `<style>\n${readFileSync(join(dist, file), 'utf8')}\n</style>`;
});

html = html.replace(/<script type="module"[^>]*?src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/g, (_, file) => {
  inlined.add(file);
  // "</script" inside the code would close the tag early.
  const code = readFileSync(join(dist, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">\n${code}\n</script>`;
});

if (inlined.size === 0) {
  console.error('inline-build: no CSS/JS references found in dist/index.html');
  process.exit(1);
}

// Anything still referencing ./assets/ would break when the file is shared alone.
const leftover = html.match(/\.\/assets\/[^"')\s]+/g);
if (leftover) {
  console.error(`inline-build: unresolved asset references: ${[...new Set(leftover)].join(', ')}`);
  process.exit(1);
}

writeFileSync(htmlPath, html);
for (const file of inlined) rmSync(join(dist, file));
const assetsDir = join(dist, 'assets');
try {
  if (readdirSync(assetsDir).length === 0) rmSync(assetsDir, { recursive: true });
} catch {
  // no assets directory
}

const kb = (statSync(htmlPath).size / 1024).toFixed(0);
console.log(`inline-build: wrote self-contained dist/index.html (${kb} KB) from ${[...inlined].join(', ')}`);
