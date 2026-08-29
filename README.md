# Modern Minesweeper

Modern Minesweeper is a React/Vite game packaged for Android with Capacitor.

Android package ID: `link.created.minesweepermaui`

## Local Development

1. Install dependencies:
   `npm install`
2. Run the web app:
   `npm run dev`
3. Run checks:
   `npm test`
   `npm run lint`
   `python -m unittest discover -s tests -p "test_*.py"`

## Android Debug Build

1. Sync web assets into Android:
   `npm run android:sync`
2. Build the debug APK:
   `npm run android:build`
3. Install and launch on a connected device:
   `npm run android:install`
   `npm run android:open`

Debug APK output:
`android/app/build/outputs/apk/debug/app-debug.apk`

## Open Testing Release

Open Testing maps to Google Play track `beta`. Do not use this workflow for production.

1. Put release signing values in `.env` or the current shell:
   `KEYSTORE_PATH`, `STORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
2. Build the signed release bundle:
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\build-release-aab.ps1`
3. Commit release-ready source changes before upload.
4. Publish only to beta:
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\publish-open-testing.ps1 -Track beta -ReleaseName "Modern Minesweeper 1.0 (1)"`

Release AAB output:
`android/app/build/outputs/bundle/release/app-release.aab`

Publisher credentials are read from `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` or `--Credentials`. Keep keystores, service-account JSON, AAB/APK outputs, screenshots, and local properties uncommitted.
