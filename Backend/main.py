import pymysql
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

DB_CONFIG = {
    "host": "localhost",      # 내 컴퓨터
    "user": "root",           # MySQL 기본 아이디
    "password": "5565",  # <-- 여기에 비번 입력하세요!!
    "db": "mafiagame",        # 아까 만든 DB 이름
    "charset": "utf8mb4"      # 한글 닉네임 저장용
}

app = FastAPI()

app.mount("/", StaticFiles(directory="static", html=True), name="static")

def get_db_connection():
    """DB 연결을 만들어주는 도우미 함수"""
    return pymysql.connect(**DB_CONFIG)

@app.get("/")
def read_root():
    return {"message": "내 컴퓨터 서버가 정상 작동 중입니다!, MySQL 연동 서버 실행 중!"}

@app.get("/lobby")
def enter_lobby(nickname: str, school: str):
    return {"status": "입장 성공", "user": nickname, "school": school}

# [게임 입장 API]
@app.get("/enter")
def enter_game(nickname: str, school: str):
    conn = None
    try:
        # 1. DB 연결
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 2. SQL 실행 (데이터 저장)
        # %s는 파이썬 변수를 안전하게 넣어주는 자리 표시자입니다.
        sql = "INSERT INTO users (nickname, school) VALUES (%s, %s)"
        cur.execute(sql, (nickname, school))
        
        # 3. 저장 확정 (Commit) - 이거 안 하면 저장 안 됨!
        conn.commit()
        
        return {
            "status": "success",
            "message": f"{nickname}({school})님 환영합니다! 데이터 저장 완료."
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
        
    finally:
        # 4. 연결 종료 (중요: 다 썼으면 전화기를 끊어야 함)
        if conn:
            conn.close()
