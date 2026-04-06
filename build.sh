#!/bin/bash

# Configuration
PROJECT_ROOT=$(pwd)
# `full` flavor = Viro + ARM native stack; use `noviro` for x86 emulator APKs if needed.
APK_RELATIVE_PATH="android/app/build/outputs/apk/full/release/app-full-release.apk"
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
./gradlew assembleFullRelease

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
        adb uninstall com.your.package.name 
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