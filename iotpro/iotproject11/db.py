# db.py
# -*- coding: utf-8 -*-

from __future__ import annotations

import os
import sqlite3
from typing import Optional

# DB 파일명: 프로젝트 폴더(실행 위치)에 app.db로 생성됨
DB_PATH = os.getenv("DB_PATH", "app.db")


def get_conn() -> sqlite3.Connection:
    """
    SQLite 연결을 반환한다.
    - check_same_thread=False: FastAPI(멀티스레드) 환경에서 기본 충돌을 피하기 위한 옵션
    - row_factory=sqlite3.Row: 결과를 dict처럼 접근 가능하게 함
    """
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """
    DB 초기화:
    - app.db 파일이 없으면 SQLite가 자동 생성
    - 테이블/인덱스를 SQL로 명시적으로 생성
    """
    conn = get_conn()
    cur = conn.cursor()

    # --- SQL: CREATE TABLE (username UNIQUE 포함) ---
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        """
    )

    # --- SQL: INDEX (조회 성능용) ---
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        """
    )

    conn.commit()
    conn.close()


def fetch_user_by_username(username: str) -> Optional[sqlite3.Row]:
    """
    username으로 사용자 1명 조회
    """
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT id, username, password_hash, name, created_at
        FROM users
        WHERE username = ?;
        """,
        (username,),
    )

    row = cur.fetchone()
    conn.close()
    return row


def insert_user(username: str, password_hash: str, name: str, created_at: str) -> None:
    """
    사용자 삽입 (username UNIQUE 위반 시 sqlite3.IntegrityError 발생 가능)
    """
    conn = get_conn()
    cur = conn.cursor()

    cur.execute(
        """
        INSERT INTO users (username, password_hash, name, created_at)
        VALUES (?, ?, ?, ?);
        """,
        (username, password_hash, name, created_at),
    )

    conn.commit()
    conn.close()

