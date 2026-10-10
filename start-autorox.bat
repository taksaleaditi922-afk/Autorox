@echo off
setlocal
cd /d "%~dp0"

echo Checking MongoDB...
call npm --prefix backend run db:start
if errorlevel 1 (
  echo MongoDB could not start. Run npm --prefix backend run db:setup first.
  pause
  exit /b 1
)

powershell -NoProfile -Command "try { $response = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:9014/api/health -TimeoutSec 2; if ($response.StatusCode -eq 200 -and $response.Content -match 'AutoGarage API is running') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  start "AutoGarage Backend" /d "%~dp0backend" cmd /k "npm run dev"
) else (
  echo AutoGarage backend is already running on port 9014; reusing it.
)

echo Starting AutoGarage frontend...
start "AutoGarage Frontend" /d "%~dp0frontend" cmd /k "npm run dev -- --host 0.0.0.0"

echo Waiting for the frontend to become available...
set "FRONTEND_READY="
for /l %%I in (1,1,30) do (
  powershell -NoProfile -Command "$client = New-Object Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', 5173); exit 0 } catch { exit 1 } finally { $client.Dispose() }" >nul 2>&1
  if not errorlevel 1 (
    set "FRONTEND_READY=1"
    goto :frontend_ready
  )
  timeout /t 1 /nobreak >nul
)

:frontend_ready
if not defined FRONTEND_READY (
  echo The frontend did not start on port 5173.
  echo Check the AutoGarage Frontend window for the startup error.
  pause
  exit /b 1
)

start "" http://localhost:5173

echo AutoGarage is starting at http://localhost:5173
