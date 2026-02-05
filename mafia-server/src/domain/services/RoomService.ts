// src/domain/services/RoomService.ts
// 방 관리 비즈니스 로직 서비스

import { RoomEntity } from '../entities/Room';
import { PlayerEntity } from '../entities/Player';
import { IRoomRepository } from '../repositories/RoomRepository';
import { IPlayerSessionRepository } from '../repositories/PlayerSessionRepository';
import { Player, RoomOperationResult, LeaveRoomResult } from '../../types/RoomTypes';

/**
 * 방 관리 서비스
 * SRP: 방 생성, 참가, 나가기 등 방 관련 비즈니스 로직만 담당
 * DIP: Repository 인터페이스에 의존
 */
export class RoomService {
  constructor(
    private roomRepository: IRoomRepository,
    private playerSessionRepository: IPlayerSessionRepository
  ) {}

  /**
   * 방을 생성합니다
   */
  createRoom(roomName: string, host: Player, maxPlayers: number = 10) {
    const roomId = this.generateRoomId();
    const room = new RoomEntity(roomId, roomName, host, maxPlayers);
    
    this.roomRepository.save(room);
    this.playerSessionRepository.setPlayerRoom(host.id, roomId);
    
    return room.toPlainObject();
  }

  /**
   * 방에 참가합니다
   */
  joinRoom(roomId: string, player: Player): RoomOperationResult {
    const room = this.roomRepository.findById(roomId);

    if (!room) {
      return { success: false, error: '방을 찾을 수 없습니다.' };
    }

    if (room.status !== 'waiting') {
      return { success: false, error: '게임이 이미 시작되었습니다.' };
    }

    if (room.isFull()) {
      return { success: false, error: '방이 가득 찼습니다.' };
    }

    if (room.hasPlayer(player.id)) {
      return { success: false, error: '이미 방에 참가했습니다.' };
    }

    room.addPlayer(player);
    this.roomRepository.save(room);
    this.playerSessionRepository.setPlayerRoom(player.id, roomId);

    return { success: true, room: room.toPlainObject() };
  }

  /**
   * 방을 나갑니다
   */
  leaveRoom(socketId: string): LeaveRoomResult {
    const roomId = this.playerSessionRepository.getPlayerRoom(socketId);
    
    if (!roomId) {
      return { wasHost: false };
    }

    const room = this.roomRepository.findById(roomId);
    if (!room) {
      this.playerSessionRepository.removePlayerRoom(socketId);
      return { wasHost: false };
    }

    const wasHost = room.host === socketId;
    
    const hasPlayers = room.removePlayer(socketId);
    this.playerSessionRepository.removePlayerRoom(socketId);

    // 방이 비었으면 삭제
    if (!hasPlayers) {
      this.roomRepository.delete(roomId);
      return { roomId, wasHost };
    }

    this.roomRepository.save(room);
    return { roomId, room: room.toPlainObject(), wasHost };
  }

  /**
   * 플레이어의 준비 상태를 토글합니다
   */
  toggleReady(socketId: string): RoomOperationResult {
    const roomId = this.playerSessionRepository.getPlayerRoom(socketId);
    
    if (!roomId) {
      return { success: false, error: '방에 참가하지 않았습니다.' };
    }

    const room = this.roomRepository.findById(roomId);
    if (!room) {
      return { success: false, error: '방을 찾을 수 없습니다.' };
    }

    if (!room.togglePlayerReady(socketId)) {
      return { success: false, error: '플레이어를 찾을 수 없습니다.' };
    }

    this.roomRepository.save(room);
    return { success: true, room: room.toPlainObject() };
  }

  /**
   * 게임을 시작합니다
   */
  startGame(socketId: string): RoomOperationResult {
    const roomId = this.playerSessionRepository.getPlayerRoom(socketId);
    
    if (!roomId) {
      return { success: false, error: '방에 참가하지 않았습니다.' };
    }

    const room = this.roomRepository.findById(roomId);
    if (!room) {
      return { success: false, error: '방을 찾을 수 없습니다.' };
    }

    // 방장만 게임 시작 가능
    if (room.host !== socketId) {
      return { success: false, error: '방장만 게임을 시작할 수 있습니다.' };
    }

    // 최소 인원 체크
    if (room.players.length < 2) {
      return { success: false, error: '최소 2명 이상이어야 게임을 시작할 수 있습니다.' };
    }

    // 모든 플레이어가 준비되었는지 확인
    if (!room.canStartGame()) {
      return { success: false, error: '모든 플레이어가 준비되어야 합니다.' };
    }

    room.startGame();
    this.roomRepository.save(room);
    
    return { success: true, room: room.toPlainObject() };
  }

  /**
   * 모든 방 목록을 가져옵니다
   */
  getAllRooms() {
    return this.roomRepository.findAll().map(room => room.toPlainObject());
  }

  /**
   * 특정 방 정보를 가져옵니다
   */
  getRoom(roomId: string) {
    const room = this.roomRepository.findById(roomId);
    return room?.toPlainObject();
  }

  /**
   * 플레이어가 속한 방 ID를 가져옵니다
   */
  getPlayerRoom(socketId: string): string | undefined {
    return this.playerSessionRepository.getPlayerRoom(socketId);
  }

  /**
   * 플레이어의 게임 상태를 업데이트합니다
   */
  updatePlayerGameState(socketId: string, gameState: any): boolean {
    const roomId = this.playerSessionRepository.getPlayerRoom(socketId);
    if (!roomId) return false;

    const room = this.roomRepository.findById(roomId);
    if (!room) return false;

    const success = room.updatePlayerGameState(socketId, gameState);
    if (success) {
      this.roomRepository.save(room);
    }

    return success;
  }

  /**
   * 방의 모든 플레이어 게임 상태를 가져옵니다
   */
  getPlayerGameStates(roomId: string) {
    const room = this.roomRepository.findById(roomId);
    if (!room || !room.gameStates) return [];
    
    return Array.from(room.gameStates.values());
  }

  /**
   * 방 ID를 생성합니다
   */
  private generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
