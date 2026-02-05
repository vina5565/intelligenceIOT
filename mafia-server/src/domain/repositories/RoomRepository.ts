// src/domain/repositories/RoomRepository.ts
// Repository 패턴 - 데이터 저장소 추상화 (DIP 원칙)

import { RoomEntity } from '../entities/Room';

/**
 * Room 저장소 인터페이스
 * DIP (Dependency Inversion Principle): 구체적인 구현이 아닌 추상에 의존
 */
export interface IRoomRepository {
  save(room: RoomEntity): void;
  findById(id: string): RoomEntity | undefined;
  findAll(): RoomEntity[];
  delete(id: string): void;
  exists(id: string): boolean;
}

/**
 * 메모리 기반 Room Repository 구현
 * SRP: 방 데이터의 저장과 조회만 담당
 */
export class InMemoryRoomRepository implements IRoomRepository {
  private rooms: Map<string, RoomEntity> = new Map();

  save(room: RoomEntity): void {
    this.rooms.set(room.id, room);
  }

  findById(id: string): RoomEntity | undefined {
    return this.rooms.get(id);
  }

  findAll(): RoomEntity[] {
    return Array.from(this.rooms.values());
  }

  delete(id: string): void {
    this.rooms.delete(id);
  }

  exists(id: string): boolean {
    return this.rooms.has(id);
  }

  /**
   * 모든 방을 삭제 (테스트용)
   */
  clear(): void {
    this.rooms.clear();
  }

  /**
   * 방 개수 반환
   */
  count(): number {
    return this.rooms.size;
  }
}
