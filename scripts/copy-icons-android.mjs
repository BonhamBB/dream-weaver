/**
 * Copy generated icons to Android resource directories.
 * Usage: node scripts/copy-icons-android.mjs
 */

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ICONS = resolve(ROOT, 'public/icons');
const RES = resolve(ROOT, 'android/app/src/main/res');

// Android mipmap density → icon size mapping
const DENSITIES = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

if (!existsSync(RES)) {
  console.error('Android res directory not found. Run "npx cap add android" first.');
  process.exit(1);
}

// For each density, we use the closest size icon we have
for (const { dir, size } of DENSITIES) {
  const target = resolve(RES, dir);
  mkdirSync(target, { recursive: true });

  // Copy regular icon
  const iconSrc = resolve(ICONS, `icon-${size}x${size}.png`);
  if (existsSync(iconSrc)) {
    copyFileSync(iconSrc, resolve(target, 'ic_launcher.png'));
    copyFileSync(iconSrc, resolve(target, 'ic_launcher_round.png'));
    console.log(`✓ ${dir}/ic_launcher.png (${size}x${size})`);
  }

  // Copy foreground for adaptive icons
  const fgSrc = resolve(ICONS, 'ic_launcher_foreground.png');
  if (existsSync(fgSrc)) {
    copyFileSync(fgSrc, resolve(target, 'ic_launcher_foreground.png'));
  }
}

console.log('\nAndroid icons copied!');
