// src/pages/Game.tsx
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import { GameScene } from '../game/GameScene';

interface LocationState {
  room: {
    id: string;
    name: string;
    players: Array<{ nickname: string }>;
  };
  nickname: string;
}

export const Game: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const gameRef = useRef<Phaser.Game | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const { room, nickname } = (location.state as LocationState) || {};

  useEffect(() => {
    if (!room || !nickname) {
      navigate('/lobby');
      return;
    }

    // 이미 게임이 생성되었으면 중복 생성 방지 (React StrictMode 대응)
    if (gameRef.current) {
      console.log('게임 이미 생성됨, 중복 생성 방지');
      return;
    }

    // window 객체에서 socket 가져오기
    const socket = (window as any).gameSocket as Socket;
    
    if (!socket) {
      console.error('Socket not found in window object');
      navigate('/lobby');
      return;
    }

    socketRef.current = socket;
    console.log('게임 화면 진입. 소켓 ID:', socket.id, '방 ID:', room.id);

    // Phaser 게임 설정
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1000,
      height: 600,
      parent: 'game-container',
      backgroundColor: '#2d2d44',
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false
        }
      },
      scene: new GameScene(socket, nickname)
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;

    // 게임 종료 이벤트
    socket.on('gameEnded', () => {
      alert('게임이 종료되었습니다!');
      navigate('/lobby');
    });

    // 정리
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
      // 소켓은 닫지 않음 (로비로 돌아갈 때 필요)
      if (socketRef.current) {
        socketRef.current.emit('playerLeftGame');
        socketRef.current.off('gameEnded');
        // socketRef.current.close(); // 제거: 소켓을 닫지 않음
      }
    };
  }, [room, nickname, navigate]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0f0c29'
    }}>
      <div style={{
        marginBottom: '20px',
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        {room?.name || '게임 중'}
      </div>
      <div 
        id="game-container" 
        style={{
          border: '2px solid rgba(0, 212, 255, 0.5)',
          borderRadius: '8px',
          overflow: 'hidden'
        }}
      />
      <div style={{
        marginTop: '20px',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '14px'
      }}>
        WASD 또는 화살표 키로 이동
      </div>
      <button
        onClick={() => navigate('/lobby')}
        style={{
          marginTop: '20px',
          padding: '10px 20px',
          backgroundColor: 'rgba(255, 68, 68, 0.2)',
          border: '1px solid rgba(255, 68, 68, 0.4)',
          borderRadius: '8px',
          color: '#ff4444',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        로비로 돌아가기
      </button>
    </div>
  );
};

export default Game;
