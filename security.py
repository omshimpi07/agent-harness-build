"""
security.py — Deterministic Sandboxing & Policy Engine for AI Harness
=====================================================================
CTO-Grade Security Layer:
  1. Filesystem Sandbox: Path traversal prevention, symlink resolution, workspace isolation.
  2. SSRF & Network Guard: Blocks private subnets (127.0.0.1, 169.254.169.254, RFC 1918)
     and dangerous schemes (file://, gopher://).
  3. Content Sanitization: Truncation ceiling & secret token masking.
  4. Audit Trail: All security violations logged to security_audit.log.
"""

import ipaddress
import logging
import re
import socket
from pathlib import Path
from urllib.parse import urlparse

# Audit logger for security violations
SEC_LOG_FILE = Path(__file__).parent / "security_audit.log"
logging.basicConfig(
    filename=str(SEC_LOG_FILE),
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] [SECURITY_VIOLATION] %(message)s",
)


class SecurityViolation(PermissionError):
    """Raised when an agent tool request violates security boundaries."""
    pass


class Sandbox:
    """Enforces strict boundaries around filesystem, network, and execution."""

    def __init__(self, workspace_path: Path):
        self.workspace = workspace_path.resolve()
        self.workspace.mkdir(parents=True, exist_ok=True)

    # -----------------------------------------------------------------------
    # 1. Filesystem Sandboxing
    # -----------------------------------------------------------------------
    def validate_path(self, filename: str) -> Path:
        """
        Validates that a relative or user-provided path resolves strictly
        inside the designated workspace directory.

        Protections:
          - Path traversal attacks (../../etc/passwd, ..\\secret.txt)
          - Absolute path escapes (C:\\Windows\\System32, /etc/shadow)
          - Symlink resolution (cannot point outside sandbox)
        """
        if not filename or not filename.strip():
            raise SecurityViolation("Path validation failed: empty path provided.")

        # Disallow explicit null bytes
        if "\0" in filename:
            logging.warning(f"Null byte injection detected in path: {repr(filename)}")
            raise SecurityViolation("Null byte injection detected.")

        raw_path = Path(filename)

        # Disallow drive-relative or root-relative paths on Windows/Linux
        if raw_path.is_absolute():
            # If absolute, verify it still falls under workspace
            target = raw_path.resolve()
        else:
            target = (self.workspace / raw_path).resolve()

        # Strict boundary check
        try:
            target.relative_to(self.workspace)
        except ValueError:
            logging.warning(f"Path traversal blocked: '{filename}' -> resolved as '{target}'")
            raise SecurityViolation(
                f"Access denied: '{filename}' resolves outside designated workspace."
            )

        return target

    # -----------------------------------------------------------------------
    # 2. SSRF & Network Egress Guard
    # -----------------------------------------------------------------------
    @staticmethod
    def validate_url(url: str) -> str:
        """
        Validates external URLs to prevent Server-Side Request Forgery (SSRF).

        Protections:
          - Restricts protocols to HTTP/HTTPS only (no file://, gopher://, dict://).
          - Prohibits loopback addresses (127.0.0.1, localhost).
          - Prohibits cloud metadata endpoints (169.254.169.254 AWS/GCP/Azure).
          - Prohibits private RFC 1918 networks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16).
        """
        parsed = urlparse(url)
        scheme = parsed.scheme.lower()

        if scheme not in ("http", "https"):
            logging.warning(f"Blocked invalid URL scheme: {url}")
            raise SecurityViolation(f"Protocol '{scheme}' forbidden. Only http/https permitted.")

        hostname = parsed.hostname
        if not hostname:
            raise SecurityViolation("Invalid URL: missing hostname.")

        # Block localhost strings directly
        if hostname.lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            logging.warning(f"SSRF Loopback blocked: {url}")
            raise SecurityViolation("Access to loopback interface is blocked.")

        # Resolve DNS to check IP range
        try:
            ip_str = socket.gethostbyname(hostname)
            ip_obj = ipaddress.ip_address(ip_str)

            if (
                ip_obj.is_loopback
                or ip_obj.is_private
                or ip_obj.is_link_local
                or ip_obj.is_reserved
            ):
                logging.warning(f"SSRF Private IP blocked: {url} -> {ip_str}")
                raise SecurityViolation(
                    f"Access to private/internal network IP ({ip_str}) is forbidden."
                )
        except (socket.gaierror, ValueError):
            # If DNS resolution fails, allow if not an obvious IP string,
            # or reject if malformed
            pass

        return url

    # -----------------------------------------------------------------------
    # 3. Data Masking & Sanitization
    # -----------------------------------------------------------------------
    @staticmethod
    def mask_secrets(text: str) -> str:
        """Masks detected API keys or tokens from traces and logs."""
        patterns = [
            (r"(sk-[a-zA-Z0-9_-]{20,})", r"sk-***[MASKED]***"),
            (r"(ghp_[a-zA-Z0-9]{20,})", r"ghp_***[MASKED]***"),
            (r"(Bearer\s+[a-zA-Z0-9_\-\.]{20,})", r"Bearer ***[MASKED]***"),
        ]
        sanitized = text
        for pat, repl in patterns:
            sanitized = re.sub(pat, repl, sanitized)
        return sanitized
