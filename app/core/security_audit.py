"""
Security Audit Engine: Automated scanner for codebase integrity, secret leaks, and security policies.
Căn cứ theo Task Jira LOG-124 và kỹ năng .agents/skills/code-review/SKILL.md.
"""
import os
import re
from typing import Dict, Any, List
from app.core.config import settings
from app.core.security import validate_password_strength, WEAK_PASSWORD_BLACKLIST


class SecurityAuditor:
    """Công cụ tự động kiểm toán an ninh mã nguồn và chính sách bảo mật"""

    def __init__(self, root_dir: str = "."):
        self.root_dir = os.path.abspath(root_dir)

    def audit_gitignore_policies(self) -> Dict[str, Any]:
        """Kiểm tra file .gitignore có bảo vệ các tệp nhạy cảm (.env, credentials) không"""
        gitignore_path = os.path.join(self.root_dir, ".gitignore")
        if not os.path.exists(gitignore_path):
            return {
                "status": "FAIL",
                "message": "Không tìm thấy file .gitignore trong thư mục gốc dự án!"
            }

        with open(gitignore_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        required_patterns = [".env", "*.log"]
        missing = [p for p in required_patterns if p not in content]

        return {
            "status": "PASS" if not missing else "FAIL",
            "has_env_ignored": ".env" in content,
            "missing_patterns": missing,
            "message": "File .gitignore đã bảo vệ an toàn các tệp nhạy cảm (.env)." if not missing else f"Thiếu quy tắc bảo vệ: {missing}"
        }

    def scan_for_exposed_secrets(self) -> Dict[str, Any]:
        """Quét mã nguồn production tìm kiếm các chuỗi khóa bí mật, API key hoặc mật khẩu hardcode"""
        patterns = {
            "HARDCODED_DEFAULT_PASSWORD": r'["\'](admin123|operator123|viewer123|123456)["\']',
            "AWS_SECRET_KEY": r'AKIA[0-9A-Z]{16}',
            "PRIVATE_KEY_HEADER": r'-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----',
        }

        findings = []
        scanned_count = 0

        # Chỉ quét mã nguồn ứng dụng production (bỏ qua tests vì tests kiểm tra blacklist)
        target_dirs = ["app"]
        for d in target_dirs:
            full_d = os.path.join(self.root_dir, d)
            if not os.path.exists(full_d):
                continue
            for root, _, files in os.walk(full_d):
                for file in files:
                    if file.endswith(".py"):
                        scanned_count += 1
                        file_path = os.path.join(root, file)
                        try:
                            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                                in_blacklist_def = False
                                for line_no, line in enumerate(f, 1):
                                    # Bỏ qua khối khai báo WEAK_PASSWORD_BLACKLIST trong security.py
                                    if "WEAK_PASSWORD_BLACKLIST" in line:
                                        in_blacklist_def = True
                                    if in_blacklist_def:
                                        if "}" in line:
                                            in_blacklist_def = False
                                        continue

                                    # Bỏ qua mảng test_weak trong security_audit.py
                                    if "test_weak" in line:
                                        continue

                                    for rule_name, regex in patterns.items():
                                        if re.search(regex, line, re.IGNORECASE):
                                            rel_path = os.path.relpath(file_path, self.root_dir)
                                            findings.append({
                                                "file": rel_path,
                                                "line": line_no,
                                                "rule": rule_name,
                                                "snippet": line.strip()[:80]
                                            })
                        except Exception:
                            pass

        return {
            "status": "PASS" if not findings else "WARN",
            "scanned_files_count": scanned_count,
            "findings_count": len(findings),
            "findings": findings,
            "message": "Không phát hiện mật khẩu yếu mặc định hoặc secret rò rỉ trong mã nguồn production." if not findings else f"Phát hiện {len(findings)} điểm cần xem xét!"
        }

    def audit_password_policies(self) -> Dict[str, Any]:
        """Kiểm toán chính sách mật khẩu mạnh và mật khẩu khởi tạo seed"""
        test_weak = ["123456", "admin123", "operator123", "password", "short"]
        weak_blocked = True
        for pw in test_weak:
            is_valid, _ = validate_password_strength(pw)
            if is_valid:
                weak_blocked = False
                break

        test_strong = "Admin@ICTU2026!Secure"
        strong_passed, strong_msg = validate_password_strength(test_strong)

        # Kiểm tra mật khẩu khởi tạo trong config
        initial_admin_ok, _ = validate_password_strength(settings.INITIAL_ADMIN_PASSWORD)

        all_ok = weak_blocked and strong_passed and initial_admin_ok

        return {
            "status": "PASS" if all_ok else "FAIL",
            "weak_passwords_blocked": weak_blocked,
            "strong_password_accepted": strong_passed,
            "initial_admin_password_strong": initial_admin_ok,
            "message": "Chính sách mật khẩu mạnh và mật khẩu khởi tạo đạt chuẩn bảo mật 100%." if all_ok else "Chính sách mật khẩu chưa đạt yêu cầu!"
        }

    def run_full_security_audit(self) -> Dict[str, Any]:
        """Thực thi toàn bộ bộ kiểm toán an ninh mã nguồn"""
        gitignore_res = self.audit_gitignore_policies()
        secrets_res = self.scan_for_exposed_secrets()
        pw_res = self.audit_password_policies()

        overall_pass = (
            gitignore_res["status"] == "PASS" and
            secrets_res["status"] == "PASS" and
            pw_res["status"] == "PASS"
        )

        return {
            "overall_status": "COMPLIANT" if overall_pass else "NON_COMPLIANT",
            "project_code": settings.PROJECT_CODE,
            "audit_sections": {
                "gitignore_protection": gitignore_res,
                "secret_and_password_scan": secrets_res,
                "password_strength_policy": pw_res
            },
            "summary": "Toàn bộ hệ thống mã nguồn đáp ứng đầy đủ tiêu chuẩn kiểm toán bảo mật LOG-124." if overall_pass else "Cần rà soát và khắc phục các điểm chưa đạt."
        }


security_auditor = SecurityAuditor()
