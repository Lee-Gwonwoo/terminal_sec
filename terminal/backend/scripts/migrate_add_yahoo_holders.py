#!/usr/bin/env python3
"""
간단한 안전 마이그레이션 스크립트: `company_profiles`에 Yahoo 관련 컬럼이 없으면 추가합니다.

사용법:
  python migrate_add_yahoo_holders.py

이 스크립트는 SQLite DB 파일을 직접 변경합니다. 실행 전에 DB 백업을 권장합니다.
"""
import os
import sqlite3
import sys

BASE = os.path.dirname(os.path.dirname(__file__))  # terminal/backend
DB_PATH = os.path.join(BASE, "backend", "data", "app.db")

REQUIRED_COLUMNS = [
    ("institutional_pct", "REAL"),
    ("institutional_source", "TEXT"),
    ("insider_pct", "REAL"),
    ("insider_source", "TEXT"),
    ("outstanding_shares", "REAL"),
]


def table_columns(conn, table_name):
    cur = conn.execute(f"PRAGMA table_info({table_name})")
    return [r[1] for r in cur.fetchall()]


def main():
    if not os.path.exists(DB_PATH):
        print("DB 파일을 찾을 수 없습니다:", DB_PATH)
        sys.exit(2)

    conn = sqlite3.connect(DB_PATH)
    try:
        cols = table_columns(conn, "company_profiles")
    except sqlite3.OperationalError as e:
        print("오류: 테이블 company_profiles을 찾을 수 없습니다. DB 스키마를 확인하세요.")
        print(e)
        conn.close()
        sys.exit(3)

    to_add = []
    for name, sqltype in REQUIRED_COLUMNS:
        if name not in cols:
            to_add.append((name, sqltype))

    if not to_add:
        print("회사 프로필 테이블에 필요한 컬럼이 모두 존재합니다. 작업 없음.")
        conn.close()
        return

    print("다음 컬럼을 추가합니다:")
    for name, sqltype in to_add:
        print(f" - {name} {sqltype}")

    for name, sqltype in to_add:
        stmt = f"ALTER TABLE company_profiles ADD COLUMN {name} {sqltype};"
        try:
            conn.execute(stmt)
            print(f"컬럼 추가 완료: {name}")
        except Exception as e:
            print(f"컬럼 추가 실패: {name} : {e}")

    conn.commit()
    conn.close()
    print("마이그레이션 완료. 필요 시 DB 백업에서 복원하세요.")


if __name__ == "__main__":
    main()
