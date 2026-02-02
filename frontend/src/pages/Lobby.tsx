// src/pages/Lobby.tsx
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import './Lobby.css';

interface Player {
  id: string;
  nickname: string;
  university: string;
  userId?: string;
  isReady: boolean;
}

interface Room {
  id: string;
  name: string;
  host: string;
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'in-game' | 'finished';
  createdAt: Date;
}

interface ChatMessage {
  id: string;
  nickname: string;
  university?: string;
  message: string;
  timestamp: number;
  isGhost?: boolean;
}

export const Lobby: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { nickname, university, userId } = location.state || {};

  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 채팅 관련 state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  // Socket.IO 연결
  useEffect(() => {
    if (!nickname || !university) {
      navigate('/');
      return;
    }

    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);
    
    // Socket을 window 객체에 저장 (컴포넌트 간 공유)
    (window as any).gameSocket = newSocket;

    // 사용자 등록
    newSocket.emit('register', { nickname, university, userId });

    // 방 목록 업데이트
    newSocket.on('roomListUpdate', (updatedRooms: Room[]) => {
      setRooms(updatedRooms);
    });

    // 방 정보 업데이트
    newSocket.on('roomUpdate', (updatedRoom: Room) => {
      setCurrentRoom(updatedRoom);
    });

    // 방 참가 성공
    newSocket.on('joinedRoom', (room: Room) => {
      setCurrentRoom(room);
    });

    // 방 나가기 성공
    newSocket.on('leftRoom', () => {
      setCurrentRoom(null);
      setChatMessages([]); // 채팅 초기화
    });

    // 게임 시작
    newSocket.on('gameStarted', (room: Room) => {
      console.log('게임 시작!', room);
      // 게임 화면으로 이동 (socket은 window 객체에서 가져옴)
      navigate('/game', { state: { room, nickname } });
    });

    // 에러 처리
    newSocket.on('error', (error: { message: string }) => {
      alert(error.message);
    });

    // 채팅 메시지 수신 (방 채팅)
    newSocket.on('roomChatMessage', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-99), msg]); // 최대 100개 메시지 유지
    });

    // cleanup: socket은 닫지 않음 (게임 화면에서 사용)
    return () => {
      newSocket.off('roomChatMessage');
      // newSocket.close(); // 제거: 게임 화면으로 이동 시에도 socket 유지
    };
  }, [nickname, university, userId, navigate, BACKEND_URL]);

  // 방 생성
  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      alert('방 이름을 입력해주세요!');
      return;
    }

    socket?.emit('createRoom', {
      roomName: newRoomName,
      maxPlayers: maxPlayers
    });
  };

  // 방 참가
  const handleJoinRoom = (roomId: string) => {
    socket?.emit('joinRoom', roomId);
  };

  // 방 나가기
  const handleLeaveRoom = () => {
    socket?.emit('leaveRoom');
  };

  // 준비 토글
  const handleToggleReady = () => {
    socket?.emit('toggleReady');
  };

  // 게임 시작
  const handleStartGame = () => {
    socket?.emit('startGame');
  };

  // 채팅 메시지 전송
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    socket?.emit('roomChatMessage', chatInput);
    setChatInput('');
  };

  // 방 목록 필터링
  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.players.some(p => p.nickname.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 방에 참가 중인 경우
  if (currentRoom) {
    const isHost = currentRoom.host === socket?.id;
    const currentPlayer = currentRoom.players.find(p => p.id === socket?.id);

    return (
      <div className="lobby-container">
        <div className="room-view">
          <div className="room-header">
            <h1>{currentRoom.name}</h1>
            <button className="leave-button" onClick={handleLeaveRoom}>
              방 나가기
            </button>
          </div>

          <div className="room-info">
            <span>방장: {currentRoom.players.find(p => p.id === currentRoom.host)?.nickname}</span>
            <span>인원: {currentRoom.players.length}/{currentRoom.maxPlayers}</span>
            <span className={`status-badge ${currentRoom.status}`}>
              {currentRoom.status === 'waiting' ? '대기중' : '게임중'}
            </span>
          </div>

          <div className="players-section">
            <h2>플레이어 목록</h2>
            <div className="players-grid">
              {currentRoom.players.map((player) => (
                <div key={player.id} className={`player-card ${player.isReady ? 'ready' : ''}`}>
                  <div className="player-info">
                    <span className="player-name">{player.nickname}</span>
                    <span className="player-university">{player.university}</span>
                  </div>
                  <div className="player-status">
                    {player.id === currentRoom.host && <span className="host-badge">방장</span>}
                    <span className={`ready-badge ${player.isReady ? 'ready' : ''}`}>
                      {player.isReady ? '준비완료' : '대기중'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="room-actions">
            {!isHost && (
              <button 
                className="ready-button" 
                onClick={handleToggleReady}
              >
                {currentPlayer?.isReady ? '준비 취소' : '준비'}
              </button>
            )}
            {isHost && (
              <button 
                className="start-button" 
                onClick={handleStartGame}
              >
                게임 시작
              </button>
            )}
          </div>

          {/* 채팅 UI - 왼쪽 아래 */}
          <div className="chat-container">
            <div className="chat-header">
              <h3>💬 채팅</h3>
            </div>
            <div className="chat-messages">
              {chatMessages.length === 0 ? (
                <p className="chat-empty">채팅을 시작해보세요!</p>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`chat-message ${msg.id === socket?.id ? 'own' : ''}`}
                  >
                    <span className="chat-nickname">{msg.nickname}</span>
                    <span className="chat-text">{msg.message}</span>
                  </div>
                ))
              )}
            </div>
            <form className="chat-input-form" onSubmit={handleSendChat}>
              <input
                type="text"
                className="chat-input"
                placeholder="메시지를 입력하세요..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={200}
              />
              <button type="submit" className="chat-send-btn">전송</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // 로비 화면
  return (
    <div className="lobby-container">
      <div className="lobby-header">
        <div className="user-info">
          <h2>환영합니다, {nickname}님!</h2>
          <p>{university}</p>
        </div>
        <div className="lobby-stats">
          <span>온라인: {rooms.reduce((sum, r) => sum + r.players.length, 0)}명</span>
          <span>방 개수: {rooms.length}개</span>
        </div>
      </div>

      <div className="lobby-controls">
        <button className="create-room-btn" onClick={() => setShowCreateModal(true)}>
          + 방 만들기
        </button>
        <input
          type="text"
          className="search-input"
          placeholder="방 이름 또는 플레이어 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="refresh-btn" onClick={() => socket?.emit('getRooms')}>
          🔄 새로고침
        </button>
      </div>

      <div className="rooms-section">
        <h2>대기중인 방</h2>
        {filteredRooms.length === 0 ? (
          <div className="no-rooms">
            <p>현재 대기중인 방이 없습니다.</p>
            <p>새로운 방을 만들어보세요!</p>
          </div>
        ) : (
          <div className="rooms-grid">
            {filteredRooms.map((room) => (
              <div key={room.id} className={`room-card ${room.status}`}>
                <div className="room-card-header">
                  <h3>{room.name}</h3>
                  <span className={`status-badge ${room.status}`}>
                    {room.status === 'waiting' ? '대기중' : '게임중'}
                  </span>
                </div>
                <div className="room-card-info">
                  <p>방장: {room.players.find(p => p.id === room.host)?.nickname}</p>
                  <p>인원: {room.players.length}/{room.maxPlayers}</p>
                </div>
                <div className="room-card-players">
                  {room.players.slice(0, 3).map((player, idx) => (
                    <span key={idx} className="player-tag">
                      {player.nickname}
                    </span>
                  ))}
                  {room.players.length > 3 && (
                    <span className="player-tag more">+{room.players.length - 3}</span>
                  )}
                </div>
                <button
                  className="join-button"
                  onClick={() => handleJoinRoom(room.id)}
                  disabled={room.status !== 'waiting' || room.players.length >= room.maxPlayers}
                >
                  {room.status !== 'waiting' ? '게임중' : 
                   room.players.length >= room.maxPlayers ? '만원' : '입장'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 방 생성 모달 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>새 방 만들기</h2>
            <div className="modal-form">
              <label>
                방 이름
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="방 이름을 입력하세요..."
                  maxLength={30}
                />
              </label>
              <label>
                최대 인원
                <select value={maxPlayers} onChange={(e) => setMaxPlayers(Number(e.target.value))}>
                  <option value={4}>4명</option>
                  <option value={6}>6명</option>
                  <option value={8}>8명</option>
                  <option value={10}>10명</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>
                취소
              </button>
              <button className="confirm-btn" onClick={handleCreateRoom}>
                생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lobby;