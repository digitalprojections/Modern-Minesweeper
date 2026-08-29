import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const javaHome = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const androidHome = process.env.ANDROID_HOME || join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const adb = process.platform === 'win32'
  ? join(androidHome, 'platform-tools', 'adb.exe')
  : 'adb';

const command = process.argv[2];
const env = {
  ...process.env,
  JAVA_HOME: existsSync(javaHome) ? javaHome : process.env.JAVA_HOME,
  ANDROID_HOME: androidHome,
  PATH: `${existsSync(javaHome) ? join(javaHome, 'bin') : ''};${process.env.PATH || ''}`,
};

ensureLocalProperties();

switch (command) {
  case 'build':
    run(gradlew, ['assembleDebug']);
    break;
  case 'bundle':
    run(gradlew, ['bundleRelease']);
    break;
  case 'install':
    run(adb, ['install', '-r', join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')], root);
    break;
  case 'open':
    run(adb, ['shell', 'monkey', '-p', 'link.created.minesweepermaui', '-c', 'android.intent.category.LAUNCHER', '1'], root);
    break;
  default:
    console.error('Usage: node scripts/capacitor-android.mjs <build|bundle|install|open>');
    process.exit(1);
}

function ensureLocalProperties() {
  const androidDir = join(root, 'android');
  if (!existsSync(androidDir) || !androidHome) return;

  const sdkPath = androidHome.replaceAll('\\', '\\\\');
  writeFileSync(join(androidDir, 'local.properties'), `sdk.dir=${sdkPath}\n`);
}

function run(commandName, args, cwd = join(root, 'android')) {
  const result = spawnSync(commandName, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
