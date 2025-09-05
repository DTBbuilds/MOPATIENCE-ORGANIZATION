#!/usr/bin/env node
/*
  Regenerate gallery images.json manifests by scanning folders.
  - Scans: assets/images/gallery/ subfolders
  - Produces/updates: images.json in each folder with a flat array of filenames
  - Skips: captions.json, images.json, non-image files

  Usage (Windows PowerShell):
    node scripts/generate-manifests.js

  Notes:
  - Safe to run multiple times; it overwrites images.json with discovered filenames.
  - Keeps filenames as-is (case-sensitive).
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const GALLERY_ROOT = path.join(ROOT, 'assets', 'images', 'gallery');
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.bmp', '.tif', '.tiff', '.heic', '.heif']);

function isImage(file) {
  return IMAGE_EXTS.has(path.extname(file).toLowerCase());
}

function naturalCompare(a, b) {
  // Simple natural sort: split numbers and strings
  const ax = [];
  const bx = [];
  a.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { ax.push([$1 || Infinity, $2 || '']); return ''; });
  b.replace(/(\d+)|(\D+)/g, (_, $1, $2) => { bx.push([$1 || Infinity, $2 || '']); return ''; });
  while (ax.length && bx.length) {
    const an = ax.shift();
    const bn = bx.shift();
    const aStr = an[1];
    const bStr = bn[1];
    if (aStr !== bStr) return aStr.localeCompare(bStr);
    const aNum = parseInt(an[0], 10) || 0;
    const bNum = parseInt(bn[0], 10) || 0;
    if (aNum !== bNum) return aNum - bNum;
  }
  return ax.length - bx.length;
}

function scanFolder(dirAbs) {
  const items = fs.readdirSync(dirAbs, { withFileTypes: true });
  const files = items
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((name) => name !== 'images.json' && name !== 'captions.json')
    .filter((name) => isImage(name));
  files.sort(naturalCompare);
  return files;
}

function writeImagesJson(dirAbs, files) {
  const outPath = path.join(dirAbs, 'images.json');
  const json = JSON.stringify(files, null, 2) + '\n';
  fs.writeFileSync(outPath, json, 'utf8');
}

function main() {
  if (!fs.existsSync(GALLERY_ROOT)) {
    console.error('Gallery root not found:', GALLERY_ROOT);
    process.exit(1);
  }
  const subdirs = fs.readdirSync(GALLERY_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(GALLERY_ROOT, d.name));

  let total = 0;
  for (const dir of subdirs) {
    const rel = path.relative(ROOT, dir).replace(/\\/g, '/');
    try {
      const files = scanFolder(dir);
      writeImagesJson(dir, files);
      console.log(`Updated ${rel}/images.json (${files.length} file(s))`);
      total += files.length;
    } catch (err) {
      console.error('Error processing', rel, err.message);
    }
  }
  console.log(`Done. Total images indexed: ${total}`);
}

main();
