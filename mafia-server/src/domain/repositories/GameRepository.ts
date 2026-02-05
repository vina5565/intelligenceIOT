// src/domain/repositories/GameRepository.ts
// Game 상태 저장소

import { GameEntity } from '../entities/Game';

/**
 * Game 저장소 인터페이스
 */
export interface IGameRepository {
  save(roomId: string, game: GameEntity): void;
  findByRoomId(roomId: string): GameEntity | undefined;
  delete(roomId: string): void;
  exists(roomId: string): boolean;
}

/**
 * 메모리 기반 Game Repository 구현
 */
export class InMemoryGameRepository implements IGameRepository {
  private games: Map<string, GameEntity> = new Map();

  save(roomId: string, game: GameEntity): void {
    this.games.set(roomId, game);
  }

  findByRoomId(roomId: string): GameEntity | undefined {
    return this.games.get(roomId);
  }

  delete(roomId: string): void {
    this.games.delete(roomId);
  }

  exists(roomId: string): boolean {
    return this.games.has(roomId);
  }

  clear(): void {
    this.games.clear();
  }

  count(): number {
    return this.games.size;
  }
}
