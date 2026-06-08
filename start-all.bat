@echo off
echo ========================================
echo  点云重建协作系统 - 完整启动脚本
echo ========================================
echo.

echo 正在启动后端服务...
start "PointCloud Backend" cmd /k call "%~dp0start-backend.bat"

echo 等待后端启动...
timeout /t 5 /nobreak >nul

echo.
echo 正在启动前端服务...
start "PointCloud Frontend" cmd /k call "%~dp0start-frontend.bat"

echo.
echo ========================================
echo  启动完成！
echo  前端: http://localhost:5173
echo  后端: http://localhost:8000
echo  API文档: http://localhost:8000/docs
echo ========================================
echo.
pause
