// frontend/pages/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Lobby } from './pages/Lobby';
import './App.css';

function App() {
  return (
    // 1. 브라우저 라우터로 전체를 감쌉니다.
    <BrowserRouter>
      {/* 2. 주소에 따라 바뀔 영역을 지정합니다. */}
      <Routes>
        {/* "/" 주소(홈)일 때는 Home 컴포넌트를 보여줍니다. */}
        <Route path="/" element={<Home />} />
        
        {/* "/lobby" 주소일 때는 Lobby 컴포넌트를 보여줍니다. */}
        <Route path="/lobby" element={<Lobby />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;