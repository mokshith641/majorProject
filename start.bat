@echo off
echo ====================================================
echo Starting AI-Based Smart Meeting Assistant Project
echo ====================================================

echo Starting Backend Server on http://localhost:8000 ...
start "Meeting Assistant - Backend" cmd /k "cd backend && .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting Frontend Server on http://localhost:5173 ...
start "Meeting Assistant - Frontend" cmd /k "cd frontend && npm run dev -- --host 127.0.0.1 --port 5173"

echo Opening application in default web browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo ====================================================
echo Servers launched! Keep the opened windows running.
echo ====================================================
