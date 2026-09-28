/**
 * Windows 로컬 미리보기 서버
 * 한국어 해설판: 주석과 줄바꿈을 정리했습니다. 실제 처리 방식은 원본과 같습니다.
 */

/* Node.js 표준 모듈만 사용하는 로컬 정적 파일 서버입니다. */
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");

/* dist 안의 HTML/CSS/JS/모델 파일을 제공합니다. */
const root = path.resolve(__dirname, "dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

/* 요청 URL을 안전한 로컬 경로로 변환하고 파일 확장자에 맞는 응답 형식을 보냅니다. 루트 경로 요청은 index.html로 연결됩니다. */
http
  .createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }
      fs.readFile(file, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end("Not found");
        }
        res.writeHead(200, {
          "Content-Type": types[path.extname(file)] || "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(data);
      });
    } catch {
      res.writeHead(400);
      res.end("Bad request");
    }
  })
  /* 127.0.0.1의 4173 포트로 로컬에서만 실행합니다. 이미 사용 중이면 EADDRINUSE가 발생하므로 기존 창/서버를 확인하세요. */
  .listen(4173, "127.0.0.1", () => console.log("Local: http://127.0.0.1:4173"));
