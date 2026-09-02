Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Starting AI-Based Smart Meeting Assistant Project" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Cyan

# Start Backend
Write-Host "Starting Backend on http://localhost:8000 ..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd backend && .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

# Start Frontend
Write-Host "Starting Frontend on http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd frontend && npm run dev -- --host 127.0.0.1 --port 5173"

# Open browser
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

Write-Host "Both servers launched successfully!" -ForegroundColor Green
