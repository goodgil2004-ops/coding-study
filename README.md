# coding-study

my study — 코딩 공부와 프로젝트 소스를 정리하는 저장소입니다.

## 룸 아틀리에

방을 3D로 꾸미는 웹·Android 앱입니다. 한국어 주석과 학습 가이드를 포함합니다.

- [프로젝트 설명과 실행·빌드 방법](room-atelier/README.md)
- [처음 읽는 코드 안내](room-atelier/코드읽기.md)
- [웹 소스](room-atelier/website/)
- [Android 소스](room-atelier/android/)
- [방 배치 예제](room-atelier/examples/)

### 웹으로 실행하기

Node.js 설치 후 터미널에서 실행합니다.

```sh
git clone https://github.com/goodgil2004-ops/coding-study.git
cd coding-study/room-atelier/website
node server.cjs
```

브라우저에서 http://127.0.0.1:4173/editor.html 을 엽니다.

### 공부하는 순서

`코드읽기.md` → `editor.html` → `app.js` → `desk-items.js` → `autosave.js` 순서로 읽으면 화면과 3D 가구, 저장 기능이 연결되는 과정을 볼 수 있습니다.

외부 라이브러리는 원본과 라이선스를 보존했습니다. Android 개인 서명키는 포함하지 않습니다.
