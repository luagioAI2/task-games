@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://127.0.0.1:8080/index.html"
  python -m http.server 8080 --bind 127.0.0.1
  goto :eof
)
echo 未找到 Node.js 或 Python，请先安装其中之一。
pause
