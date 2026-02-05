// src/types/RoomTypes.ts
// 방 관련 타입 정의

export interface Player {
  id: string;
  nickname: string;
  university: string;
  userId?: string;
  isReady: boolean;
}

export interface PlayerGameState {
  id: string;
  x: number;
  y: number;
  color: string;
  nickname: string;
}

export interface Room {
  id: string;
  name: string;
  host: string;
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'in-game' | 'finished';
  createdAt: Date;
  gameStates?: Map<string, PlayerGameState>;
}

export interface RoomOperationResult {
  success: boolean;
  room?: Room;
  error?: string;
}

export interface LeaveRoomResult {
  roomId?: string;
  room?: Room;
  wasHost: boolean;
}
