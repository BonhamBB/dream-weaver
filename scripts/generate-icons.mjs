/**
 * Generate PNG icons from icon.svg for Android + PWA.
 *
 * Usage: node scripts/generate-icons.mjs
 * Requires: npm install sharp (dev dependency)
 */

import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SVG = readFileSync(resolve(ROOT, 'public/icon.svg'));
const OUT = resolve(ROOT, 'public/icons');

mkdirSync(OUT, { recursive: true });

const SIZES = [48, 72, 96, 128, 144, 152, 192, 384, 512];

async function generate() {
  for (const size of SIZES) {
    await sharp(SVG)
      .resize(size, size)
      .png()
      .toFile(resolve(OUT, `icon-${size}x${size}.png`));
    console.log(`✓ icon-${size}x${size}.png`);
  }

  // Maskable icon (with safe zone padding — 20% inset)
  const maskableSize = 512;
  const padding = Math.round(maskableSize * 0.1); // 10% each side = 80% safe zone
  const innerSize = maskableSize - padding * 2;
  const inner = await sharp(SVG).resize(innerSize, innerSize).png().toBuffer();
  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: { r: 6, g: 9, b: 25, alpha: 1 }, // #060919
    },
  })
    .composite([{ input: inner, top: padding, left: padding }])
    .png()
    .toFile(resolve(OUT, `maskable-${maskableSize}x${maskableSize}.png`));
  console.log(`✓ maskable-${maskableSize}x${maskableSize}.png`);

  // Android adaptive icon foreground (108dp with 72dp safe zone)
  const adaptiveSize = 432; // 108dp * 4 (xxxhdpi)
  const adaptivePadding = Math.round(adaptiveSize * 0.25); // 25% inset each side
  const adaptiveInner = adaptiveSize - adaptivePadding * 2;
  const fg = await sharp(SVG).resize(adaptiveInner, adaptiveInner).png().toBuffer();
  await sharp({
    create: {
      width: adaptiveSize,
      height: adaptiveSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: fg, top: adaptivePadding, left: adaptivePadding }])
    .png()
    .toFile(resolve(OUT, 'ic_launcher_foreground.png'));
  console.log('✓ ic_launcher_foreground.png');

  // Round icon for Android
  const roundSize = 512;
  const roundMask = Buffer.from(
    `<svg width="${roundSize}" height="${roundSize}"><circle cx="${roundSize / 2}" cy="${roundSize / 2}" r="${roundSize / 2}" fill="white"/></svg>`,
  );
  await sharp(SVG)
    .resize(roundSize, roundSize)
    .composite([{ input: roundMask, blend: 'dest-in' }])
    .png()
    .toFile(resolve(OUT, 'ic_launcher_round.png'));
  console.log('✓ ic_launcher_round.png');

  console.log('\nAll icons generated in public/icons/');
}

generate().catch(console.error);
