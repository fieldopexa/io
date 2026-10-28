@echo off
setlocal
cd /d "%~dp0"
echo.
echo   OPEXA FSM with Team Chat - Local Development Test
echo   URL: http://127.0.0.1:8765/
echo   Ctrl+C closes the local server.
echo.
where py >nul 2>nul
if %errorlevel%==0 goto py_found
where python >nul 2>nul
if %errorlevel%==0 goto python_found
echo Python is not installed or not in PATH.
echo Install Python from https://www.python.org/downloads/ and choose Add Python to PATH.
pause
exit /b 1
:py_found
start "" "http://127.0.0.1:8765/"
py -3 -m http.server 8765 --bind 127.0.0.1
goto end
:python_found
start "" "http://127.0.0.1:8765/"
python -m http.server 8765 --bind 127.0.0.1
:end
echo.
echo Server stopped.
pause
