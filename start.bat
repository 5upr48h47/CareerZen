@echo off
echo ===================================================
echo   Starting CareerZen (Backend + Frontend)
echo ===================================================
start "CareerZen Backend (Port 5000)" cmd /k "cd server && npm start"
timeout /t 2 /nobreak >nul
start "CareerZen Frontend (Port 5173)" cmd /k "cd client && npm run dev"
echo.
echo Servers started!
echo Frontend: http://localhost:5173
echo Backend API: http://localhost:5000/api
echo.
