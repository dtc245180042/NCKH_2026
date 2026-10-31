/**
 * ============================================================================
 * AI SMART LOGISTICS - GIAO DIỆN MÔ PHỎNG 2D CANVAS 60 FPS (TASK LOG-119)
 * ============================================================================
 * Đề tài NCKH Sinh viên: SV2026-ICTU-08
 * Trường Đại học Công nghệ Thông tin và Truyền thông – Đại học Thái Nguyên (ICTU)
 *
 * Chịu trách nhiệm module: Senior Frontend Engineer
 * Tiêu chuẩn kỹ thuật:
 *   - Vòng lặp render chuẩn 60 FPS tối ưu bằng requestAnimationFrame và delta-time.
 *   - Bộ đếm FPS thời gian thực hiển thị góc màn hình kèm biểu đồ Sparkline.
 *   - Sơ đồ kho thông minh: Cổng Inbound, Băng chuyền, Cổng phân loại IoT, Cổng Outbound, AMR.
 *   - Giả lập tầng thị giác AI: Bounding Box YOLOv12n và Tracking Trail ByteTrack.
 * ============================================================================
 */

'use strict';

/* ============================================================================
   1. CẤU HÌNH HỆ THỐNG VÀ THÔNG SỐ TOÀN CỤC (GLOBAL CONFIGURATION)
   ============================================================================ */
const CONFIG = {
  TARGET_FPS: 60,
  BASE_WIDTH: 1400,
  BASE_HEIGHT: 820,
  MAIN_CONVEYOR_Y: 380,
  MAIN_CONVEYOR_SPEED: 130, // pixel/giây ở tốc độ 1.0x
  CONVEYOR_HEIGHT: 54,
  ROLLER_SPACING: 18,
  SPAWN_INTERVAL_SEC: 2.2, // Chu kỳ cấp kiện hàng tự động

  // Danh mục 4 tuyến phân loại bưu kiện (Routing Destinations)
  DESTINATIONS: [
    {
      id: 'LANE_1',
      name: 'Miền Bắc',
      city: 'Hà Nội',
      postalCode: '100000',
      gateIndex: 0,
      gateX: 380,
      divertDir: 1, // 1: rẽ xuống Outbound dưới
      color: '#38bdf8', // Cyan
      targetDockY: 660,
    },
    {
      id: 'LANE_2',
      name: 'Miền Trung',
      city: 'Đà Nẵng',
      postalCode: '550000',
      gateIndex: 1,
      gateX: 620,
      divertDir: -1, // -1: rẽ lên Outbound trên
      color: '#f59e0b', // Amber
      targetDockY: 130,
    },
    {
      id: 'LANE_3',
      name: 'Miền Nam',
      city: 'TP.HCM',
      postalCode: '700000',
      gateIndex: 2,
      gateX: 860,
      divertDir: 1, // 1: rẽ xuống Outbound dưới
      color: '#10b981', // Emerald
      targetDockY: 660,
    },
    {
      id: 'LANE_4',
      name: 'Quốc Tế',
      city: 'Chuyển Tiếp',
      postalCode: '999000',
      gateIndex: 3,
      gateX: 1100,
      divertDir: 0, // Đi thẳng tới cổng xuất cuối
      color: '#a855f7', // Purple
      targetDockY: 380,
    }
  ]
};

/* ============================================================================
   2. BỘ ĐẾM FPS THỜI GIAN THỰC (REAL-TIME HIGH-PRECISION FPS COUNTER)
   ============================================================================ */
/**
 * Lớp FPSCounter tính toán và trực quan hóa hiệu năng render 60 FPS
 * Dựa trên performance.now() với cơ chế làm mượt (rolling average) và biểu đồ Sparkline.
 */
class FPSCounter {
  constructor() {
    this.fps = 60.0;
    this.avgFps = 60.0;
    this.frameTimeMs = 16.6;
    this.lastTimestamp = performance.now();
    this.frameCount = 0;
    this.historyLength = 40;
    this.frameHistory = new Array(this.historyLength).fill(16.6); // Lưu thời gian frame gần nhất (ms)
    this.historyIndex = 0;

    // Timer cập nhật DOM định kỳ để tránh layout thrashing
    this.lastDomUpdate = 0;
    this.domUpdateInterval = 120; // 120ms cập nhật UI DOM một lần

    // Tham chiếu phần tử DOM
    this.domFpsValue = document.getElementById('fpsValue');
    this.domFpsDot = document.getElementById('fpsDot');
    this.domFrameTime = document.getElementById('frameTimeText');
  }

  /**
   * Cập nhật số liệu tính toán mỗi khung hình
   * @param {DOMHighResTimeStamp} currentTimestamp
   * @returns {number} delta-time (giây) đã được giới hạn an toàn
   */
  update(currentTimestamp) {
    const rawDeltaMs = currentTimestamp - this.lastTimestamp;
    this.lastTimestamp = currentTimestamp;

    // Giới hạn delta an toàn (tránh vọt khi người dùng chuyển tab)
    const clampedDeltaMs = Math.min(Math.max(rawDeltaMs, 1.0), 100.0);
    this.frameTimeMs = clampedDeltaMs;

    // Lưu vào buffer lịch sử cho sparkline
    this.frameHistory[this.historyIndex] = clampedDeltaMs;
    this.historyIndex = (this.historyIndex + 1) % this.historyLength;

    // Tính toán FPS tức thời và làm mượt theo trọng số lũy tích (EMA)
    const instantFps = 1000.0 / clampedDeltaMs;
    this.avgFps = this.avgFps * 0.92 + instantFps * 0.08;
    this.fps = Math.round(this.avgFps * 10) / 10;
    this.frameCount++;

    // Cập nhật lên thanh Header theo chu kỳ
    if (currentTimestamp - this.lastDomUpdate > this.domUpdateInterval) {
      this.updateDom();
      this.lastDomUpdate = currentTimestamp;
    }

    return clampedDeltaMs / 1000.0; // Trả về giây
  }

  /**
   * Cập nhật thông số lên Header Badges
   */
  updateDom() {
    if (this.domFpsValue) {
      this.domFpsValue.textContent = this.fps.toFixed(1);
    }
    if (this.domFrameTime) {
      this.domFrameTime.textContent = `${this.frameTimeMs.toFixed(1)} ms/frame`;
    }

    // Đổi màu chấm trạng thái dựa trên mức FPS
    if (this.domFpsDot) {
      if (this.fps >= 55) {
        this.domFpsDot.style.backgroundColor = '#10b981'; // Xanh lá: Chuẩn 60 FPS
        this.domFpsDot.style.boxShadow = '0 0 8px #10b981';
      } else if (this.fps >= 30) {
        this.domFpsDot.style.backgroundColor = '#f59e0b'; // Vàng cam: Trung bình
        this.domFpsDot.style.boxShadow = '0 0 8px #f59e0b';
      } else {
        this.domFpsDot.style.backgroundColor = '#ef4444'; // Đỏ: Giật lag
        this.domFpsDot.style.boxShadow = '0 0 8px #ef4444';
      }
    }
  }

  /**
   * Vẽ hộp chẩn đoán hiệu năng HUD và đồ thị Sparkline trực tiếp lên góc Canvas
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   */
  renderHUD(ctx, width, height) {
    const boxW = 190;
    const boxH = 92;
    const posX = width - boxW - 20;
    const posY = 20;

    ctx.save();

    // 1. Nền thẻ bán trong suốt phong cách SCADA
    ctx.fillStyle = 'rgba(11, 15, 25, 0.88)';
    ctx.strokeStyle = this.fps >= 55 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, posX, posY, boxW, boxH, 8);
    ctx.fill();
    ctx.stroke();

    // 2. Chấm đèn LED báo trạng thái
    const dotColor = this.fps >= 55 ? '#10b981' : (this.fps >= 30 ? '#f59e0b' : '#ef4444');
    ctx.beginPath();
    ctx.arc(posX + 16, posY + 18, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.shadowColor = dotColor;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3. Tiêu đề HUD
    ctx.fillStyle = '#9ca3af';
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText('DIAGNOSTICS HUD', posX + 28, posY + 21);

    // 4. Chỉ số FPS lớn
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillText(`${this.fps.toFixed(1)}`, posX + 16, posY + 48);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText('FPS (60Hz)', posX + 82, posY + 48);

    // 5. Frame time mili-giây
    ctx.fillStyle = '#6b7280';
    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.fillText(`Frame Time: ${this.frameTimeMs.toFixed(1)}ms`, posX + 16, posY + 64);

    // 6. Biểu đồ Sparkline (30 frame gần nhất)
    const graphX = posX + 16;
    const graphY = posY + 82;
    const graphW = boxW - 32;
    const graphH = 14;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.moveTo(graphX, graphY);
    ctx.lineTo(graphX + graphW, graphY);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = dotColor;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < this.historyLength; i++) {
      const idx = (this.historyIndex + i) % this.historyLength;
      const ms = this.frameHistory[idx];
      // Chuẩn hóa: 16.6ms nằm ở 50% chiều cao biểu đồ
      const normalizedH = Math.min(Math.max((ms / 33.3) * graphH, 1), graphH);
      const px = graphX + (i / (this.historyLength - 1)) * graphW;
      const py = graphY - normalizedH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

/* ============================================================================
   3. ĐỐI TƯỢNG KIỆN HÀNG THÔNG MINH (AI PARCEL WITH BYTETRACK & YOLO)
   ============================================================================ */
/**
 * Lớp Parcel đại diện cho một bưu kiện di chuyển trên hệ thống
 * Tích hợp Bounding Box YOLOv12n, ByteTrack Kalman tracking trail, và logic phân nhánh.
 */
class Parcel {
  /**
   * @param {number} id Số thứ tự kiện
   * @param {number} trackId ID định danh ByteTrack duy nhất
   * @param {Object} destination Thông tin tuyến phân loại
   */
  constructor(id, trackId, destination) {
    this.id = `PKG-${String(id).padStart(4, '0')}`;
    this.trackId = trackId;
    this.destination = destination;

    // Kích thước kiện hàng (pixel)
    this.width = 38;
    this.height = 32;

    // Vị trí xuất phát tại Cổng Inbound (Trạm tiếp nhận bên trái)
    this.x = 40;
    this.y = CONFIG.MAIN_CONVEYOR_Y - this.height / 2;

    // Trạng thái vận hành
    this.status = 'INBOUND'; // INBOUND -> CONVEYING -> DIVERTING -> OUTBOUND -> FINISHED
    this.speedX = CONFIG.MAIN_CONVEYOR_SPEED;
    this.speedY = 0;

    // Thông số AI mô phỏng
    this.confidence = (0.94 + Math.random() * 0.05).toFixed(2);
    this.weight = (1.2 + Math.random() * 4.5).toFixed(1); // kg

    // Lịch sử quỹ đạo phục vụ hiển thị Tracking Trail (ByteTrack)
    this.history = [];
    this.maxHistory = 24;

    // Góc quay và hiệu ứng hiển thị
    this.rotation = 0;
    this.opacity = 1.0;
    this.isDiverted = false;
  }

  /**
   * Cập nhật vị trí kiện hàng theo thời gian thực (delta-time)
   * @param {number} dt Delta time (giây)
   * @param {number} speedMultiplier Hệ số tốc độ mô phỏng
   * @param {Array} sortingGates Danh sách cổng phân loại
   */
  update(dt, speedMultiplier, sortingGates) {
    if (this.status === 'FINISHED') return;

    const effectiveDt = dt * speedMultiplier;

    // Lưu vị trí tâm vào lịch sử vệt quỹ đạo ByteTrack
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    this.history.push({ x: centerX, y: centerY });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // 1. Logic khi đang trên băng chuyền chính
    if (this.status === 'INBOUND') {
      this.x += this.speedX * effectiveDt;
      if (this.x >= 120) {
        this.status = 'CONVEYING';
      }
    } else if (this.status === 'CONVEYING') {
      this.x += this.speedX * effectiveDt;

      // Kiểm tra khi tiếp cận cổng phân loại được chỉ định
      const targetGate = sortingGates.find(g => g.config.id === this.destination.id);

      if (targetGate && targetGate.config.divertDir !== 0) {
        const triggerX = targetGate.config.gateX;

        // Vùng kích hoạt gạt (Trigger Line)
        if (Math.abs(this.x - triggerX) < 14 && !this.isDiverted) {
          this.isDiverted = true;
          this.status = 'DIVERTING';
          targetGate.triggerDiverter(this);

          // Chuyển hướng vận tốc theo góc rẽ
          if (targetGate.config.divertDir === 1) {
            // Rẽ xuống làn dưới
            this.speedY = CONFIG.MAIN_CONVEYOR_SPEED * 0.9;
            this.speedX = CONFIG.MAIN_CONVEYOR_SPEED * 0.4;
          } else {
            // Rẽ lên làn trên
            this.speedY = -CONFIG.MAIN_CONVEYOR_SPEED * 0.9;
            this.speedX = CONFIG.MAIN_CONVEYOR_SPEED * 0.4;
          }
        }
      } else if (targetGate && targetGate.config.divertDir === 0) {
        // Cổng đi thẳng ra cuối làn (Quốc tế)
        if (this.x >= targetGate.config.gateX) {
          this.status = 'OUTBOUND';
        }
      }
    } else if (this.status === 'DIVERTING') {
      // Đang trên làn rẽ sang cổng xuất
      this.x += this.speedX * effectiveDt;
      this.y += this.speedY * effectiveDt;

      // Xoay nhẹ hộp theo hướng rẽ
      const targetAngle = this.speedY > 0 ? 0.35 : -0.35;
      this.rotation += (targetAngle - this.rotation) * 0.1;

      // Kiểm tra đã tới khu vực bốc dỡ Cổng Outbound chưa
      const targetDockY = this.destination.targetDockY;
      const reachedY = this.speedY > 0 ? (this.y >= targetDockY - 30) : (this.y <= targetDockY + 30);

      if (reachedY) {
        this.status = 'OUTBOUND';
      }
    } else if (this.status === 'OUTBOUND') {
      // Đã tới Cổng Outbound: giảm tốc và palletize (biến mất dần)
      this.x += this.speedX * effectiveDt * 0.3;
      this.opacity -= 0.6 * effectiveDt;
      if (this.opacity <= 0.05) {
        this.status = 'FINISHED';
      }
    }
  }

  /**
   * Vẽ kiện hàng lên Canvas kèm Bounding Box YOLO và vệt ByteTrack
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} layers Tùy chọn bật/tắt các lớp
   */
  draw(ctx, layers) {
    if (this.status === 'FINISHED' || this.opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(this.opacity, 0);

    // 1. Vẽ vệt quỹ đạo di chuyển (ByteTrack Tracking Trail)
    if (layers.trails && this.history.length > 2) {
      ctx.save();
      for (let i = 1; i < this.history.length; i++) {
        const p1 = this.history[i - 1];
        const p2 = this.history[i];
        const trailAlpha = (i / this.history.length) * 0.7 * this.opacity;

        ctx.beginPath();
        ctx.strokeStyle = this.destination.color;
        ctx.globalAlpha = trailAlpha;
        ctx.lineWidth = 3.5 * (i / this.history.length);
        ctx.lineCap = 'round';
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Vẽ hình ảnh kiện hàng (Hộp carton logistics 2.5D chân thực)
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate(this.rotation);

    const halfW = this.width / 2;
    const halfH = this.height / 2;

    // Đổ bóng kiện hàng
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(-halfW + 3, -halfH + 4, this.width, this.height);

    // Thân thùng carton
    const boxGradient = ctx.createLinearGradient(-halfW, -halfH, halfW, halfH);
    boxGradient.addColorStop(0, '#d97706'); // Nâu vàng carton sáng
    boxGradient.addColorStop(1, '#92400e'); // Nâu carton đậm
    ctx.fillStyle = boxGradient;
    ctx.fillRect(-halfW, -halfH, this.width, this.height);

    // Viền mép thùng
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1;
    ctx.strokeRect(-halfW, -halfH, this.width, this.height);

    // Băng dính niêm phong ở giữa thùng
    ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
    ctx.fillRect(-halfW, -3, this.width, 6);

    // Nhãn bưu chính & đích đến màu sắc
    ctx.fillStyle = this.destination.color;
    ctx.fillRect(-halfW + 4, -halfH + 4, 10, 8);

    // Mã vạch tượng trưng
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(2, -halfH + 4, 12, 6);

    ctx.restore();

    // 3. Giả lập Bounding Box YOLOv12n & Nhãn nhận diện ByteTrack
    if (layers.aiBoxes) {
      this.drawYoloBoundingBox(ctx);
    }

    ctx.restore();
  }

  /**
   * Vẽ khung phát hiện YOLOv12 với các góc ngắm phong cách thị giác máy tính
   * @param {CanvasRenderingContext2D} ctx
   */
  drawYoloBoundingBox(ctx) {
    const pad = 4;
    const bx = this.x - pad;
    const by = this.y - pad;
    const bw = this.width + pad * 2;
    const bh = this.height + pad * 2;
    const corner = 7;
    const color = this.destination.color;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    // 4 góc ngắm đặc trưng của AI Vision Detector
    // Góc trên - trái
    ctx.beginPath();
    ctx.moveTo(bx, by + corner);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + corner, by);
    ctx.stroke();

    // Góc trên - phải
    ctx.beginPath();
    ctx.moveTo(bx + bw - corner, by);
    ctx.lineTo(bx + bw, by);
    ctx.lineTo(bx + bw, by + corner);
    ctx.stroke();

    // Góc dưới - phải
    ctx.beginPath();
    ctx.moveTo(bx + bw, by + bh - corner);
    ctx.lineTo(bx + bw, by + bh);
    ctx.lineTo(bx + bw - corner, by + bh);
    ctx.stroke();

    // Góc dưới - trái
    ctx.beginPath();
    ctx.moveTo(bx + corner, by + bh);
    ctx.lineTo(bx, by + bh);
    ctx.lineTo(bx, by + bh - corner);
    ctx.stroke();

    // Nhãn AI Header: [ID: #trackId] destination (conf)
    const labelText = `ID:#${this.trackId} ${this.destination.name} ${this.confidence}`;
    ctx.font = '600 9px "JetBrains Mono", monospace';
    const textWidth = ctx.measureText(labelText).width;

    ctx.fillStyle = color;
    ctx.fillRect(bx, by - 14, textWidth + 8, 14);

    ctx.fillStyle = '#0a0e17';
    ctx.fillText(labelText, bx + 4, by - 3);

    // Điểm tâm đối tượng (Object Centerpoint tính toán bởi ByteTrack Kalman)
    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Kiểm tra tọa độ con trỏ chuột có nằm trong kiện hàng không (hỗ trợ hover tooltip)
   * @param {number} mx Tọa độ chuột X
   * @param {number} my Tọa độ chuột Y
   */
  containsPoint(mx, my) {
    return (
      mx >= this.x &&
      mx <= this.x + this.width &&
      my >= this.y &&
      my <= this.y + this.height
    );
  }
}

/* ============================================================================
   4. CỔNG PHÂN LOẠI CƠ KHÍ IoT (IoT SORTING GATES & DIVERTERS)
   ============================================================================ */
/**
 * Lớp SortingGate quản lý logic vạch cảm biến quang học và cần gạt phân loại 45 độ
 */
class SortingGate {
  /**
   * @param {Object} config Cấu hình tuyến phân loại
   */
  constructor(config) {
    this.config = config;
    this.armAngle = 0; // Góc mở cần gạt (radian): 0 là đóng, ~0.78 (45 độ) là mở gạt
    this.targetArmAngle = 0;
    this.sensorActive = false;
    this.sensorPulse = 0;
    this.sortedCount = 0;
  }

  /**
   * Kích hoạt mở cần gạt khi phát hiện kiện hàng trùng khớp tuyến đích
   * @param {Parcel} parcel
   */
  triggerDiverter(parcel) {
    this.sensorActive = true;
    this.sensorPulse = 1.0;
    this.targetArmAngle = this.config.divertDir > 0 ? 0.785 : -0.785; // 45 độ (π/4)
    this.sortedCount++;

    // Tự động thu cần gạt về vị trí an toàn sau khi kiện đã vào làn
    setTimeout(() => {
      this.targetArmAngle = 0;
      this.sensorActive = false;
    }, 700);
  }

  /**
   * Cập nhật chuyển động mượt mà của cần gạt cơ khí
   * @param {number} dt Delta time
   */
  update(dt) {
    // Chuyển động mượt cần gạt sử dụng hàm nội suy LERP
    this.armAngle += (this.targetArmAngle - this.armAngle) * Math.min(dt * 12, 1);

    if (this.sensorPulse > 0) {
      this.sensorPulse -= dt * 2.5;
      if (this.sensorPulse < 0) this.sensorPulse = 0;
    }
  }

  /**
   * Vẽ cổng phân loại: Vạch cảm biến quang học, Cần gạt 45 độ, và nhánh băng tải rẽ
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} layers
   */
  draw(ctx, layers) {
    const { gateX, divertDir, color, targetDockY, name, postalCode } = this.config;
    const centerY = CONFIG.MAIN_CONVEYOR_Y;
    const beltH = CONFIG.CONVEYOR_HEIGHT;

    ctx.save();

    // 1. Nhánh băng tải rẽ (Chute / Divert Conveyor)
    if (divertDir !== 0) {
      const chuteW = 44;
      const startY = divertDir > 0 ? (centerY + beltH / 2) : (centerY - beltH / 2);
      const endY = targetDockY;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(gateX - chuteW / 2, Math.min(startY, endY), chuteW, Math.abs(endY - startY));

      // Họa tiết con lăn trên nhánh rẽ
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      const step = 14;
      const topY = Math.min(startY, endY);
      const botY = Math.max(startY, endY);
      for (let y = topY + 6; y < botY; y += step) {
        ctx.beginPath();
        ctx.moveTo(gateX - chuteW / 2 + 4, y);
        ctx.lineTo(gateX + chuteW / 2 - 4, y);
        ctx.stroke();
      }

      // Thanh chắn an toàn 2 bên nhánh rẽ
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gateX - chuteW / 2, startY);
      ctx.lineTo(gateX - chuteW / 2, endY);
      ctx.moveTo(gateX + chuteW / 2, startY);
      ctx.lineTo(gateX + chuteW / 2, endY);
      ctx.stroke();
    }

    // 2. Vạch cảm biến quang học IoT (Optical Sensor Trigger Line)
    if (layers.sensors) {
      ctx.save();
      const triggerX = gateX;
      const sensorTop = centerY - beltH / 2 - 12;
      const sensorBot = centerY + beltH / 2 + 12;

      // Tia laser cảm biến quét qua băng tải
      ctx.strokeStyle = this.sensorActive ? '#ffffff' : color;
      ctx.lineWidth = this.sensorActive ? 3.5 : 1.5;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(triggerX, sensorTop);
      ctx.lineTo(triggerX, sensorBot);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cụm mắt đọc cảm biến quang 2 đầu
      const drawEye = (ey) => {
        ctx.beginPath();
        ctx.arc(triggerX, ey, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = this.sensorActive ? '#ffffff' : color;
        if (this.sensorActive) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 10;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      };
      drawEye(sensorTop);
      drawEye(sensorBot);

      ctx.restore();
    }

    // 3. Cần gạt cơ khí phân loại 45 độ (Mechanical Diverter Arm)
    if (divertDir !== 0 && layers.sensors) {
      ctx.save();
      const pivotX = gateX - 22;
      const pivotY = divertDir > 0 ? (centerY - beltH / 2 + 4) : (centerY + beltH / 2 - 4);
      const armLength = 50;

      ctx.translate(pivotX, pivotY);
      ctx.rotate(this.armAngle);

      // Thân cần gạt kim loại
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.5;
      ctx.fillRect(0, -3.5, armLength, 7);
      ctx.strokeRect(0, -3.5, armLength, 7);

      // Chốt xoay bạc đạn
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#374151';
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // 4. Bảng biển chỉ dẫn tuyến phân loại tại cổng
    ctx.save();
    const tagY = divertDir > 0 ? (centerY - beltH / 2 - 28) : (centerY + beltH / 2 + 18);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.fillRect(gateX - 44, tagY, 88, 22);
    ctx.strokeRect(gateX - 44, tagY, 88, 22);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${name} (${postalCode})`, gateX, tagY + 11);

    ctx.fillStyle = color;
    ctx.font = '600 8px "JetBrains Mono", monospace';
    ctx.fillText(`CỔNG IoT #${this.config.gateIndex + 1}`, gateX, tagY + 19);

    ctx.restore();

    ctx.restore();
  }
}

/* ============================================================================
   5. SƠ ĐỒ MẶT BẰNG KHO THÔNG MINH (SMART WAREHOUSE LAYOUT & AMR)
   ============================================================================ */
/**
 * Lớp WarehouseEnvironment quản lý bản vẽ nền, Cổng Inbound, Cổng Outbound,
 * Hệ thống băng chuyền con lăn 60 FPS, và Robot tự hành AMR.
 */
class WarehouseEnvironment {
  constructor() {
    this.conveyorOffset = 0; // Độ dời chuyển động con lăn

    // Trạng thái Robot AMR (Autonomous Mobile Robot - Use Case UC-08)
    this.amr = {
      x: 320,
      y: 210,
      targetX: 980,
      speed: 65, // pixel/s
      direction: 1, // 1: sang phải, -1: sang trái
      width: 44,
      height: 32,
      beaconAngle: 0,
    };
  }

  /**
   * Cập nhật chuyển động nền (con lăn băng tải và tuần tra AMR)
   * @param {number} dt Delta time
   * @param {number} speedMultiplier
   */
  update(dt, speedMultiplier) {
    const effectiveDt = dt * speedMultiplier;

    // Cuộn con lăn băng chuyền tạo ảo giác chuyển động liên tục
    this.conveyorOffset = (this.conveyorOffset + CONFIG.MAIN_CONVEYOR_SPEED * effectiveDt) % CONFIG.ROLLER_SPACING;

    // Cập nhật tọa độ tuần tra robot AMR theo lộ trình A*
    const amr = this.amr;
    amr.x += amr.direction * amr.speed * effectiveDt;
    amr.beaconAngle += effectiveDt * 6; // Đèn hải đăng xoay

    if (amr.x >= amr.targetX && amr.direction === 1) {
      amr.direction = -1;
    } else if (amr.x <= 280 && amr.direction === -1) {
      amr.direction = 1;
    }
  }

  /**
   * Vẽ toàn bộ phối cảnh hạ tầng kho 2D
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width Chiều rộng canvas
   * @param {number} height Chiều cao canvas
   * @param {Object} layers
   */
  draw(ctx, width, height, layers) {
    // 1. Sàn kho công nghiệp và lưới phân tọa độ
    this.drawFloorAndGrid(ctx, width, height, layers.grid);

    // 2. Khu vực kệ hàng lưu kho (Storage Racks Aisle)
    if (layers.grid) {
      this.drawStorageRacks(ctx);
    }

    // 3. Robot tự hành AMR di chuyển trên sàn
    this.drawAMR(ctx);

    // 4. Băng chuyền chính với con lăn động
    this.drawMainConveyor(ctx, width);

    // 5. Cổng tiếp nhận hàng Inbound (Receiving Dock)
    this.drawInboundGate(ctx);

    // 6. Các cổng xuất hàng Outbound (Shipping Docks)
    this.drawOutboundDocks(ctx);
  }

  /**
   * Vẽ sàn kho epoxy và lưới điều phối (Occupancy Grid Map)
   */
  drawFloorAndGrid(ctx, width, height, showGrid) {
    // Nền tối công nghiệp
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, width, height);

    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      ctx.lineWidth = 1;
      const gridSize = 40;

      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vạch sơn an toàn màu vàng đen viền kho
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.2)';
      ctx.lineWidth = 2;
      ctx.setLineDash([12, 12]);
      ctx.strokeRect(20, 20, width - 40, height - 40);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  /**
   * Vẽ khu vực ô kệ lưu kho (Storage Racks)
   */
  drawStorageRacks(ctx) {
    ctx.save();
    const rackRows = [
      { x: 300, y: 70, w: 760, h: 48, label: 'DÃY KỆ A (PALLET STORAGE AISLE - NORTH)' },
      { x: 300, y: 720, w: 760, h: 48, label: 'DÃY KỆ B (PALLET STORAGE AISLE - SOUTH)' }
    ];

    rackRows.forEach(rack => {
      // Khung kệ kim loại
      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.fillRect(rack.x, rack.y, rack.w, rack.h);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rack.x, rack.y, rack.w, rack.h);

      // Các ô kệ con với hàng hóa lưu trữ
      const bayW = 38;
      for (let bx = rack.x + 4; bx < rack.x + rack.w - bayW; bx += bayW + 4) {
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
        ctx.strokeRect(bx, rack.y + 4, bayW, rack.h - 8);

        // Mô phỏng thùng hàng trên kệ
        ctx.fillStyle = 'rgba(180, 83, 9, 0.7)';
        ctx.fillRect(bx + 4, rack.y + 8, bayW - 8, rack.h - 16);
      }

      // Nhãn kệ
      ctx.fillStyle = '#64748b';
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.fillText(rack.label, rack.x + 10, rack.y - 4);
    });

    ctx.restore();
  }

  /**
   * Vẽ Robot tự hành AMR (Autonomous Mobile Robot) di chuyển hỗ trợ kho
   */
  drawAMR(ctx) {
    const amr = this.amr;
    ctx.save();
    ctx.translate(amr.x, amr.y);

    // Vạch lộ trình màu xanh đặc trưng của thuật toán A* (A-Star Trail)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(280 - amr.x, 0);
    ctx.lineTo(amr.targetX - amr.x, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // Thân robot AMR
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-amr.width / 2, -amr.height / 2, amr.width, amr.height);
    ctx.strokeRect(-amr.width / 2, -amr.height / 2, amr.width, amr.height);

    // Pallet hàng đang chuyên chở trên lưng AMR
    ctx.fillStyle = 'rgba(217, 119, 6, 0.85)';
    ctx.fillRect(-amr.width / 2 + 6, -amr.height / 2 + 4, amr.width - 12, amr.height - 8);

    // Đèn hải đăng chớp tín hiệu an toàn
    const beaconX = amr.direction > 0 ? (amr.width / 2 - 8) : (-amr.width / 2 + 8);
    ctx.beginPath();
    ctx.arc(beaconX, 0, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Nhãn robot
    ctx.fillStyle = '#94a3b8';
    ctx.font = '700 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('AMR-01 (A*)', 0, amr.height / 2 + 11);

    ctx.restore();
  }

  /**
   * Vẽ Băng tải chính (Main Sorting Conveyor Belt) với con lăn quay mượt 60 FPS
   */
  drawMainConveyor(ctx, width) {
    const startX = 110;
    const endX = 1160;
    const y = CONFIG.MAIN_CONVEYOR_Y - CONFIG.CONVEYOR_HEIGHT / 2;
    const h = CONFIG.CONVEYOR_HEIGHT;

    ctx.save();

    // Nền băng tải cao su công nghiệp
    ctx.fillStyle = '#111827';
    ctx.fillRect(startX, y, endX - startX, h);

    // Con lăn cơ khí chuyển động liên tục theo delta-time
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2.5;

    for (let rx = startX + this.conveyorOffset; rx < endX; rx += CONFIG.ROLLER_SPACING) {
      ctx.beginPath();
      ctx.moveTo(rx, y + 3);
      ctx.lineTo(rx, y + h - 3);
      ctx.stroke();
    }

    // Thanh ray bảo hộ kim loại 2 bên mép băng tải
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.moveTo(startX, y + h);
    ctx.lineTo(endX, y + h);
    ctx.stroke();

    // Mũi tên chỉ hướng luồng hàng hóa (Flow Direction Indicators)
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.font = '700 14px monospace';
    for (let ax = startX + 60; ax < endX - 40; ax += 180) {
      ctx.fillText('>>>', ax, y + h / 2 + 5);
    }

    ctx.restore();
  }

  /**
   * Vẽ Cổng tiếp nhận hàng hóa Inbound (Receiving Dock & Vision Arch)
   */
  drawInboundGate(ctx) {
    const x = 30;
    const y = CONFIG.MAIN_CONVEYOR_Y - 50;
    const w = 80;
    const h = 100;

    ctx.save();

    // Khung cửa Inbound Dock
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // Cổng vòm thị giác máy tính AI (Overhead Camera Scanner Arch)
    ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
    ctx.fillRect(x + w - 16, y - 8, 16, h + 16);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + w - 16, y - 8, 16, h + 16);

    // Tia laser quét hàng Inbound
    ctx.strokeStyle = '#22c55e';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w - 8, y);
    ctx.lineTo(x + w - 8, y + h);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Biển tên cổng Inbound
    ctx.fillStyle = '#22c55e';
    ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CỔNG INBOUND', x + w / 2, y + 16);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '600 8px "JetBrains Mono", monospace';
    ctx.fillText('YOLOv12 SCAN', x + w / 2, y + 28);

    ctx.restore();
  }

  /**
   * Vẽ các Cổng xuất hàng Outbound (Shipping Docks)
   */
  drawOutboundDocks(ctx) {
    CONFIG.DESTINATIONS.forEach(dest => {
      ctx.save();
      const { gateX, targetDockY, color, name, postalCode, divertDir } = dest;
      const dockW = 86;
      const dockH = 50;
      const dockX = gateX - dockW / 2;
      const dockY = divertDir > 0 ? (targetDockY) : (targetDockY - dockH);

      // Cửa cuốn xuất hàng công nghiệp
      ctx.fillStyle = '#111827';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.fillRect(dockX, dockY, dockW, dockH);
      ctx.strokeRect(dockX, dockY, dockW, dockH);

      // Vạch nan cửa cuốn
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      for (let sy = dockY + 6; sy < dockY + dockH; sy += 7) {
        ctx.beginPath();
        ctx.moveTo(dockX + 3, sy);
        ctx.lineTo(dockX + dockW - 3, sy);
        ctx.stroke();
      }

      // Đèn tín hiệu xuất bến (Dock Bay Light)
      ctx.beginPath();
      ctx.arc(dockX + dockW - 12, dockY + 12, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Nhãn cửa xuất
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 9px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`DOCK ${name.toUpperCase()}`, dockX + 8, dockY + 18);

      ctx.fillStyle = color;
      ctx.font = '600 8px "JetBrains Mono", monospace';
      ctx.fillText(`MÃ: ${postalCode}`, dockX + 8, dockY + 30);

      ctx.restore();
    });
  }
}

/* ============================================================================
   6. BỘ ĐIỀU PHỐI MÔ PHỎNG TRUNG TÂM (CENTRAL SIMULATION ENGINE)
   ============================================================================ */
/**
 * Lớp SimulationEngine tích hợp toàn bộ các phân hệ và điều khiển vòng lặp requestAnimationFrame
 */
class SimulationEngine {
  constructor() {
    this.canvas = document.getElementById('simulationCanvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false }); // Tối ưu hiệu năng render không cần alpha toàn canvas
    this.fpsCounter = new FPSCounter();
    this.environment = new WarehouseEnvironment();

    // Quản lý danh sách đối tượng
    this.parcels = [];
    this.sortingGates = CONFIG.DESTINATIONS.map(cfg => new SortingGate(cfg));
    this.totalSorted = 0;
    this.parcelSequenceId = 101;
    this.byteTrackSeqId = 1;

    // Trạng thái vận hành
    this.isPlaying = true;
    this.speedMultiplier = 1.0;
    this.spawnTimer = 0;

    // Cấu hình các lớp hiển thị
    this.layers = {
      aiBoxes: true,
      trails: true,
      sensors: true,
      grid: true,
      hud: true,
    };

    // Tooltip tương tác chuột
    this.hoveredParcel = null;
    this.mousePos = { x: -100, y: -100 };
    this.domTooltip = document.getElementById('parcelTooltip');

    // Khởi tạo hệ thống
    this.initCanvasSize();
    this.bindEvents();
    this.initWebSocket();
    this.logTelemetry('[HỆ THỐNG] Engine Canvas 2D 60 FPS đã khởi động.');

    // Bắt đầu vòng lặp render
    this.lastFrameTime = performance.now();
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  /**
   * Thiết lập độ phân giải Canvas chuẩn High-DPI (Retina / 4K) chống mờ hình
   * và tính toán ma trận scale tự động thích ứng với mọi kích thước màn hình
   */
  initCanvasSize() {
    const container = document.getElementById('viewportContainer');
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;

    this.canvas.width = this.canvasWidth * dpr;
    this.canvas.height = this.canvasHeight * dpr;

    // Tự động scale thích ứng màn hình
    const scaleX = this.canvasWidth / CONFIG.BASE_WIDTH;
    const scaleY = this.canvasHeight / CONFIG.BASE_HEIGHT;
    this.viewScale = Math.min(scaleX, scaleY, 1.15);
    this.viewOffsetX = (this.canvasWidth - CONFIG.BASE_WIDTH * this.viewScale) / 2;
    this.viewOffsetY = (this.canvasHeight - CONFIG.BASE_HEIGHT * this.viewScale) / 2;

    this.dpr = dpr;
  }

  /**
   * Kết nối kênh WebSocket 60 FPS từ Backend FastAPI (nếu chạy server)
   * Tự động fallback về chế độ mô phỏng client mượt mà khi chạy standalone
   */
  initWebSocket() {
    if (window.location.protocol === 'file:') return;
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws/simulation/stream`;
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.logTelemetry('[WEBSOCKET] Đã kết nối luồng Backend FastAPI 60 FPS.');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.total_sorted !== undefined) {
            this.totalSorted = Math.max(this.totalSorted, data.total_sorted);
            this.updateCountersDom();
          }
        } catch (e) {}
      };

      this.socket.onclose = () => {
        this.logTelemetry('[WEBSOCKET] Chuyển sang mô phỏng độc lập (Client-side 60 FPS).');
      };
    } catch (e) {}
  }

  /**
   * Đăng ký các sự kiện tương tác giao diện và phím tắt
   */
  bindEvents() {
    window.addEventListener('resize', () => {
      this.initCanvasSize();
    });

    // Nút Play / Pause
    const btnPlayPause = document.getElementById('btnPlayPause');
    const playPauseIcon = document.getElementById('playPauseIcon');
    const playPauseText = document.getElementById('playPauseText');

    const togglePlay = () => {
      this.isPlaying = !this.isPlaying;
      if (this.isPlaying) {
        playPauseIcon.innerHTML = '&#10074;&#10074;';
        playPauseText.textContent = 'Tạm dừng (Space)';
        btnPlayPause.classList.remove('btn-secondary');
        btnPlayPause.classList.add('btn-primary');
        this.logTelemetry('[ĐIỀU HÀNH] Mô phỏng tiếp tục chạy.');
      } else {
        playPauseIcon.innerHTML = '&#9658;';
        playPauseText.textContent = 'Tiếp tục (Space)';
        btnPlayPause.classList.remove('btn-primary');
        btnPlayPause.classList.add('btn-secondary');
        this.logTelemetry('[ĐIỀU HÀNH] Mô phỏng đã tạm dừng.');
      }
    };

    btnPlayPause.addEventListener('click', togglePlay);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        togglePlay();
      }
    });

    // Nút Cấp kiện hàng mới (Manual Spawn)
    document.getElementById('btnSpawn').addEventListener('click', () => {
      this.spawnParcel();
    });

    // Nút Đặt lại hệ thống (Reset)
    document.getElementById('btnReset').addEventListener('click', () => {
      this.parcels = [];
      this.totalSorted = 0;
      this.updateCountersDom();
      this.logTelemetry('[HỆ THỐNG] Đã đặt lại trạng thái kho.');
    });

    // Điều chỉnh tốc độ mô phỏng
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.speedMultiplier = parseFloat(btn.dataset.speed);
        this.logTelemetry(`[TỐC ĐỘ] Thiết lập hệ số mô phỏng: ${this.speedMultiplier}x`);
      });
    });

    // Checkbox bật/tắt các lớp đồ họa
    document.getElementById('toggleAiBoxes').addEventListener('change', (e) => { this.layers.aiBoxes = e.target.checked; });
    document.getElementById('toggleTrails').addEventListener('change', (e) => { this.layers.trails = e.target.checked; });
    document.getElementById('toggleSensors').addEventListener('change', (e) => { this.layers.sensors = e.target.checked; });
    document.getElementById('toggleGrid').addEventListener('change', (e) => { this.layers.grid = e.target.checked; });
    document.getElementById('toggleHud').addEventListener('change', (e) => { this.layers.hud = e.target.checked; });

    // Sự kiện rê chuột xem thông tin kiện hàng (Raycasting)
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;

      this.mousePos.x = (rawX - this.viewOffsetX) / this.viewScale;
      this.mousePos.y = (rawY - this.viewOffsetY) / this.viewScale;

      let found = null;
      for (let i = this.parcels.length - 1; i >= 0; i--) {
        if (this.parcels[i].containsPoint(this.mousePos.x, this.mousePos.y)) {
          found = this.parcels[i];
          break;
        }
      }

      this.hoveredParcel = found;
      this.updateTooltip(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredParcel = null;
      if (this.domTooltip) this.domTooltip.classList.remove('active');
    });
  }

  /**
   * Cập nhật thông số Tooltip khi người dùng trỏ vào kiện hàng
   */
  updateTooltip(clientX, clientY) {
    if (!this.domTooltip) return;

    if (this.hoveredParcel) {
      const p = this.hoveredParcel;
      document.getElementById('tooltipId').textContent = p.id;
      document.getElementById('tooltipTrackId').textContent = `#${p.trackId}`;
      document.getElementById('tooltipDest').textContent = `${p.destination.name} (${p.destination.city})`;
      document.getElementById('tooltipZip').textContent = p.destination.postalCode;
      document.getElementById('tooltipWeight').textContent = `${p.weight} kg`;
      document.getElementById('tooltipConf').textContent = p.confidence;
      document.getElementById('tooltipStatus').textContent = p.status;

      this.domTooltip.style.left = `${clientX}px`;
      this.domTooltip.style.top = `${clientY}px`;
      this.domTooltip.classList.add('active');
    } else {
      this.domTooltip.classList.remove('active');
    }
  }

  /**
   * Sinh kiện hàng mới đưa vào Cổng Inbound
   */
  spawnParcel() {
    // Lựa chọn ngẫu nhiên 1 trong 4 tuyến đích
    const dest = CONFIG.DESTINATIONS[Math.floor(Math.random() * CONFIG.DESTINATIONS.length)];
    const parcel = new Parcel(this.parcelSequenceId++, this.byteTrackSeqId++, dest);
    this.parcels.push(parcel);

    this.updateCountersDom();
    this.logTelemetry(`[INBOUND] Tiếp nhận ${parcel.id} (Tuyến: ${dest.name} - ${dest.city}).`);
  }

  /**
   * Cập nhật chỉ số kiện hàng lên Header Telemetry
   */
  updateCountersDom() {
    const domSorted = document.getElementById('totalSortedCount');
    const domActive = document.getElementById('activeParcelsCount');
    const domActiveTracks = document.getElementById('activeTracksText');

    if (domSorted) domSorted.textContent = this.totalSorted;
    if (domActive) domActive.textContent = this.parcels.length;
    if (domActiveTracks) domActiveTracks.textContent = `Active Tracks: ${this.parcels.length}`;
  }

  /**
   * Xuất nhật ký sự kiện vào thanh trạng thái Footer (SCADA Telemetry Feed)
   * @param {string} msg
   */
  logTelemetry(msg) {
    const ticker = document.getElementById('logTicker');
    if (!ticker) return;

    const span = document.createElement('span');
    span.className = 'log-item';
    span.textContent = msg;

    ticker.prepend(span);

    // Giữ tối đa 8 dòng log gần nhất
    while (ticker.children.length > 8) {
      ticker.removeChild(ticker.lastChild);
    }
  }

  /**
   * VÒNG LẶP RENDER CHUẨN 60 FPS (CORE RENDER LOOP)
   * Thực thi bằng requestAnimationFrame, đồng bộ theo delta-time
   * @param {DOMHighResTimeStamp} timestamp
   */
  renderLoop(timestamp) {
    // 1. Tính toán delta-time chính xác thông qua FPSCounter
    const dt = this.fpsCounter.update(timestamp);

    // 2. Cập nhật mô phỏng vật lý và trạng thái logic
    if (this.isPlaying) {
      // Chu kỳ sinh kiện tự động
      this.spawnTimer += dt * this.speedMultiplier;
      if (this.spawnTimer >= CONFIG.SPAWN_INTERVAL_SEC) {
        this.spawnParcel();
        this.spawnTimer = 0;
      }

      // Cập nhật nền kho và robot AMR
      this.environment.update(dt, this.speedMultiplier);

      // Cập nhật các cổng phân loại cơ khí IoT
      this.sortingGates.forEach(gate => gate.update(dt));

      // Cập nhật vị trí các kiện hàng
      for (let i = this.parcels.length - 1; i >= 0; i--) {
        const p = this.parcels[i];
        p.update(dt, this.speedMultiplier, this.sortingGates);

        // Khi kiện đã bốc dỡ xong ở Cổng Outbound
        if (p.status === 'FINISHED') {
          this.totalSorted++;
          this.logTelemetry(`[OUTBOUND] ${p.id} đã xếp vào Pallet ${p.destination.name}.`);
          this.parcels.splice(i, 1);
          this.updateCountersDom();
        }
      }
    }

    // 3. Kết xuất đồ họa lên HTML5 Canvas (Z-Index Rendering)
    this.render();

    // 4. Lên lịch khung hình kế tiếp (Chuẩn 60 FPS)
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  /**
   * Thực thi lệnh vẽ toàn bộ khung nhìn đồ họa với scale thích ứng
   */
  render() {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    // Reset transform và xóa khung hình cũ
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Áp dụng scale thích ứng cho bản vẽ kho
    ctx.save();
    ctx.translate(this.viewOffsetX, this.viewOffsetY);
    ctx.scale(this.viewScale, this.viewScale);

    // Lớp 1: Mặt bằng kho, lưới sàn, kệ lưu trữ, AMR, Băng tải, Cổng Inbound & Outbound
    this.environment.draw(ctx, CONFIG.BASE_WIDTH, CONFIG.BASE_HEIGHT, this.layers);

    // Lớp 2: Cổng phân loại cơ khí IoT & vạch cảm biến quang
    this.sortingGates.forEach(gate => gate.draw(ctx, this.layers));

    // Lớp 3: Các kiện hàng, Bounding Box YOLO, và Tracking Trail ByteTrack
    this.parcels.forEach(p => p.draw(ctx, this.layers));

    ctx.restore();

    // Lớp 4: Bộ đếm FPS góc màn hình và biểu đồ Sparkline (Vẽ cố định góc viewport)
    if (this.layers.hud) {
      this.fpsCounter.renderHUD(ctx, w, h);
    }
  }
}

/* ============================================================================
   7. ĐIỂM VÀO ỨNG DỤNG (ENTRY POINT)
   ============================================================================ */
window.addEventListener('DOMContentLoaded', () => {
  // Khởi tạo Engine mô phỏng khi tài liệu HTML đã sẵn sàng
  window.simulationApp = new SimulationEngine();
});

