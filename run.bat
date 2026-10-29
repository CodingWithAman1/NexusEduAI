@echo off
title NexusEdu AI - Student & Campus Dashboard
echo =======================================================
echo Starting NexusEdu AI Platform...
echo Base Stack: HTML, CSS, JS, Flask, SQL, Firebase Auth
echo =======================================================
if not defined SECRET_KEY for /f %%i in ('python -c "import secrets; print(secrets.token_hex(32))"') do set SECRET_KEY=%%i
set COOKIE_SECURE=false
python app.py
pause
