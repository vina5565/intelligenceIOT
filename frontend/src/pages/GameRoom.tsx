// src/pages/GameRoom.tsx
// 게임룸 화면 - 방 안에서의 UI

import React, { useState } from 'react';
import type { Room, ChatMessage } from './lobby/types';
import type { Socket } from 'socket.io-client';

interface GameRoomProps {
  room: Room;
  socket: Socket | null;
  chatMessages: ChatMessage[];
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  onSendChat: (message: string) => void;
}

export const GameRoom: React.FC<GameRoomProps> = ({
  room,
  socket,
  chatMessages,
  onLeaveRoom,
  onToggleReady,
  onStartGame,
  onSendChat
}) => {
  const [chatInput, setChatInput] = useState('');
  
  const isHost = room.host === socket?.id;
  const currentPlayer = room.players.find(p => p.id === socket?.id);

  // 채팅 전송 핸들러
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  return (
    <div className="room-view">
      <div className="room-header">
        <h1>{room.name}</h1>
        <button className="leave-button" onClick={onLeaveRoom}>
          방 나가기
        </button>
      </div>

      <div className="room-info">
        <span>방장: {room.players.find(p => p.id === room.host)?.nickname}</span>
        <span>인원: {room.players.length}/{room.maxPlayers}</span>
        <span className={`status-badge ${room.status}`}>
          {room.status === 'waiting' ? '대기중' : '게임중'}
        </span>
      </div>

      <div className="players-section">
        <h2>플레이어 목록</h2>
        <div className="players-grid">
          {room.players.map((player) => (
            <div key={player.id} className={`player-card ${player.isReady ? 'ready' : ''}`}>
              <div className="player-info">
                <span className="player-name">{player.nickname}</span>
                <span className="player-university">{player.university}</span>
              </div>
              <div className="player-status">
                {player.id === room.host && <span className="host-badge">방장</span>}
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
            onClick={onToggleReady}
          >
            {currentPlayer?.isReady ? '준비 취소' : '준비'}
          </button>
        )}
        {isHost && (
          <button 
            className="start-button" 
            onClick={onStartGame}
          >
            게임 시작
          </button>
        )}
      </div>

      {/* 채팅 UI */}
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
  );
};

export default GameRoom;
