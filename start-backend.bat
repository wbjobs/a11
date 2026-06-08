@echo off
echo ========================================
echo  点云重建协作系统 - 后端启动脚本
echo ========================================
echo.

cd /d "%~dp0api"

echo [1/3] 检查Python环境...
python --version
if %errorlevel% neq 0 (
    echo ERROR: Python未安装，请先安装Python 3.10+
    pause
    exit /b 1
)

echo.
echo [2/3] 安装依赖...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo WARNING: 依赖安装可能失败，请检查网络连接
)

echo.
echo [3/3] 启动FastAPI服务器...
echo 服务器将在 http://localhost:8000 启动
echo API文档: http://localhost:8000/docs
echo.
python main.py
