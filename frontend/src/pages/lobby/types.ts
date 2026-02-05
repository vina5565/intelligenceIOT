// src/pages/lobby/types.ts
// 로비 관련 타입 정의

export interface Player {
  id: string;
  nickname: string;
  university: string;
  userId?: string;
  isReady: boolean;
}

export interface Room {
  id: string;
  name: string;
  host: string;
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'in-game' | 'finished';
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  nickname: string;
  university?: string;
  message: string;
  timestamp: number;
  isGhost?: boolean;
}

export interface UserInfo {
  nickname: string;
  university: string;
  userId?: string;
}
