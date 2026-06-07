@echo off
chcp 65001 >nul
title AI 英语口语陪练

echo ============================================
echo   AI 英语口语陪练
echo ============================================
echo.

:: 尝试用 Python 启动（Windows 大多自带或已安装）
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✓ 使用 Python 启动服务...
    echo.
    echo   请在 Chrome 浏览器中打开：http://localhost:8000
    echo   按 Ctrl+C 可停止服务
    echo.
    start http://localhost:8000
    python -m http.server 8000 -d "%~dp0dist"
    goto :end
)

:: 尝试用 Node.js 启动
node --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✓ 使用 Node.js 启动服务...
    echo.
    echo   请在 Chrome 浏览器中打开：http://localhost:3000
    echo   按 Ctrl+C 可停止服务
    echo.
    start http://localhost:3000
    npx serve "%~dp0dist" -l 3000
    goto :end
)

:: 都不行，提示安装
echo ✗ 未检测到 Python 或 Node.js
echo.
echo   请安装以下任一工具后重新运行：
echo   - Python: https://www.python.org/downloads/
echo   - Node.js: https://nodejs.org
echo.
pause
goto :end

:end