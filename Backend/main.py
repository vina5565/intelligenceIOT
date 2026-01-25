# Backend/main.py
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# ⚠️ 중요: 리액트(5173포트)와 통신하기 위해 CORS 설정을 허용해야 합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # 리액트 주소
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 프론트에서 보낼 데이터 규격 정의
class UserJoin(BaseModel):
    nickname: string
    university: string

@app.post("/api/join")
async def join_game(user: UserJoin):
    # 여기서 나중에 Supabase나 DB에 저장하는 로직이 들어갑니다.
    print(f"받은 데이터: {user.nickname} / {user.university}")
    return {"status": "success", "message": f"{user.university} 로비에 입장합니다."}