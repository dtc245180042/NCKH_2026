@echo off
chcp 65001 > nul
echo ==============================================================================
echo [AI SMART LOGISTICS - SV2026-ICTU-08] KHOI CHAY FASTAPI BACKEND SERVER
echo ==============================================================================
echo.
echo Dang kiem tra moi truong Python...

where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [CANH BAO] Khong tim thay Python tren may cua ban!
    echo.
    echo Huong dan cai dat Python de chay Backend:
    echo  1. Truy cap: https://www.python.org/downloads/
    echo  2. Tai ban Python 3.10 hoac 3.11 hoac 3.12 (Installer cho Windows)
    echo  3. Khi cai dat, NHO TICH CHON: "Add Python to PATH"
    echo  4. Sau do mo lai file run_backend.bat nay.
    echo.
    pause
    exit /b 1
)

python -c "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
if %errorlevel% neq 0 (
    echo [THONG BAO] Python can phien ban 3.9 tro len de chay FastAPI va Pydantic v2.
)

echo [1/3] Dang kiem tra va cai dat thu vien requirements.txt...
pip install -r "%~dp0requirements.txt"

echo.
echo [2/3] Dang khoi tao va cap nhat Co so du lieu 3NF...
python -c "from app.core.database import init_db; init_db(); print('CSDL 3NF khoi tao thanh cong!')"

echo.
echo [3/3] Dang khoi chay FastAPI Uvicorn Server tai http://localhost:8000 ...
echo  - Swagger UI API Docs: http://localhost:8000/docs
echo  - Giao dien Canvas 2D: http://localhost:8000/simulation/index.html
echo  - Kiem tra Health:    http://localhost:8000/health
echo.
start "" "http://localhost:8000/docs"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause
