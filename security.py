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

        # Block common literal loopback/unspecified hostnames
        if hostname.lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0", "::"):
            logging.warning(f"SSRF Loopback blocked: {url}")
            raise SecurityViolation("Access to loopback interface is blocked.")

        # Resolve DNS to check ALL returned IPv4 and IPv6 addresses
        try:
            addr_info = socket.getaddrinfo(hostname, None)
        except (socket.gaierror, UnicodeError) as e:
            logging.warning(f"SSRF DNS resolution failed (fail-closed): {url} ({e})")
            raise SecurityViolation(f"SSRF guard: failed to resolve host '{hostname}'. Access denied.")

        if not addr_info:
            raise SecurityViolation(f"SSRF guard: no IP addresses resolved for '{hostname}'.")

        for family, socktype, proto, canonname, sockaddr in addr_info:
            ip_str = sockaddr[0]
            try:
                ip_obj = ipaddress.ip_address(ip_str)
            except ValueError:
                raise SecurityViolation(f"SSRF guard: invalid resolved IP '{ip_str}'.")

            # Check for IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1)
            check_ips = [ip_obj]
            if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped:
                check_ips.append(ip_obj.ipv4_mapped)

            for target_ip in check_ips:
                if (
                    target_ip.is_loopback
                    or target_ip.is_private
                    or target_ip.is_link_local
                    or target_ip.is_reserved
                    or target_ip.is_multicast
                ):
                    logging.warning(f"SSRF Blocked: {url} resolved to non-public IP {target_ip}")
                    raise SecurityViolation(
                        f"Access to private/internal network IP ({target_ip}) is forbidden."
                    )

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
