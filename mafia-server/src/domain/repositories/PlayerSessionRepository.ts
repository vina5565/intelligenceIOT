// src/domain/repositories/PlayerSessionRepository.ts
// 플레이어 세션 및 방 매핑 저장소

import { Player } from '../../types/RoomTypes';

/**
 * 플레이어 세션 저장소 인터페이스
 */
export interface IPlayerSessionRepository {
  saveSession(socketId: string, player: Player): void;
  findSession(socketId: string): Player | undefined;
  deleteSession(socketId: string): void;
  setPlayerRoom(socketId: string, roomId: string): void;
  getPlayerRoom(socketId: string): string | undefined;
  removePlayerRoom(socketId: string): void;
}

/**
 * 메모리 기반 플레이어 세션 Repository 구현
 */
export class InMemoryPlayerSessionRepository implements IPlayerSessionRepository {
  private sessions: Map<string, Player> = new Map();
  private playerRoomMap: Map<string, string> = new Map();

  saveSession(socketId: string, player: Player): void {
    this.sessions.set(socketId, player);
  }

  findSession(socketId: string): Player | undefined {
    return this.sessions.get(socketId);
  }

  deleteSession(socketId: string): void {
    this.sessions.delete(socketId);
    this.playerRoomMap.delete(socketId);
  }

  setPlayerRoom(socketId: string, roomId: string): void {
    this.playerRoomMap.set(socketId, roomId);
  }

  getPlayerRoom(socketId: string): string | undefined {
    return this.playerRoomMap.get(socketId);
  }

  removePlayerRoom(socketId: string): void {
    this.playerRoomMap.delete(socketId);
  }

  clear(): void {
    this.sessions.clear();
    this.playerRoomMap.clear();
  }
}
