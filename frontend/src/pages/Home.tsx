// frontend/src/pages/Home.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // axios 추가

export function Home() {
  const [nickname, setNickname] = useState<string>('');
  const [university, setUniversity] = useState<string>('');
  const navigate = useNavigate();

  const handleStart = async () => {
    if (nickname.trim() === '' || university.trim() === '') {
      alert('닉네임과 대학교를 입력해주세요!');
      return;
    }

    try {
      // 1. FastAPI 서버로 데이터 전송
      const response = await axios.post('http://localhost:8000/api/join', {
        nickname: nickname,
        university: university
      });

      if (response.data.status === 'success') {
        // 2. 서버 응답이 성공이면 로비로 이동
        navigate('/lobby', { 
          state: { nickname, university } 
        });
      }
    } catch (error) {
      console.error("백엔드 연결 실패:", error);
      alert("서버와 연결할 수 없습니다. FastAPI가 켜져 있는지 확인하세요.");
    }
  };

  return (
    <div className="home-container">
      <div className="login-box">
        <h1 className="title">MAFIA UNIVERSITY</h1>
        <p className="subtitle">우주선에 탑승할 준비가 되셨나요?</p>
        <input 
          className="main-input"
          type="text" 
          placeholder="닉네임을 입력하세요..." 
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <input 
          className="main-input"
          type="text"
          placeholder="대학교를 입력하세요... ex) OO대학교"
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
        />
        <button className="start-button" onClick={handleStart}>
          대기실 입장
        </button>
      </div>
    </div>
  );
}