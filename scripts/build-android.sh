#!/usr/bin/env bash
# Build Dream Weaver Android APK/AAB
# Usage: bash scripts/build-android.sh [debug|release]
#
# Prerequisites:
#   - Node.js, npm
#   - Android Studio with SDK installed
#   - ANDROID_HOME environment variable set
#   - Java 17+
#   - For release: keystore configured (see below)

set -euo pipefail

MODE="${1:-debug}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "═══════════════════════════════════════"
echo "  Dream Weaver Android Build ($MODE)"
echo "═══════════════════════════════════════"

# Step 1: Build web app
echo ""
echo "▸ Building web app..."
npm run build

# Step 2: Sync to Android
echo ""
echo "▸ Syncing Capacitor..."
npx cap sync android

# Step 3: Build Android
echo ""
echo "▸ Building Android ($MODE)..."

if [ "$MODE" = "release" ]; then
  # For release builds, you need a keystore:
  # 1. Generate: keytool -genkey -v -keystore dreamweaver.keystore -alias dreamweaver -keyalg RSA -keysize 2048 -validity 10000
  # 2. Put keystore in android/app/
  # 3. Add to android/app/build.gradle:
  #    signingConfigs {
  #      release {
  #        storeFile file('dreamweaver.keystore')
  #        storePassword System.getenv('KEYSTORE_PASSWORD')
  #        keyAlias 'dreamweaver'
  #        keyPassword System.getenv('KEY_PASSWORD')
  #      }
  #    }
  cd android
  ./gradlew bundleRelease
  echo ""
  echo "✓ Release AAB built at:"
  echo "  android/app/build/outputs/bundle/release/app-release.aab"
else
  cd android
  ./gradlew assembleDebug
  echo ""
  echo "✓ Debug APK built at:"
  echo "  android/app/build/outputs/apk/debug/app-debug.apk"
fi

echo ""
echo "═══════════════════════════════════════"
echo "  Build complete!"
echo "═══════════════════════════════════════"
