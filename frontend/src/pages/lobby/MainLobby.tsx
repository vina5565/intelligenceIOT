// src/pages/lobby/MainLobby.tsx
// 메인 로비 화면 - 방 목록 및 방 생성

import React, { useState, useEffect, useRef } from 'react';
import type { Room, ChatMessage } from './types';

interface MainLobbyProps {
  nickname: string;
  university: string;
  rooms: Room[];
  lobbyChatMessages: ChatMessage[];
  socketId: string | undefined;
  onCreateRoom: (roomName: string, maxPlayers: number) => void;
  onJoinRoom: (roomId: string) => void;
  onRefresh: () => void;
  onSendLobbyChat: (message: string) => void;
}

export const MainLobby: React.FC<MainLobbyProps> = ({
  nickname,
  university,
  rooms,
  lobbyChatMessages,
  socketId,
  onCreateRoom,
  onJoinRoom,
  onRefresh,
  onSendLobbyChat
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // 채팅 메시지 스크롤 자동 이동
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [lobbyChatMessages]);

  // 방 생성 핸들러
  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      alert('방 이름을 입력해주세요!');
      return;
    }
    onCreateRoom(newRoomName, maxPlayers);
    setShowCreateModal(false);
    setNewRoomName('');
  };

  // 채팅 전송 핸들러
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendLobbyChat(chatInput);
    setChatInput('');
  };

  // 방 목록 필터링
  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    room.players.some(p => p.nickname.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
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
        <button className="refresh-btn" onClick={onRefresh}>
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
                  onClick={() => onJoinRoom(room.id)}
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

      {/* 로비 채팅 UI */}
      <div className="chat-container lobby-chat">
        <div className="chat-header">
          <h3>💬 로비 채팅</h3>
        </div>
        <div className="chat-messages" ref={chatMessagesRef}>
          {lobbyChatMessages.length === 0 ? (
            <p className="chat-empty">다른 플레이어들과 대화해보세요!</p>
          ) : (
            lobbyChatMessages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`chat-message ${msg.id === socketId ? 'own' : ''}`}
              >
                <span className="chat-nickname">
                  {msg.nickname}
                  {msg.university && <span className="chat-university">@{msg.university}</span>}
                </span>
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
    </>
  );
};

export default MainLobby;
