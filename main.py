# main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "내 컴퓨터 서버가 정상 작동 중입니다!"}

@app.get("/lobby")
def enter_lobby(nickname: str, school: str):
    return {"status": "입장 성공", "user": nickname, "school": school}