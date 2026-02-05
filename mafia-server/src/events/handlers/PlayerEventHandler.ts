// src/events/handlers/PlayerEventHandler.ts
// 플레이어 이동 및 채팅 관련 소켓 이벤트 핸들러

import { Socket, Server } from 'socket.io';
import { RoomService } from '../../domain/services/RoomService';
import { GameService } from '../../domain/services/GameService';
import { IPlayerSessionRepository } from '../../domain/repositories/PlayerSessionRepository';

/**
 * 플레이어 이벤트 핸들러
 * SRP: 플레이어 이동, 채팅 등 플레이어 액션만 처리
 */
export class PlayerEventHandler {
  constructor(
    private io: Server,
    private roomService: RoomService,
    private gameService: GameService,
    private playerSessionRepo: IPlayerSessionRepository
  ) {}

  /**
   * 플레이어가 게임에 참가
   */
  handlePlayerJoinedGame(socket: Socket, data: { x: number; y: number; nickname: string; color: string }): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) return;

    // 플레이어 게임 상태 저장
    this.roomService.updatePlayerGameState(socket.id, {
      x: data.x,
      y: data.y,
      color: data.color,
      nickname: data.nickname
    });

    // 같은 방의 다른 플레이어들에게 알림
    socket.to(roomId).emit('otherPlayerJoined', {
      id: socket.id,
      x: data.x,
      y: data.y,
      nickname: data.nickname,
      color: data.color
    });

    // 현재 방에 있는 모든 플레이어의 게임 상태 전송
    const currentPlayers = this.roomService.getPlayerGameStates(roomId)
      .filter(p => p.id !== socket.id);
    
    socket.emit('currentPlayers', currentPlayers);
    
    console.log(`플레이어 ${data.nickname}(${socket.id})가 게임에 참가. 기존 플레이어 ${currentPlayers.length}명`);
  }

  /**
   * 플레이어 이동 (게임 내)
   */
  handlePlayerMove(socket: Socket, data: { x: number; y: number }): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) return;

    // 플레이어 상태 업데이트
    this.roomService.updatePlayerGameState(socket.id, { x: data.x, y: data.y });
    
    // 같은 방의 다른 플레이어들에게 전송
    socket.to(roomId).emit('otherPlayerMoved', {
      id: socket.id,
      x: data.x,
      y: data.y
    });
  }

  /**
   * 플레이어가 게임에서 나감
   */
  handlePlayerLeftGame(socket: Socket): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (roomId) {
      socket.to(roomId).emit('playerLeftGame', socket.id);
    }
  }

  /**
   * 로비 채팅
   */
  handleLobbyChatMessage(socket: Socket, message: string): void {
    const player = this.playerSessionRepo.findSession(socket.id);
    if (!player) return;
    
    // 모든 로비 사용자에게 메시지 전송
    this.io.emit('lobbyChatMessage', {
      id: socket.id,
      nickname: player.nickname,
      university: player.university,
      message: message,
      timestamp: Date.now()
    });
  }

  /**
   * 방 채팅 (대기실)
   */
  handleRoomChatMessage(socket: Socket, message: string): void {
    const player = this.playerSessionRepo.findSession(socket.id);
    if (!player) return;
    
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) {
      socket.emit('error', { message: '방에 참가하지 않았습니다.' });
      return;
    }
    
    // 같은 방의 모든 플레이어에게 메시지 전송
    this.io.to(roomId).emit('roomChatMessage', {
      id: socket.id,
      nickname: player.nickname,
      message: message,
      timestamp: Date.now()
    });
    
    console.log(`[채팅] ${player.nickname}: ${message}`);
  }

  /**
   * 게임 내 채팅
   */
  handleGameChatMessage(socket: Socket, message: string): void {
    const player = this.playerSessionRepo.findSession(socket.id);
    if (!player) return;
    
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) return;
    
    const game = this.gameService.getGame(roomId);
    if (!game) return;
    
    const playerState = game.players.get(socket.id);
    
    // 죽은 플레이어는 죽은 플레이어끼리만 채팅 가능
    if (playerState && !playerState.isAlive) {
      // 죽은 플레이어들에게만 전송
      game.players.forEach((p, id) => {
        if (!p.isAlive) {
          this.io.to(id).emit('gameChatMessage', {
            id: socket.id,
            nickname: player.nickname,
            message: message,
            isGhost: true,
            timestamp: Date.now()
          });
        }
      });
    } else {
      // 살아있는 플레이어는 모두에게 전송
      this.io.to(roomId).emit('gameChatMessage', {
        id: socket.id,
        nickname: player.nickname,
        message: message,
        isGhost: false,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 레거시 이동 이벤트 (호환성)
   */
  handleMove(socket: Socket, data: any): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (roomId) {
      socket.to(roomId).emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  }
}
