@echo off
REM 해설: 압축을 푼 현재 폴더에서 실행합니다. Node.js가 있으면 server.cjs를 시작합니다.
cd /d "%~dp0"
REM 해설: 4173 포트 사용 오류가 나면 기존 서버 창을 확인하세요. 명령창을 닫거나 Ctrl+C로 종료한 뒤 다시 시작할 수 있습니다.
where node >nul 2>nul
if %errorlevel% equ 0 (
  node server.cjs
) else (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" server.cjs
  ) else (
    echo Node.js is required. Install Node.js and run this file again.
  )
)
pause
