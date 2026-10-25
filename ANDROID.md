# BolHisab on Android

The Android app is a Capacitor shell around the SAME web app — the WebView loads the
running BolHisab server (voice/GST/chase logic stays server-side, so nothing is duplicated).

## What's already wired

- `capacitor.config.json` → `server.url` decides which server the app opens:
  - **emulator default**: `http://10.0.2.2:3100` (Android emulator's alias for your PC's localhost:3100)
  - **real phone (same Wi-Fi)**: your PC's LAN IP, e.g. `http://192.168.1.5:3100`
  - **production**: your Vercel URL, e.g. `https://bolhisab.vercel.app`
- `RECORD_AUDIO` permission + cleartext LAN traffic enabled in `AndroidManifest.xml`
- Branded launcher icons (yellow adaptive), splash screens, app name "BolHisab"

## Run it (Android Studio)

1. Start the web app on your PC: `npm run build`, then `npx next start -p 3100`.
2. Open **Android Studio → Open → `D:\baaki\android`** (first open downloads Gradle — needs internet).
3. For a **real phone**: plug it in with USB debugging on, change `server.url` in
   `capacitor.config.json` to your PC's LAN IP (`ipconfig` → IPv4), run `npx cap sync android`,
   then press **Run ▶** in Studio and pick the phone.
4. For the **emulator**: keep `10.0.2.2:3100`, create any phone AVD, press **Run ▶**.
5. First voice tap → Android asks for **Microphone** permission → Allow. That's it.

## Build a release APK (for judges / side-loading)

```bash
cd android
./gradlew assembleRelease
# unsigned APK: app/build/outputs/apk/release/app-release-unsigned.apk
```

For a signed one: Build → Generate Signed Bundle/APK in Studio
(key alias/passwords are yours; a debug-key-signed APK is fine for a hackathon demo —
use `./gradlew assembleDebug` and share `app/build/outputs/apk/debug/app-debug.apk`).

## Switching the server URL

Edit `server.url` in `capacitor.config.json`, then always:

```bash
npx cap sync android
```

(Sync copies the config into the APK — a Studio rebuild picks it up.)

## Known prototype limits (honest, for the demo)

- Speech (TTS) inside Android WebView can be quieter/more robotic than desktop Chrome;
  every screen keeps the tap/typing fallback exactly for this.
- The floating-pill overlay on top of other apps (PS4 stretch goal) is a next step —
  the in-app center-mic pill in the bottom nav is the shipped one-tap entry.
