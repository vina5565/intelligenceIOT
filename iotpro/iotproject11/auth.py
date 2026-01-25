# auth.py
# -*- coding: utf-8 -*-

from __future__ import annotations

import base64
import hashlib
import hmac
import os
import re
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import jwt  # PyJWT

# =========================
# ÀÔ·Â °ËÁõ ±ÔÄ¢
# =========================

# username: ¿µ¹®¸¸, 4~20ÀÚ
USERNAME_RE = re.compile(r"^[A-Za-z]{4,20}$")

# password:
# - ±æÀÌ 8~32
# - ¿µ¹®(A-Z, a-z)¸¸ »ç¿ë
# - Æ¯¼ö¹®ÀÚ ÃÖ¼Ò 1°³ Æ÷ÇÔ
# - Çã¿ë Æ¯¼ö¹®ÀÚ ¹üÀ§ ¸í½Ã
ALLOWED_SPECIALS = "!@#$%^&*()"
PASSWORD_RE = re.compile(
    rf"^(?=.*[{re.escape(ALLOWED_SPECIALS)}])[A-Za-z{re.escape(ALLOWED_SPECIALS)}]{{8,32}}$"
)

# name: ÇÑ±Û/¿µ¹®¸¸, °ø¹é Çã¿ë
NAME_RE = re.compile(r"^[A-Za-z°¡-ÆR ]{1,30}$")


# =========================
# °ËÁõ °á°ú¿ë dataclass
# =========================
@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    code: str
    message: str


# =========================
# ÀÔ·Â °ËÁõ ÇÔ¼ö
# =========================
def validate_signup_input(username: str, password: str, name: str) -> ValidationResult:
    if not USERNAME_RE.match(username or ""):
        return ValidationResult(
            False,
            "INVALID_USERNAME",
            "usernameÀº ¿µ¹®(A-Z, a-z)¸¸ Çã¿ëÇÏ¸ç ±æÀÌ´Â 4~20ÀÚ¿©¾ß ÇÕ´Ï´Ù.",
        )

    if not PASSWORD_RE.match(password or ""):
        return ValidationResult(
            False,
            "INVALID_PASSWORD",
            f"password´Â 8~32ÀÚ, ¿µ¹®¸¸ »ç¿ëÇÏ¸ç Æ¯¼ö¹®ÀÚ({ALLOWED_SPECIALS})¸¦ ÃÖ¼Ò 1°³ Æ÷ÇÔÇØ¾ß ÇÕ´Ï´Ù.",
        )

    if not NAME_RE.match(name or ""):
        return ValidationResult(
            False,
            "INVALID_NAME",
            "nameÀº ÇÑ±Û/¿µ¹®¸¸ Çã¿ëÇÏ¸ç °ø¹éÀº Çã¿ëµË´Ï´Ù(ÃÖ´ë 30ÀÚ).",
        )

    return ValidationResult(True, "OK", "valid")


def validate_login_input(username: str, password: str) -> ValidationResult:
    if not username or not password:
        return ValidationResult(
            False,
            "MISSING_FIELDS",
            "username°ú password´Â ÇÊ¼öÀÔ´Ï´Ù.",
        )
    return ValidationResult(True, "OK", "valid")


# =========================
# ºñ¹Ð¹øÈ£ ÇØ½Ã (PBKDF2)
# =========================
PBKDF2_ALG = "sha256"
PBKDF2_ITER = 200_000
SALT_BYTES = 16
DKLEN = 32


def _b64e(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def hash_password(password: str) -> str:
    """
    ÀúÀå Æ÷¸Ë:
    pbkdf2_sha256$ITER$SALT_B64$HASH_B64
    """
    salt = secrets.token_bytes(SALT_BYTES)
    dk = hashlib.pbkdf2_hmac(
        PBKDF2_ALG,
        password.encode("utf-8"),
        salt,
        PBKDF2_ITER,
        dklen=DKLEN,
    )
    return f"pbkdf2_{PBKDF2_ALG}${PBKDF2_ITER}${_b64e(salt)}${_b64e(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        alg_part, iter_s, salt_b64, hash_b64 = stored.split("$", 3)
        if not alg_part.startswith("pbkdf2_"):
            return False

        alg = alg_part.replace("pbkdf2_", "", 1)
        iters = int(iter_s)
        salt = _b64d(salt_b64)
        expected = _b64d(hash_b64)

        dk = hashlib.pbkdf2_hmac(
            alg,
            password.encode("utf-8"),
            salt,
            iters,
            dklen=len(expected),
        )

        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


# =========================
# JWT ¼³Á¤
# =========================
JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME_IN_PRODUCTION")
JWT_ALG = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None
