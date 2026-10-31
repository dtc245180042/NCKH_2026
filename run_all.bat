@echo off
chcp 65001 > nul
echo ==============================================================================
echo [AI SMART LOGISTICS - SV2026-ICTU-08] KHOI CHAY TOAN BO DU AN (FULL-STACK)
echo ==============================================================================
echo.

REM Kiem tra neu co Python thi chay Backend, neu chua co thi mo truc tiep Frontend
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo Tim thay Python. Dang khoi chay FastAPI Server song song voi Frontend...
    start "FastAPI Backend Server" cmd /k "%~dp0run_backend.bat"
    timeout /t 2 >nul
) else (
    echo [THONG TIN] May tinh chua cai Python. He thong se mo truc tiep giao dien
    echo mo phong Canvas 2D mượt ma 60 FPS o che do Standalone de ban kiem tra ngay!
    echo.
)

start "" "%~dp0src\index.html"
echo [HOAN TAT] Giao dien mo phong da duoc khoi chay tren trinh duyet!
pause

