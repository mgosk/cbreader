# Android APK builds

CBreader uses Capacitor 8 to package the Vite reader as an Android app. The native project is already checked in at `android/`; do not run `npx cap add android` again. Comics and translation archives are selected by the user and are not bundled into the APK.

## Prerequisites

- Node.js 22 or newer and npm, as required by [Capacitor 8](https://capacitorjs.com/docs/getting-started/environment-setup).
- JDK 21 or 25. The generated Capacitor Gradle configuration compiles Java 21 sources; Gradle can run on either JDK. Point `JAVA_HOME` at a full JDK containing `bin/java`, `bin/javac`, and `bin/jlink`.
- Android SDK Platform 36, Android SDK Build Tools 35.0.0, and Platform Tools for `adb`.
- Network access on the first build to download Gradle and Maven dependencies. The checked-in wrapper selects Gradle 9.1.0, which adds [Java 25 support](https://docs.gradle.org/9.1.0/release-notes.html); no system Gradle installation is needed.

Install SDK packages using Android Studio's SDK Manager, or download the [Android command-line tools](https://developer.android.com/studio#command-tools) and use `sdkmanager`:

```sh
sdkmanager "platform-tools" "platforms;android-36" "build-tools;35.0.0"
sdkmanager --licenses
```

Review and accept the SDK licenses when prompted. Configure your terminal with your actual installation paths, for example on Linux:

```sh
export JAVA_HOME=/path/to/jdk-25
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
java -version
javac -version
```

Alternatively, put `sdk.dir=/absolute/path/to/android-sdk` in `android/local.properties`. This machine-specific file is ignored by Git. In Android Studio, also select JDK 21 or 25 as the Gradle JDK; the IDE and terminal can otherwise use different Java installations.

The project's `android/variables.gradle` sets minimum API 24 (Android 7), compile API 36, and target API 36. Build Tools 35.0.0 is the default for the pinned Android Gradle Plugin 8.13.0.

## Build a debug APK

Run from the repository root:

```sh
npm ci
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

On Windows, use `gradlew.bat assembleDebug`. The [Gradle debug build](https://developer.android.com/build/building-cmdline) produces:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

The debug APK is automatically signed with a development key and can be installed directly. Run the web build and Capacitor sync again after changing React code, styles, or Capacitor configuration. Gradle alone does not rebuild `dist/`; skipping these steps can package stale assets.

For an IDE build, run the same web build and sync first, then `npx cap open android` from the repository root and build the debug APK in Android Studio.

Generated web assets, native build outputs, local SDK configuration, and APKs are ignored by Git. Keep `capacitor.config.ts`, the native project sources, and the Gradle wrapper in version control.

## Install and check on a device

Enable USB debugging on an Android device and authorize the computer, or start an emulator. From the repository root:

```sh
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.cbreader.app/.MainActivity
```

If multiple devices are connected, add `-s DEVICE_SERIAL` after `adb`. Copy a packaged CBZ to the device and check file selection, translation taps, page swipes, zoom/pan, portrait/landscape tablet controls, and saved reading progress after reopening the app and selecting the book again. A successful APK build checks compilation and packaging; it does not verify these device interactions.

## Release APKs

Release APKs are built and signed exclusively by the manual GitHub Actions `release` workflow. Follow the [CI/CD release instructions](cicd.md#releases) to configure signing secrets, enter a new SemVer version in the GitHub Actions UI, and download the APK. The pipeline creates the Git tag.

Install the downloaded APK by opening it on your device or running `adb install -r /path/to/app-release.apk`. If you previously installed a debug APK, uninstall it first because the signing keys differ; uninstalling clears saved reading progress.

## Verified build

On 2026-10-05, the production web build and Capacitor sync passed, followed by `./gradlew --no-daemon clean assembleDebug` using Node.js 24.18.0, Temurin JDK 25.0.4.1, Gradle 9.1.0, Android Gradle Plugin 8.13.0, Android platform 36, and Build Tools 35.0.0. `apksigner verify` verified the debug APK signature; ZIP integrity passed, and all three bundled production web assets matched `dist/` byte for byte. The APK identifies itself as `com.cbreader.app`, minimum API 24, target API 36.

This build used temporary tooling at `/tmp/cbreader-jdk25`, `/tmp/cbreader-android-sdk`, and `/tmp/cbreader-gradle`. Those directories are disposable; configure permanent JDK and SDK installations for regular development. No device or emulator smoke test was performed.

## Troubleshooting

- **Invalid `JAVA_HOME`, `invalid source release: 21`, or Java version errors:** select a full JDK 21 or 25 and confirm both `java -version` and `javac -version`. A directory containing only JDK documentation is not a JDK installation.
- **`jlink executable ... does not exist`:** select a full JDK rather than an IDE runtime that omits `jlink`. Android uses this tool to prepare the Java system modules for compilation.
- **`Unsupported class file major version 69`:** use the checked-in Gradle 9.1.0 wrapper (`./gradlew`) rather than an older system Gradle. Java 25 requires Gradle 9.1.0 or newer.
- **SDK location not found:** set `ANDROID_HOME` or create `android/local.properties` with the correct `sdk.dir`.
- **Missing platform, Build Tools, or unaccepted licenses:** install the packages listed above and run `sdkmanager --licenses`.
- **Gradle cannot download dependencies:** allow access to `services.gradle.org`, its distribution download redirects, Google's Maven repository, and Maven Central. An offline build requires those artifacts to be cached already.
- **Cannot write Gradle cache or lock files:** choose a writable cache with `GRADLE_USER_HOME=/path/to/writable/cache ./gradlew assembleDebug`.
- **App shows old content:** rerun `npm run build`, `npx cap sync android`, and the Gradle build, then install the newly generated APK.
- **Install fails with a signing mismatch:** use the original signing key, or uninstall the existing app before installing a differently signed build. Uninstalling clears its saved reading progress.
