Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   Starting CareerZen (Backend + Frontend)" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; npm start"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd client; npm run dev"

Write-Host "`nServers launched in background terminals!" -ForegroundColor Green
Write-Host "Frontend URL:  http://localhost:5173" -ForegroundColor Yellow
Write-Host "Backend API:   http://localhost:5000/api`n" -ForegroundColor Yellow
