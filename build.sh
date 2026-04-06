#!/bin/bash

# Configuration
PROJECT_ROOT=$(pwd)
# Default release = Viro + ARM native stack; use `assembleNoviro` / npm run android:apk:noviro for x86 emulator APKs.
APK_RELATIVE_PATH="android/app/build/outputs/apk/release/app-release.apk"
APK_FULL_PATH="$PROJECT_ROOT/$APK_RELATIVE_PATH"

# 1. Generate the Javascript Bundle
# This must run from the root directory where package.json exists
echo "Starting Expo Export..."
npx expo export --platform android

# 2. Enter Android directory for Native Build
if [ -d "android" ]; then
    cd android
else
    echo "Error: android directory not found in $PROJECT_ROOT"
    exit 1
fi

# 3. Clean and Build APK
echo "Running Gradle AssembleRelease..."
./gradlew clean
./gradlew assembleRelease

# 4. Return to Root
cd "$PROJECT_ROOT"

# 5. Deployment via SSH Tunnel
if [ -f "$APK_FULL_PATH" ]; then
    echo "Build successful."
    
    # Check if the device is visible through the forwarded port 5037
    DEVICE_READY=$(adb devices | grep -v "List" | grep "device")

    if [ -n "$DEVICE_READY" ]; then
        echo "Installing to device via tunnel..."
        # Remove existing debug version to prevent signature conflicts
        adb uninstall edu.ksu.quantumgrasp
        adb install -r -d "$APK_FULL_PATH"
        echo "Installation complete. The app is now standalone."
    else
        echo "Build finished, but no device found on port 5037."
        echo "Path to APK: $APK_FULL_PATH"
    fi
else
    echo "Build failed. Check the Gradle logs above for errors."
    exit 1
fi