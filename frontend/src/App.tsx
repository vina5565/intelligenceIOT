import { useState } from 'react';
import './App.css'; // CSS 파일을 연결합니다.

function App() {
  const [nickname, setNickname] = useState<string>('');
  const [university, setUniversity] = useState<string>(''); // 대학교 상태 추가

  const handleStart = () => {
    if (nickname.trim() === '' || university.trim() === '') {
      alert('닉네임과 대학교를 입력해주세요!');
      return;
    }
    alert(`${nickname}님, ${university} 대기실로 이동합니다!`);
  };

  return (
    <div className="home-container">
      <div className="login-box">
        <h1 className="title">MAFIA UNIVERSITY</h1>
        <p className="subtitle">우주선에 탑승할 준비가 되셨나요? </p>
        {/* 닉네임 입력창 */}
        <input 
          className="main-input"
          type="text" 
          placeholder="닉네임을 입력하세요..." 
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        {/* 대학교 입력창 */}
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

export default App;