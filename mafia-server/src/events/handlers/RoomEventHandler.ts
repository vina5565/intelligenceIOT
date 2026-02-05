// src/events/handlers/RoomEventHandler.ts
// 방 관련 소켓 이벤트 핸들러

import { Socket, Server } from 'socket.io';
import { RoomService } from '../../domain/services/RoomService';
import { IPlayerSessionRepository } from '../../domain/repositories/PlayerSessionRepository';
import { Player } from '../../types/RoomTypes';

/**
 * 방 관련 이벤트 핸들러
 * SRP: 방 관련 소켓 이벤트만 처리
 */
export class RoomEventHandler {
  constructor(
    private io: Server,
    private roomService: RoomService,
    private playerSessionRepo: IPlayerSessionRepository
  ) {}

  /**
   * 사용자 등록 이벤트
   */
  handleRegister(socket: Socket, userData: { nickname: string; university: string; userId?: string }): void {
    const player: Player = {
      id: socket.id,
      nickname: userData.nickname,
      university: userData.university,
      userId: userData.userId,
      isReady: false
    };
    
    this.playerSessionRepo.saveSession(socket.id, player);
    console.log(`사용자 등록: ${userData.nickname} (${socket.id})`);
    
    // 현재 방 목록 전송
    socket.emit('roomListUpdate', this.roomService.getAllRooms());
  }

  /**
   * 방 목록 요청 이벤트
   */
  handleGetRooms(socket: Socket): void {
    socket.emit('roomListUpdate', this.roomService.getAllRooms());
  }

  /**
   * 방 생성 이벤트
   */
  handleCreateRoom(socket: Socket, data: { roomName: string; maxPlayers: number }): void {
    const player = this.playerSessionRepo.findSession(socket.id);
    
    if (!player) {
      socket.emit('error', { message: '사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.' });
      return;
    }

    try {
      const newRoom = this.roomService.createRoom(data.roomName, player, data.maxPlayers);
      
      // 방을 만든 사람을 Socket.IO room에 join
      socket.join(newRoom.id);
      
      // 방을 만든 사람에게 방 정보 전송
      socket.emit('joinedRoom', newRoom);
      
      // 모든 사용자에게 방 목록 업데이트
      this.io.emit('roomListUpdate', this.roomService.getAllRooms());
      
      console.log('방 생성:', data.roomName, 'by', player.nickname);
    } catch (error) {
      socket.emit('error', { message: '방 생성에 실패했습니다.' });
    }
  }

  /**
   * 방 참가 이벤트
   */
  handleJoinRoom(socket: Socket, roomId: string): void {
    const player = this.playerSessionRepo.findSession(socket.id);
    
    if (!player) {
      socket.emit('error', { message: '사용자 정보를 찾을 수 없습니다.' });
      return;
    }

    const result = this.roomService.joinRoom(roomId, player);
    
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }

    // 소켓 룸에 참가
    socket.join(roomId);
    
    // 참가자에게 방 정보 전송
    socket.emit('roomJoined', result.room);
    
    // 같은 방의 모든 사용자에게 업데이트 알림
    this.io.to(roomId).emit('roomUpdate', result.room);
    
    // 모든 사용자에게 방 목록 업데이트
    this.io.emit('roomListUpdate', this.roomService.getAllRooms());
    
    console.log(`${player.nickname}이(가) 방 ${roomId}에 참가했습니다.`);
  }

  /**
   * 방 나가기 이벤트
   */
  handleLeaveRoom(socket: Socket): void {
    const result = this.roomService.leaveRoom(socket.id);
    
    if (result.roomId) {
      socket.leave(result.roomId);
      
      // 방이 아직 존재하면 업데이트 전송
      if (result.room) {
        this.io.to(result.roomId).emit('roomUpdate', result.room);
      }
      
      // 모든 사용자에게 방 목록 업데이트
      this.io.emit('roomListUpdate', this.roomService.getAllRooms());
      
      socket.emit('leftRoom');
      console.log(`사용자 ${socket.id}이(가) 방을 나갔습니다.`);
    }
  }

  /**
   * 준비 상태 토글 이벤트
   */
  handleToggleReady(socket: Socket): void {
    const result = this.roomService.toggleReady(socket.id);
    
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }

    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (roomId && result.room) {
      // 같은 방의 모든 사용자에게 업데이트
      this.io.to(roomId).emit('roomUpdate', result.room);
      this.io.emit('roomListUpdate', this.roomService.getAllRooms());
    }
  }

  /**
   * 연결 해제 이벤트
   */
  handleDisconnect(socket: Socket): void {
    console.log('유저 접속 종료:', socket.id);
    
    // 방에서 나가기 처리
    const result = this.roomService.leaveRoom(socket.id);
    
    if (result.roomId) {
      // 방이 아직 존재하면 업데이트 전송
      if (result.room) {
        this.io.to(result.roomId).emit('roomUpdate', result.room);
      }
      
      // 모든 사용자에게 방 목록 업데이트
      this.io.emit('roomListUpdate', this.roomService.getAllRooms());
    }
    
    // 사용자 세션 삭제
    this.playerSessionRepo.deleteSession(socket.id);
  }
}
