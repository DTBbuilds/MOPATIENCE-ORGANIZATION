#!/usr/bin/env node
/*
  Convert manifest-listed images to WebP and upgrade manifests with srcset/sizes.
  - Scans: assets/images/gallery/ subfolders (images.json)
  - For each entry:
    * If it's a string filename, generate WebP variants alongside it and convert the
      manifest entry into an object with src, srcset, sizes (preserving captions via filename).
    * If it's already an object with srcset, we skip conversion unless files are missing.
  - Widths policy: choose smart widths based on original size, from this preset
    [640, 960, 1280, 1600, 1920, 2560], capped to original width and de-duplicated.
  - Quality: WebP quality 80 (good balance of size and quality).

  Usage (Windows PowerShell):
    npm install
    npm run convert:webp

  Notes:
    - Requires devDependency: sharp
    - Writes files next to originals: base.webp and base-<w>.webp
*/

const fs = require('fs');
const path = require('path');
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp is not installed. Run `npm install` first.');
  process.exit(1);
}

const ROOT = process.cwd();
const GALLERY_ROOT = path.join(ROOT, 'assets', 'images', 'gallery');
const PRESET_WIDTHS = [640, 960, 1280, 1600, 1920, 2560];
const DEFAULT_SIZES = '(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw';

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function withoutExt(name) {
  return name.replace(/\.[^.]+$/, '');
}

function extOf(name) {
  return path.extname(name).toLowerCase();
}

function isImage(name) {
  return ['.jpg', '.jpeg', '.png'].includes(extOf(name));
}

async function convertOne(inputAbs, outAbs, width) {
  const pipeline = sharp(inputAbs).rotate();
  if (width) pipeline.resize({ width, withoutEnlargement: true });
  await pipeline.webp({ quality: 80 }).toFile(outAbs);
}

async function processEntry(dirAbs, folderRel, entry) {
  // Normalize entry to object { src, srcset?, sizes?, alt? }
  const isObj = typeof entry === 'object' && entry && entry.src;
  const srcRel = isObj ? entry.src : String(entry);
  const originalAbs = path.join(dirAbs, srcRel);

  if (!fs.existsSync(originalAbs)) {
    console.warn(`  - Skipping missing file: ${folderRel}/${srcRel}`);
    return entry; // leave as-is
  }

  // Skip non-raster inputs (svg, gif, etc.)
  if (!isImage(srcRel)) {
    return entry; // leave as-is
  }

  // Gather metadata
  let meta;
  try {
    meta = await sharp(originalAbs).metadata();
  } catch (e) {
    console.warn(`  - Metadata failed for ${folderRel}/${srcRel}: ${e.message}`);
    return entry; // leave as-is
  }
  const origWidth = Math.max(1, meta.width || 0);

  // Choose widths smartly
  const widths = PRESET_WIDTHS.filter((w) => w <= origWidth);
  if (widths.length === 0) widths.push(origWidth);

  // Prepare output filenames
  const base = withoutExt(srcRel);
  const outRelBase = path.join(path.dirname(srcRel), `${base}`);
  const outputs = widths.map((w) => ({
    width: w,
    rel: `${outRelBase}-${w}.webp`,
    abs: path.join(dirAbs, `${base}-${w}.webp`),
  }));
  // Also create a near-original webp if not present in widths
  const nearOrigName = `${outRelBase}.webp`;
  const nearOrigAbs = path.join(dirAbs, `${base}.webp`);

  // Convert if missing
  for (const o of outputs) {
    if (!fs.existsSync(o.abs)) {
      await convertOne(originalAbs, o.abs, o.width);
      console.log(`  - Wrote ${folderRel}/${o.rel}`);
    }
  }
  if (!fs.existsSync(nearOrigAbs)) {
    await convertOne(originalAbs, nearOrigAbs, undefined);
    console.log(`  - Wrote ${folderRel}/${nearOrigName}`);
  }

  // Build srcset entries
  const srcsetList = outputs.map((o) => `${o.rel.replace(/\\/g, '/') } ${o.width}w`);

  // Build upgraded manifest entry (preserve alt if any)
  const upgraded = {
    src: srcRel,
    srcset: srcsetList,
    sizes: (isObj && entry.sizes) ? entry.sizes : DEFAULT_SIZES,
    ...(isObj && entry.alt ? { alt: entry.alt } : {}),
  };
  return upgraded;
}

async function processFolder(dirAbs) {
  const folderRel = path.relative(ROOT, dirAbs).replace(/\\/g, '/');
  const manifestPath = path.join(dirAbs, 'images.json');
  if (!fs.existsSync(manifestPath)) return; // nothing to do

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    console.warn(`Skipping invalid JSON: ${folderRel}/images.json`);
    return;
  }
  if (!Array.isArray(manifest)) {
    console.warn(`Skipping non-array: ${folderRel}/images.json`);
    return;
  }

  const upgraded = [];
  for (const entry of manifest) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const up = await processEntry(dirAbs, folderRel, entry);
      upgraded.push(up);
    } catch (e) {
      console.warn(`  - Error processing entry in ${folderRel}: ${e.message}`);
      upgraded.push(entry);
    }
  }

  // Write back manifest with upgraded entries
  const json = JSON.stringify(upgraded, null, 2) + '\n';
  fs.writeFileSync(manifestPath, json, 'utf8');
  console.log(`Updated ${folderRel}/images.json (upgraded entries)`);
}

async function main() {
  if (!fs.existsSync(GALLERY_ROOT)) {
    console.error('Gallery root not found:', GALLERY_ROOT);
    process.exit(1);
  }
  const subdirs = fs.readdirSync(GALLERY_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(GALLERY_ROOT, d.name));

  for (const dir of subdirs) {
    // eslint-disable-next-line no-await-in-loop
    await processFolder(dir);
  }
  console.log('Done converting to WebP and upgrading manifests.');
}

main();
