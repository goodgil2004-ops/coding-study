# 룸 아틀리에 — 한국어 주석 소스

2026-09-28 기준 이 대화에서 제작한 최신 웹/Android 소스 사본입니다.
자동 저장·복원, 기본 가구, 데스크테리어, 세탁기·전자레인지가 포함되어 있습니다.
사진으로 간단 모델을 만드는 기능은 제거된 상태입니다.
배포된 사이트를 변경하지 않고, 학습·수정용 사본에 주석과 들여쓰기를 보강했습니다.

## 폴더

| 폴더 | 역할 |
|---|---|
| `website/dist/` | 브라우저에서 실행하는 HTML/CSS/JavaScript와 Three.js |
| `website/server.cjs` | Node.js 로컬 미리보기 서버 |
| `website/tests/` | 자동 저장·모델·방 윤곽·가구 검사 |
| `android/app/src/main/` | Android Java 소스·Manifest·리소스·앱에 포함할 웹 파일 |
| `android/tests/` | 자동 저장 및 Android 파일 내보내기 검사 |
| `android/build.ps1` | Windows + Android SDK를 사용하는 전체 APK 빌드 |
| `android/repackage.py` | 원본 네이티브 실행부에 웹 파일을 교체하는 APK 재패키징 |
| `android/native-shell.zip` | 재패키징에 필요한 최초 네이티브 실행부 |
| `examples/` | 데스크 셋업 및 원룸 배치 예제 `.room.json` |

외부 라이브러리 `vendor/`는 원본과 라이선스를 보존했습니다. 개인 서명키, Git 인증 정보, 사이트 연결 정보는 포함하지 않았습니다.

## 웹 실행

Node.js를 설치한 뒤 다음 명령을 실행합니다.

```sh
cd website
node server.cjs
```

브라우저에서 `http://127.0.0.1:4173/editor.html`을 엽니다.
Windows에서는 `website/START.cmd`도 사용할 수 있습니다. 종료는 터미널에서 Ctrl+C입니다.
HTML을 파일 탐색기에서 직접 더블클릭하는 방식은 모듈과 파일 로딩 제한 때문에 권장하지 않습니다.
서버는 해당 컴퓨터에서만 열리며, 휴대폰 접속이나 HTTPS 배포는 별도입니다.

## 읽는 순서

1. `코드읽기.md` — 전체 데이터 흐름과 변경 예시
2. `website/dist/editor.html` — 버튼·입력란 등 화면 뼈대
3. `website/dist/app.js` — 상태, 3D 장면, 가구와 사용자 조작
4. `website/dist/desk-items.js` — 추가 가구 목록과 3D 도형 조립
5. `website/dist/autosave.js` — 자동 저장과 복구
6. `website/dist/models.js` — 3D 파일 및 직접 제작한 도형 처리
7. `android/app/src/main/java/io/goodg/roomatelier/MainActivity.java` — Android 실행부

## 검사

테스트는 `node:module`의 `registerHooks`를 사용하므로 Node.js 24 이상을 권장합니다.

```sh
cd website
node --test tests/*.test.mjs
```

```sh
cd android
node --test tests/*.test.*
```

## Android 빌드

### 웹 기능만 변경한 경우

`android/app/src/main/assets/site/`를 수정합니다. 이 폴더는 웹 버전과 별도 사본이므로 양쪽에 변경을 반영해야 합니다.

```sh
cd android
python3 -m pip install cryptography
python3 repackage.py
```

`room-atelier-android-1.2.0.apk`가 생성됩니다. 네이티브 Java/리소스는 `native-shell.zip`의 실행부를 재사용합니다. Python 3.10 이상을 권장합니다.
빌드 스크립트 안의 패키지명·버전·출력 파일명은 현재 1.2.0용으로 고정되어 있으므로 다음 릴리스에서는 함께 수정해야 합니다.

**개인 서명키를 제외했기 때문에 첫 실행에서 새 키가 생성됩니다.** 이 키로 만든 APK는 이전에 전달한 APK와 서명이 달라 덮어쓰기 업데이트가 되지 않습니다. 기존 작업을 먼저 JSON으로 내보내 보관하세요. 동일한 앱의 향후 업데이트에는 처음 생성된 `.signing/`을 안전하게 보관해야 합니다.

### Java 또는 Android 리소스까지 변경한 경우

Windows PowerShell 7, JDK 17, Android build-tools 36, platform 35를 준비하고 `android/README.md`의 도구 폴더 구성을 따릅니다.

```powershell
./build.ps1 -ToolRoot "C:\android-tools" -OutputApk "C:\outputs\room-atelier.apk"
```

이 경로는 Java 소스를 실제 컴파일합니다. Python 재패키징 경로와 사용하는 키 형식이 다르므로, 기존 앱 업데이트를 위한 서명키 관리가 별도로 필요합니다. SDK/JDK는 압축에 포함되지 않습니다.

## 저장과 검증 범위

작업은 해당 브라우저/앱 안에 저장됩니다. 웹과 APK는 자동 동기화되지 않습니다.
브라우저 데이터 지우기·앱 삭제·저장 공간 부족에 대비해 중요한 작업은 파일로 내보내 보관하세요.
소스 문법·주석 변경 전후 구문 구조·기존 자동 테스트를 검사했습니다. 실제 휴대폰에서의 화면·조작 테스트를 대신하지는 않습니다.

## 공개 저장소의 참고 그림

원본 참고 이미지는 제외하고 일반 가구 배치 SVG로 대체했습니다. `native-shell.zip`은 웹 이미지와 기존 서명을 제거한 DEX·리소스 묶음이며, 직접 설치할 수 없습니다. `repackage.py`에서 새 웹 파일과 결합하여 APK를 만듭니다.
