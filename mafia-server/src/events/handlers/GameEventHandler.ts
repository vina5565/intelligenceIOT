// src/events/handlers/GameEventHandler.ts
// 게임 관련 소켓 이벤트 핸들러 (Part 1 - 게임 시작 및 액션)

import { Socket, Server } from 'socket.io';
import { GameService } from '../../domain/services/GameService';
import { GameActionService } from '../../domain/services/GameActionService';
import { RoleService } from '../../domain/services/RoleService';
import { RoomService } from '../../domain/services/RoomService';

/**
 * 게임 관련 이벤트 핸들러
 * SRP: 게임 플레이 관련 소켓 이벤트만 처리
 */
export class GameEventHandler {
  constructor(
    private io: Server,
    private gameService: GameService,
    private gameActionService: GameActionService,
    private roleService: RoleService,
    private roomService: RoomService
  ) {}

  /**
   * 게임 시작 이벤트
   */
  handleStartGame(socket: Socket): void {
    try {
      const result = this.roomService.startGame(socket.id);
      
      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      const roomId = this.roomService.getPlayerRoom(socket.id);
      if (!roomId || !result.room) return;

      // 게임 상태 초기화 및 역할 배정
      const gameStates = result.room.gameStates || new Map();
      const gameState = this.gameService.initializeGame(
        roomId,
        result.room.players,
        gameStates
      );

      // 모든 플레이어를 Socket.IO room에 join
      result.room.players.forEach((player) => {
        const playerSocket = this.io.sockets.sockets.get(player.id);
        if (playerSocket) {
          playerSocket.join(roomId);
          console.log(`플레이어 ${player.nickname}(${player.id})를 room ${roomId}에 join`);
        }
      });

      // 각 플레이어에게 개별적으로 역할 전송
      result.room.players.forEach((player) => {
        const playerSocket = this.io.sockets.sockets.get(player.id);
        const playerState = gameState.players.get(player.id);
        
        if (playerSocket && playerState) {
          playerSocket.emit('roleAssigned', {
            role: playerState.role,
            roleName: this.roleService.getRoleName(playerState.role),
            roleDescription: this.roleService.getRoleDescription(playerState.role)
          });
          
          console.log(`역할 배정: ${player.nickname} -> ${playerState.role}`);
        }
      });

      // 마피아들끼리 서로를 알 수 있도록 정보 전송
      const mafiaPlayers = this.roleService.getMafiaPlayers(gameState.players);
      
      mafiaPlayers.forEach(mafia => {
        const mafiaSocket = this.io.sockets.sockets.get(mafia.id);
        if (mafiaSocket) {
          mafiaSocket.emit('mafiaTeam', {
            teammates: mafiaPlayers.filter(m => m.id !== mafia.id)
          });
        }
      });

      // 방의 모든 플레이어에게 게임 시작 알림
      // Map 객체는 JSON 직렬화가 안되므로 제외
      this.io.to(roomId).emit('gameStarted', {
        id: result.room.id,
        name: result.room.name,
        host: result.room.host,
        players: result.room.players,
        maxPlayers: result.room.maxPlayers,
        status: result.room.status,
        createdAt: result.room.createdAt,
        gamePhase: 'playing'
      });

      // 모든 사용자에게 방 목록 업데이트
      this.io.emit('roomListUpdate', this.roomService.getAllRooms());

      console.log(`🎮 게임 시작: 방 ${roomId}, ${result.room.players.length}명 참가`);
    } catch (error) {
      console.error('❌ 게임 시작 중 에러 발생:', error);
      socket.emit('error', { message: '게임 시작 중 오류가 발생했습니다.' });
    }
  }

  /**
   * 마피아 킬 이벤트
   */
  handleMafiaKill(socket: Socket, targetId: string): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) return;

    const game = this.gameService.getGame(roomId);
    if (!game || game.phase !== 'playing') {
      socket.emit('error', { message: '킬은 플레이 단계에서만 가능합니다.' });
      return;
    }

    const result = this.gameActionService.mafiaKill(roomId, socket.id, targetId);
    
    if (result.success) {
      const victim = game.players.get(targetId);
      
      // 킬 성공 - 모든 플레이어에게 알림
      this.io.to(roomId).emit('playerKilled', {
        killerId: socket.id,
        victimId: targetId,
        victimName: victim?.nickname
      });
      
      // 시체 위치 정보 전송
      if (victim) {
        this.io.to(roomId).emit('deadBodySpawned', {
          playerId: targetId,
          x: victim.x,
          y: victim.y,
          nickname: victim.nickname
        });
      }
      
      // 게임 종료 체크
      this.checkAndHandleGameEnd(roomId);
    } else if (result.blocked) {
      socket.emit('killBlocked', { message: '대상이 보호받고 있습니다.' });
    } else {
      socket.emit('error', { message: '킬에 실패했습니다.' });
    }
  }

  /**
   * 경찰 조사 이벤트
   */
  handlePoliceInvestigate(socket: Socket, targetId: string): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) return;

    const game = this.gameService.getGame(roomId);
    if (!game) return;

    const result = this.gameActionService.policeInvestigate(roomId, socket.id, targetId);
    
    if (result.success) {
      const target = game.players.get(targetId);
      socket.emit('investigationResult', {
        targetId: targetId,
        targetName: target?.nickname,
        isMafia: result.isMafia,
        message: result.isMafia ? '이 플레이어는 마피아입니다!' : '이 플레이어는 마피아가 아닙니다.'
      });
    }
  }

  /**
   * 의사 보호 이벤트
   */
  handleDoctorProtect(socket: Socket, targetId: string): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) return;

    const game = this.gameService.getGame(roomId);
    if (!game) return;

    if (this.gameActionService.doctorProtect(roomId, socket.id, targetId)) {
      const target = game.players.get(targetId);
      socket.emit('protectionSet', {
        targetId: targetId,
        targetName: target?.nickname,
        message: `${target?.nickname}을(를) 보호합니다.`
      });
    }
  }

  /**
   * 게임 상태 요청 이벤트
   */
  handleGetGameState(socket: Socket): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) return;

    const serializedState = this.gameActionService.serializeGameState(roomId, socket.id);
    if (serializedState) {
      socket.emit('gameStateUpdate', serializedState);
    }
  }

  /**
   * 게임 종료를 확인하고 처리하는 헬퍼 메서드
   */
  private checkAndHandleGameEnd(roomId: string): void {
    const endResult = this.gameActionService.checkGameEnd(roomId);
    
    if (endResult.ended) {
      const game = this.gameService.getGame(roomId);
      
      this.io.to(roomId).emit('gameEnded', {
        winner: endResult.winner,
        winnerName: endResult.winner === 'mafia' ? '마피아' : '시민',
        players: game ? Array.from(game.players.values()) : []
      });
      
      this.gameService.deleteGame(roomId);
    }
  }
}
