// src/domain/entities/Player.ts
// Player 엔티티 - 단일 책임: 플레이어 데이터 관리

import { Player as IPlayer } from '../../types/RoomTypes';

export class PlayerEntity implements IPlayer {
  public id: string;
  public nickname: string;
  public university: string;
  public userId?: string;
  public isReady: boolean;

  constructor(
    id: string,
    nickname: string,
    university: string,
    userId?: string
  ) {
    this.id = id;
    this.nickname = nickname;
    this.university = university;
    this.userId = userId;
    this.isReady = false;
  }

  /**
   * 준비 상태를 토글합니다
   */
  toggleReady(): void {
    this.isReady = !this.isReady;
  }

  /**
   * 강제로 준비 상태로 설정합니다 (방장용)
   */
  setReady(): void {
    this.isReady = true;
  }

  /**
   * 플레인 객체로 변환
   */
  toPlainObject(): IPlayer {
    return {
      id: this.id,
      nickname: this.nickname,
      university: this.university,
      userId: this.userId,
      isReady: this.isReady
    };
  }
}
