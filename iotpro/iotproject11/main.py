# main.py
# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import auth
import db

app = FastAPI(title="Team Auth API", version="1.0.0")

# 개발 단계 CORS (운영에선 allow_origins를 프론트 도메인으로 제한)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------
# Request/Response Schemas
# ---------------------------
class SignupRequest(BaseModel):
    username: str = Field(..., examples=["minjong"])
    password: str = Field(..., examples=["Abcdefg!"])
    name: str = Field(..., examples=["김민종"])


class LoginRequest(BaseModel):
    username: str = Field(..., examples=["minjong"])
    password: str = Field(..., examples=["Abcdefg!"])


class ApiResponse(BaseModel):
    ok: bool
    code: str
    message: str
    data: Optional[Dict[str, Any]] = None


# ---------------------------
# Startup: DB init
# ---------------------------
@app.on_event("startup")
def on_startup() -> None:
    # app.db 파일이 없으면 자동 생성됨(SQLite 특성)
    db.init_db()


# ---------------------------
# Auth dependency (JWT)
# ---------------------------
def get_current_username(authorization: Optional[str] = Header(None)) -> str:
    """
    Authorization: Bearer <token>
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    token = parts[1].strip()
    payload = auth.decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return str(payload["sub"])


# ---------------------------
# Routes
# ---------------------------
@app.post("/signup", response_model=ApiResponse)
def signup(req: SignupRequest) -> ApiResponse:
    vr = auth.validate_signup_input(req.username, req.password, req.name)
    if not vr.ok:
        return ApiResponse(ok=False, code=vr.code, message=vr.message)

    # username 중복 체크
    existing = db.fetch_user_by_username(req.username)
    if existing:
        return ApiResponse(ok=False, code="USERNAME_TAKEN", message="이미 사용 중인 username입니다.")

    pw_hash = auth.hash_password(req.password)
    created_at = datetime.now(timezone.utc).isoformat()

    try:
        db.insert_user(req.username, pw_hash, req.name, created_at)
    except Exception:
        # UNIQUE 충돌 등 예외
        return ApiResponse(ok=False, code="SIGNUP_FAILED", message="회원가입에 실패했습니다.")

    return ApiResponse(
        ok=True,
        code="SIGNUP_SUCCESS",
        message="회원가입 성공",
        data={"username": req.username, "name": req.name, "created_at": created_at},
    )


@app.post("/login", response_model=ApiResponse)
def login(req: LoginRequest) -> ApiResponse:
    vr = auth.validate_login_input(req.username, req.password)
    if not vr.ok:
        return ApiResponse(ok=False, code=vr.code, message=vr.message)

    user = db.fetch_user_by_username(req.username)
    if not user:
        # 보안상 username 존재 여부 힌트를 줄이기 위해 동일 메시지
        return ApiResponse(ok=False, code="AUTH_FAILED", message="아이디 또는 비밀번호가 올바르지 않습니다.")

    if not auth.verify_password(req.password, user["password_hash"]):
        return ApiResponse(ok=False, code="AUTH_FAILED", message="아이디 또는 비밀번호가 올바르지 않습니다.")

    token = auth.create_access_token(subject=req.username)
    return ApiResponse(
        ok=True,
        code="LOGIN_SUCCESS",
        message="로그인 성공",
        data={"access_token": token, "token_type": "bearer"},
    )


@app.post("/logout", response_model=ApiResponse)
def logout() -> ApiResponse:
    """
    JWT 방식 로그아웃:
    - 서버는 기본적으로 상태를 저장하지 않으므로(stateless),
      클라이언트가 토큰을 삭제하면 로그아웃과 동일 효과.
    - (선택) 서버 블랙리스트(jti 저장)로 강제 무효화 가능하지만 여기서는 미구현.
    """
    return ApiResponse(
        ok=True,
        code="LOGOUT_SUCCESS",
        message="로그아웃 처리: 클라이언트에서 토큰을 삭제하세요.",
        data={"client_action": "delete_token"},
    )


@app.get("/me", response_model=ApiResponse)
def me(username: str = Depends(get_current_username)) -> ApiResponse:
    user = db.fetch_user_by_username(username)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return ApiResponse(
        ok=True,
        code="ME_SUCCESS",
        message="OK",
        data={
            "username": user["username"],
            "name": user["name"],
            "created_at": user["created_at"],
        },
    )

