@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22 或更新版本。
  pause
  exit /b 1
)
if not exist "node_modules\ffmpeg-static\ffmpeg.exe" (
  echo 首次启动：正在准备视频组件，请稍等……
  call npm.cmd install
  if errorlevel 1 (
    echo 视频组件安装失败。请检查网络后重试。
    pause
    exit /b 1
  )
)
echo 深海纪事将在本机启动。
echo 请在浏览器打开 http://127.0.0.1:3080/ocean/
call npm.cmd start
pause
