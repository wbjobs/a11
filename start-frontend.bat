@echo off
echo ========================================
echo  点云重建协作系统 - 前端启动脚本
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] 检查Node.js环境...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js未安装，请先安装Node.js v18+
    pause
    exit /b 1
)

echo.
echo [2/3] 安装依赖...
npm install
if %errorlevel% neq 0 (
    echo WARNING: 依赖安装可能失败，请检查网络连接
)

echo.
echo [3/3] 启动Vite开发服务器...
echo 前端将在 http://localhost:5173 启动
echo.
npm run dev
