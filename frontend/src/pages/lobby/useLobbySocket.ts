// src/pages/lobby/useLobbySocket.ts
// 로비 소켓 연결 및 이벤트 관리 훅

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import type { Room, ChatMessage, UserInfo } from './types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export interface UseLobbySocketReturn {
  socket: Socket | null;
  rooms: Room[];
  currentRoom: Room | null;
  chatMessages: ChatMessage[];
  lobbyChatMessages: ChatMessage[];
  
  // 액션
  createRoom: (roomName: string, maxPlayers: number) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  toggleReady: () => void;
  startGame: () => void;
  sendChat: (message: string) => void;
  sendLobbyChat: (message: string) => void;
  refreshRooms: () => void;
}

export function useLobbySocket(userInfo: UserInfo | null): UseLobbySocketReturn {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lobbyChatMessages, setLobbyChatMessages] = useState<ChatMessage[]>([]);

  // 소켓 연결 및 이벤트 리스너 설정
  useEffect(() => {
    if (!userInfo?.nickname || !userInfo?.university) {
      return;
    }

    // 기존 소켓이 있고 연결되어 있으면 재사용
    let newSocket = (window as any).gameSocket;
    
    if (!newSocket || !newSocket.connected) {
      newSocket = io(BACKEND_URL);
      (window as any).gameSocket = newSocket;
    }
    
    setSocket(newSocket);

    // 사용자 등록
    newSocket.emit('register', { 
      nickname: userInfo.nickname, 
      university: userInfo.university, 
      userId: userInfo.userId 
    });

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
      setChatMessages([]);
    });

    // 게임 시작
    newSocket.on('gameStarted', (room: Room) => {
      console.log('게임 시작!', room);
      navigateRef.current('/game', { state: { room, nickname: userInfo.nickname } });
    });

    // 에러 처리
    newSocket.on('error', (error: { message: string }) => {
      alert(error.message);
    });

    // 방 채팅 메시지 수신
    newSocket.on('roomChatMessage', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev.slice(-99), msg]);
    });

    // 로비 채팅 메시지 수신
    newSocket.on('lobbyChatMessage', (msg: ChatMessage) => {
      setLobbyChatMessages(prev => [...prev.slice(-99), msg]);
    });

    // cleanup - 주의: 페이지 이동 시 소켓을 끊으면 안됨 (Game 화면에서 재사용)
    return () => {
      newSocket.off('roomListUpdate');
      newSocket.off('roomUpdate');
      newSocket.off('joinedRoom');
      newSocket.off('leftRoom');
      newSocket.off('gameStarted');
      newSocket.off('error');
      newSocket.off('roomChatMessage');
      newSocket.off('lobbyChatMessage');
      
      // newSocket.disconnect(); // 제거: 게임 화면으로 이동 시 끊기면 안됨
      // (window as any).gameSocket = null; // 제거: 게임 화면에서 사용해야 함
    };
  }, [userInfo?.nickname, userInfo?.university, userInfo?.userId]);

  // 액션 함수들
  const createRoom = useCallback((roomName: string, maxPlayers: number) => {
    socket?.emit('createRoom', { roomName, maxPlayers });
  }, [socket]);

  const joinRoom = useCallback((roomId: string) => {
    socket?.emit('joinRoom', roomId);
  }, [socket]);

  const leaveRoom = useCallback(() => {
    socket?.emit('leaveRoom');
  }, [socket]);

  const toggleReady = useCallback(() => {
    socket?.emit('toggleReady');
  }, [socket]);

  const startGame = useCallback(() => {
    socket?.emit('startGame');
  }, [socket]);

  const sendChat = useCallback((message: string) => {
    if (message.trim()) {
      socket?.emit('roomChatMessage', message);
    }
  }, [socket]);

  const sendLobbyChat = useCallback((message: string) => {
    if (message.trim()) {
      socket?.emit('lobbyChatMessage', message);
    }
  }, [socket]);

  const refreshRooms = useCallback(() => {
    socket?.emit('getRooms');
  }, [socket]);

  return {
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
  };
}
