@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Stateline: Campaign Trail - setup

rem Match the parts by PATTERN, never by exact filename: downloads routinely strip
rem or alter separators, so "Stateline-part1.bin" can land as "Statelinepart1.bin".
set "P1="
set "P2="
for /f "delims=" %%f in ('dir /b /a-d *part1*.bin 2^>nul') do set "P1=%%f"
for /f "delims=" %%f in ('dir /b /a-d *part2*.bin 2^>nul') do set "P2=%%f"

if not defined P1 goto :missing
if not defined P2 goto :missing

echo Joining "!P1!" + "!P2!" ...
copy /b "!P1!" + "!P2!" "Stateline.zip" >nul
if not exist "Stateline.zip" goto :failed

echo Extracting ...
powershell -NoProfile -Command "Expand-Archive -Force 'Stateline.zip' 'Stateline'"
if not exist "Stateline\Stateline.exe" goto :failed

echo.
echo Done. Open the "Stateline" folder here and run Stateline.exe
echo (SmartScreen: More info -^> Run anyway.)
echo.
pause
exit /b 0

:missing
echo.
echo ERROR: could not find both parts in this folder.
echo Looked for anything matching  *part1*.bin  and  *part2*.bin
echo.
echo This folder contains:
dir /b
echo.
echo Put both downloaded .bin parts next to this .bat and run it again.
echo.
pause
exit /b 1

:failed
echo.
echo ERROR: the join or the extract failed.
echo Most likely a part file downloaded incomplete - fetch both parts again.
echo.
pause
exit /b 1
