import { copyFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const imageDir = join(root, 'src', 'assets', 'images');
const publicIconDir = join(root, 'public', 'icons');

const androidIcons = [
  ['48x48_ic_launcher.png', 'mipmap-mdpi'],
  ['72x72_ic_launcher.png', 'mipmap-hdpi'],
  ['96x96_ic_launcher.png', 'mipmap-xhdpi'],
  ['144x144_ic_launcher.png', 'mipmap-xxhdpi'],
  ['192x192_ic_launcher.png', 'mipmap-xxxhdpi'],
];

for (const [fileName, density] of androidIcons) {
  const source = join(imageDir, fileName);
  const targetDir = join(root, 'android', 'app', 'src', 'main', 'res', density);
  mkdirSync(targetDir, { recursive: true });
  for (const targetName of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    copyFileSync(source, join(targetDir, targetName));
  }
}

mkdirSync(publicIconDir, { recursive: true });
copyFileSync(join(imageDir, '192x192_ic_launcher.png'), join(publicIconDir, 'icon-192.png'));
copyFileSync(join(imageDir, '512x512_play_store_icon.png'), join(publicIconDir, 'icon-512.png'));
copyFileSync(join(imageDir, '512x512_play_store_icon.png'), join(publicIconDir, 'apple-touch-icon.png'));

const splashResult = spawnSync('python', [join(root, 'scripts', 'make-splash-icon.py')], {
  cwd: root,
  stdio: 'inherit',
});

if (splashResult.status !== 0) {
  process.exit(splashResult.status ?? 1);
}

console.log('Synced app icon assets.');
