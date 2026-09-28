> 주석 소스 안내: 이 폴더에는 개인 서명키와 SDK/JDK가 없습니다. 최신 설명은 상위 README.md를 먼저 읽으세요. 앱 패키지는 io.goodg.roomatelier.autosave이며 네이티브 Activity 클래스는 io.goodg.roomatelier.MainActivity입니다.

# Room Atelier Android

Offline Android WebView edition of the Room Atelier editor. The APK contains the complete editor and vendor libraries. It does not request Internet or broad storage permissions. User-selected imports and exports use the Android Storage Access Framework.

## Build on Windows

Use PowerShell 7, JDK 17, Android build-tools 36.0.0 and Android platform 35. `build.ps1 -ToolRoot <tools-directory> -OutputApk <output.apk>` compiles Java, creates DEX, packages assets, aligns and signs the APK, and verifies its signature. The tool directory contains `jdk/<jdk-directory>`, `build-tools/<build-tools-directory>` and `platform/<platform-directory>`.

The local task's tools are in the sibling `android-tools` directory. No system-wide installation or PATH changes are needed. Official downloads and their checksums were used.

`node --test tests/export-bridge.test.cjs` checks binary-safe exports and failure cleanup.

## Source

- `app/src/main/java/io/goodg/roomatelier/MainActivity.java`: trusted packaged-content origin, WebView, Android file picker, streamed file export, back navigation.
- `app/src/main/assets/site/`: the editor and Three.js libraries, all bundled. Google Fonts imports are removed for offline use.
- `android-bridge.js`: forwards JSON, GLB and PNG downloads to the Android save dialog in bounded chunks.
- `android.css`: phone touch controls.
- `app/src/main/res/`: app name, theme and adaptive launcher icon.

Minimum Android API 26; target API 35; OpenGL ES 3.0. An up-to-date Android System WebView is needed for ES modules, import maps, WebAssembly and WebGL2. No emulator or physical-device run has been claimed; install and exercise the Android file dialogs on a device before wider distribution.

## Signing and updates

The build creates a private signing key in `.signing/` if none exists. Keep that directory private and backed up: Android updates must be signed with the same key. Signing keys and passwords are deliberately excluded from the source ZIP and APK. The original signing key is not included in this source archive. Building elsewhere without it creates a different signing identity.

App data is local to the app and is not synchronized with the website. Users can move rooms using exported `.room.json` files. Export data before uninstalling or clearing app storage.

Three.js and bundled loader/decoder licenses are retained under `app/src/main/assets/site/vendor/`.
