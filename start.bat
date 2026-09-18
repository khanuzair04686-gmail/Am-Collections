@echo off
title AM COLLECTION - Luxury Watch Store Backend
color 06
echo ================================================================
echo           AM COLLECTION - Luxury Master Copy Watch Store
echo ================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not detected in your system PATH!
    echo.
    echo To run the backend and admin panel with MongoDB:
    echo 1. Download and install Node.js (LTS version) from:
    echo    https://nodejs.org/
    echo 2. After installing, re-open this file or run:
    echo    npm install
    echo    npm run dev
    echo.
    echo (Note: You can still open "index.html" directly in your browser to view the storefront!)
    echo.
    pause
    exit /b
)

if not exist node_modules (
    echo [INFO] Installing required packages (express, mongoose, multer, cors, dotenv)...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed. Please check your internet connection.
        pause
        exit /b
    )
)

echo [INFO] Starting AM COLLECTION backend server...
echo 🌐 Storefront:      http://localhost:5000
echo 👑 Admin Dashboard: http://localhost:5000/admin.html
echo.
call npm run dev
pause
