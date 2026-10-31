"""
Bộ kiểm thử đơn vị chuyên sâu: Kiểm toán An ninh, Mật khẩu Mạnh & Phân quyền RBAC (LOG-124)
Tác giả kiểm thử: Nguyễn Thị Thu Hà (Task LOG-124)
Tham chiếu kế hoạch: docs/plans/security-audit.md
Tương thích chuẩn unittest của Python.
"""
import os
import sys
import unittest
import warnings
from datetime import timedelta

warnings.filterwarnings("ignore", category=DeprecationWarning)
warnings.filterwarnings("ignore", category=ResourceWarning)

# Đảm bảo import được package app từ thư mục gốc dự án
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.core.security import (
    validate_password_strength,
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    WEAK_PASSWORD_BLACKLIST
)
from app.core.security_audit import security_auditor
from app.models import User


class TestSecurityAuditAndHardening(unittest.TestCase):
    """Kiểm thử toàn diện chính sách bảo mật, chống rò rỉ secret và RBAC"""

    def test_weak_password_blacklist_rejection(self):
        """Kiểm tra toàn bộ danh sách mật khẩu yếu mặc định (admin123, 123456...) đều bị từ chối"""
        weak_passwords = [
            "admin123",
            "operator123",
            "viewer123",
            "123456",
            "12345678",
            "password",
            "qwerty",
            "short1!",  # Quá ngắn (< 8 ký tự)
            "ALLUPPERCASE123!",  # Thiếu chữ thường
            "alllowercase123!",  # Thiếu chữ hoa
            "NoDigitsAtAll!@#",  # Thiếu chữ số
            "NoSpecialChar1234",  # Thiếu ký tự đặc biệt
        ]
        for pwd in weak_passwords:
            is_valid, msg = validate_password_strength(pwd)
            self.assertFalse(is_valid, f"Mật khẩu yếu '{pwd}' phải bị từ chối! Lỗi: {msg}")

    def test_strong_password_acceptance(self):
        """Kiểm tra các mật khẩu mạnh đạt chuẩn đều được chấp nhận hợp lệ"""
        strong_passwords = [
            "Admin@ICTU2026!Secure",
            "Operator@ICTU2026!Secure",
            "Viewer@ICTU2026!Secure",
            "ThuHa#Logistics_2026",
            "P@ssw0rdSecureComplex!",
        ]
        for pwd in strong_passwords:
            is_valid, msg = validate_password_strength(pwd)
            self.assertTrue(is_valid, f"Mật khẩu mạnh '{pwd}' phải được chấp nhận! Thông báo: {msg}")

    def test_password_hashing_and_verification(self):
        """Kiểm tra thuật toán băm một chiều mật khẩu an toàn và chống so khớp thô"""
        raw_pwd = "MySecretPassword@2026!"
        hashed = get_password_hash(raw_pwd)

        # Mật khẩu băm không được trùng với plain-text
        self.assertNotEqual(raw_pwd, hashed)

        # Kiểm tra xác thực đúng mật khẩu
        self.assertTrue(verify_password(raw_pwd, hashed))

        # Kiểm tra từ chối sai mật khẩu
        self.assertFalse(verify_password("WrongPassword@2026!", hashed))

    def test_jwt_token_generation_and_tampering(self):
        """Kiểm tra sinh JWT Access Token, xác thực vai trò RBAC và chống sửa đổi chữ ký"""
        user_id = 99
        role = "ADMIN"
        token = create_access_token(subject=user_id, role=role, expires_delta=timedelta(minutes=30))

        # Giải mã token hợp lệ
        payload = decode_access_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["sub"], str(user_id))
        self.assertEqual(payload["role"], role)
        self.assertIn("exp", payload)

        # Giả lập tấn công sửa đổi token (Tampering signature)
        tampered_token = token[:-4] + "fake"
        invalid_payload = decode_access_token(tampered_token)
        self.assertIsNone(invalid_payload, "Token bị sửa đổi chữ ký phải bị từ chối giải mã!")

    def test_initial_config_seed_passwords_are_strong(self):
        """Kiểm tra các mật khẩu seed trong file config đạt chuẩn bảo mật mạnh (LOG-124)"""
        for role_name, pwd in [
            ("ADMIN", settings.INITIAL_ADMIN_PASSWORD),
            ("OPERATOR", settings.INITIAL_OPERATOR_PASSWORD),
            ("VIEWER", settings.INITIAL_VIEWER_PASSWORD),
        ]:
            is_valid, msg = validate_password_strength(pwd)
            self.assertTrue(is_valid, f"Mật khẩu khởi tạo {role_name} ('{pwd}') phải đạt chuẩn mạnh! {msg}")

    def test_security_auditor_full_compliance_report(self):
        """Kiểm tra công cụ kiểm toán tự động SecurityAuditor báo cáo COMPLIANT 100%"""
        report = security_auditor.run_full_security_audit()

        self.assertEqual(report["overall_status"], "COMPLIANT", f"Kiểm toán an ninh không đạt: {report['summary']}")
        self.assertEqual(report["audit_sections"]["gitignore_protection"]["status"], "PASS")
        self.assertEqual(report["audit_sections"]["secret_and_password_scan"]["status"], "PASS")
        self.assertEqual(report["audit_sections"]["password_strength_policy"]["status"], "PASS")


if __name__ == "__main__":
    unittest.main()

