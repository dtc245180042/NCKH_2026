# ==============================================================================
# Dockerfile: Hệ thống AI Smart Logistics Backend (FastAPI + 60 FPS WebSocket)
# Đề tài NCKH Sinh viên: SV2026-ICTU-08 | Khoa CNTT - ĐH CNTT&TT Thái Nguyên
# ==============================================================================

FROM python:3.11-slim

# Thiết lập biến môi trường Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

WORKDIR /app

# Cài đặt các gói phụ trợ hệ thống tối thiểu
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Sao chép mã nguồn ứng dụng và frontend
COPY app/ ./app/
COPY src/ ./src/

# Tạo thư mục dữ liệu cho CSDL SQLite
RUN mkdir -p /app/data

EXPOSE 8000

# Healthcheck xác định container sẵn sàng
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Khởi chạy Uvicorn ASGI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

