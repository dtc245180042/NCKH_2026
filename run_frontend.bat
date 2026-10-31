@echo off
chcp 65001 > nul
echo ==============================================================================
echo [AI SMART LOGISTICS - SV2026-ICTU-08] KHOI CHAY GIAO DIEN MO PHONG CANVAS 2D
echo ==============================================================================
echo.
echo Dang mo giao dien mo phong 60 FPS tren trinh duyet mac dinh cua ban...
start "" "%~dp0src\index.html"
echo.
echo [THANH CONG] Giao dien da duoc mo!
echo Ban co the thu nghiem:
echo  - Bam Space de Tam dung / Tiep tuc
echo  - Bam "Cap kien moi" de them buu kien
echo  - Chinh toc do 0.5x, 1x, 2x, 4x
echo.
timeout /t 3 > nul
