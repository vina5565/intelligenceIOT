// src/domain/entities/Room.ts
// Room 엔티티 - 단일 책임: 방 데이터 및 방 규칙 관리

import { Room as IRoom, Player, PlayerGameState } from '../../types/RoomTypes';

export class RoomEntity implements IRoom {
  public id: string;
  public name: string;
  public host: string;
  public players: Player[];
  public maxPlayers: number;
  public status: 'waiting' | 'in-game' | 'finished';
  public createdAt: Date;
  public gameStates?: Map<string, PlayerGameState>;

  constructor(
    id: string,
    name: string,
    host: Player,
    maxPlayers: number = 10
  ) {
    this.id = id;
    this.name = name;
    this.host = host.id;
    this.players = [{ ...host, isReady: true }]; // 방장은 자동 준비 완료
    this.maxPlayers = maxPlayers;
    this.status = 'waiting';
    this.createdAt = new Date();
    this.gameStates = new Map();
  }

  /**
   * 방에 플레이어를 추가합니다
   */
  addPlayer(player: Player): boolean {
    if (this.isFull()) return false;
    if (this.status !== 'waiting') return false;
    if (this.hasPlayer(player.id)) return false;

    this.players.push({ ...player, isReady: false });
    return true;
  }

  /**
   * 플레이어를 제거합니다
   */
  removePlayer(playerId: string): boolean {
    const initialLength = this.players.length;
    this.players = this.players.filter(p => p.id !== playerId);
    
    const wasRemoved = this.players.length < initialLength;
    
    // 방이 비었으면 false 반환 (방 삭제 필요)
    if (this.players.length === 0) return false;
    
    // 방장이 나갔으면 새 방장 지정
    if (this.host === playerId && this.players.length > 0) {
      this.host = this.players[0].id;
      this.players[0].isReady = true;
    }
    
    return wasRemoved;
  }

  /**
   * 플레이어의 준비 상태를 토글합니다
   */
  togglePlayerReady(playerId: string): boolean {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return false;
    
    // 방장은 항상 준비 완료
    if (this.host === playerId) return true;
    
    player.isReady = !player.isReady;
    return true;
  }

  /**
   * 모든 플레이어가 준비되었는지 확인
   */
  isAllReady(): boolean {
    return this.players.every(p => p.isReady);
  }

  /**
   * 방이 가득 찼는지 확인
   */
  isFull(): boolean {
    return this.players.length >= this.maxPlayers;
  }

  /**
   * 플레이어가 방에 있는지 확인
   */
  hasPlayer(playerId: string): boolean {
    return this.players.some(p => p.id === playerId);
  }

  /**
   * 게임 시작 가능한지 확인
   */
  canStartGame(): boolean {
    return this.players.length >= 2 && this.isAllReady();
  }

  /**
   * 게임을 시작합니다
   */
  startGame(): void {
    this.status = 'in-game';
  }

  /**
   * 플레이어의 게임 상태를 업데이트합니다
   */
  updatePlayerGameState(playerId: string, gameState: Partial<PlayerGameState>): boolean {
    if (!this.gameStates) {
      this.gameStates = new Map();
    }

    const currentState = this.gameStates.get(playerId);
    if (currentState) {
      this.gameStates.set(playerId, { ...currentState, ...gameState });
    } else {
      const player = this.players.find(p => p.id === playerId);
      if (!player) return false;
      
      this.gameStates.set(playerId, {
        id: playerId,
        x: gameState.x || 400,
        y: gameState.y || 300,
        color: gameState.color || '#00d4ff',
        nickname: player.nickname,
        ...gameState
      });
    }

    return true;
  }

  /**
   * 플레인 객체로 변환
   * gameStates Map은 제외 (JSON 직렬화 불가)
   */
  toPlainObject(): IRoom {
    return {
      id: this.id,
      name: this.name,
      host: this.host,
      players: [...this.players],
      maxPlayers: this.maxPlayers,
      status: this.status,
      createdAt: this.createdAt
      // gameStates는 제외 - Map 객체는 Socket.IO 전송 불가
    };
  }
}
