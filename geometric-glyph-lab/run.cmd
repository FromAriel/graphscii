@echo off
setlocal
cd /d "%~dp0"
echo Geometric Glyph Lab
 echo.
echo Serving prebuilt app at http://localhost:5166/
echo Press Ctrl+C to stop.
echo.
python -m http.server 5166 -d dist

chrome http://localhost:5166/

