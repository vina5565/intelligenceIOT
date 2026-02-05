// src/pages/Lobby.tsx
// 로비 페이지 - 메인 조율자

import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MainLobby } from './lobby/MainLobby';
import { useLobbySocket } from './lobby/useLobbySocket';
import type { UserInfo } from './lobby/types';
import { GameRoom } from './GameRoom';
import './Lobby.css';

export const Lobby: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { nickname, university, userId } = location.state || {};

  // 유저 정보가 없으면 홈으로 리다이렉트
  useEffect(() => {
    if (!nickname || !university) {
      navigate('/');
    }
  }, [nickname, university, navigate]);

  // 유저 정보 객체
  const userInfo: UserInfo | null = nickname && university 
    ? { nickname, university, userId } 
    : null;

  // 로비 소켓 훅 사용
  const {
    socket,
    rooms,
    currentRoom,
    chatMessages,
    lobbyChatMessages,
    createRoom,
    joinRoom,
    leaveRoom,
    toggleReady,
    startGame,
    sendChat,
    sendLobbyChat,
    refreshRooms
  } = useLobbySocket(userInfo);

  // 유저 정보 없으면 렌더링 안함
  if (!userInfo) {
    return null;
  }

  return (
    <div className="lobby-container">
      {currentRoom ? (
        // 게임룸 화면
        <GameRoom
          room={currentRoom}
          socket={socket}
          chatMessages={chatMessages}
          onLeaveRoom={leaveRoom}
          onToggleReady={toggleReady}
          onStartGame={startGame}
          onSendChat={sendChat}
        />
      ) : (
        // 메인 로비 화면
        <MainLobby
          nickname={userInfo.nickname}
          university={userInfo.university}
          rooms={rooms}
          lobbyChatMessages={lobbyChatMessages}
          socketId={socket?.id}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          onRefresh={refreshRooms}
          onSendLobbyChat={sendLobbyChat}
        />
      )}
    </div>
  );
};

export default Lobby;