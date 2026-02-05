// src/domain/services/GameActionService.ts
// 게임 액션 서비스 (킬, 보호, 조사 등)

import { IGameRepository } from '../repositories/GameRepository';
import { KillResult, InvestigationResult, GameResult, SerializableGameState, MafiaPlayerState } from '../../types/GameTypes';

/**
 * 게임 액션 서비스
 * SRP: 마피아 킬, 경찰 조사, 의사 보호 등 역할별 액션만 담당
 */
export class GameActionService {
  constructor(private gameRepository: IGameRepository) {}

  /**
   * 마피아가 플레이어를 죽입니다
   */
  mafiaKill(roomId: string, mafiaId: string, targetId: string): KillResult {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return { success: false, blocked: false };
    
    if (game.phase !== 'playing') return { success: false, blocked: false };
    
    const mafia = game.players.get(mafiaId);
    const target = game.players.get(targetId);
    
    if (!mafia || mafia.role !== 'mafia' || !mafia.isAlive) {
      return { success: false, blocked: false };
    }
    if (!target || !target.isAlive) {
      return { success: false, blocked: false };
    }
    
    // 의사가 보호 중인지 확인
    if (target.isProtected) {
      target.isProtected = false;
      this.gameRepository.save(roomId, game);
      return { success: false, blocked: true };
    }
    
    // 킬 성공
    target.isAlive = false;
    game.lastKilledPlayer = targetId;
    
    this.gameRepository.save(roomId, game);
    return { success: true, blocked: false };
  }

  /**
   * 의사가 플레이어를 보호합니다
   */
  doctorProtect(roomId: string, doctorId: string, targetId: string): boolean {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return false;
    
    const doctor = game.players.get(doctorId);
    const target = game.players.get(targetId);
    
    if (!doctor || doctor.role !== 'doctor' || !doctor.isAlive) return false;
    if (!target || !target.isAlive) return false;
    
    // 이전 보호 제거
    game.players.forEach(player => {
      player.isProtected = false;
    });
    
    target.isProtected = true;
    game.doctorProtectTarget = targetId;
    
    this.gameRepository.save(roomId, game);
    return true;
  }

  /**
   * 경찰이 플레이어를 조사합니다
   */
  policeInvestigate(roomId: string, policeId: string, targetId: string): InvestigationResult {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return { success: false, isMafia: false };
    
    const police = game.players.get(policeId);
    const target = game.players.get(targetId);
    
    if (!police || police.role !== 'police' || !police.isAlive) {
      return { success: false, isMafia: false };
    }
    if (!target || !target.isAlive) {
      return { success: false, isMafia: false };
    }
    
    const isMafia = target.role === 'mafia';
    game.policeCheckTarget = targetId;
    game.policeCheckResult = isMafia;
    
    this.gameRepository.save(roomId, game);
    return { success: true, isMafia };
  }

  /**
   * 게임 종료 여부를 확인합니다
   */
  checkGameEnd(roomId: string): GameResult {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return { ended: false, winner: null };
    
    const aliveCount = game.getAlivePlayerCount();
    const mafiaAliveCount = game.getAliveMafiaCount();
    
    // 마피아가 전멸하면 시민 승리
    if (mafiaAliveCount === 0) {
      game.endGame();
      this.gameRepository.save(roomId, game);
      return { ended: true, winner: 'citizen' };
    }
    
    // 마피아가 시민과 동수 이상이면 마피아 승리
    const citizenAliveCount = aliveCount - mafiaAliveCount;
    if (mafiaAliveCount >= citizenAliveCount) {
      game.endGame();
      this.gameRepository.save(roomId, game);
      return { ended: true, winner: 'mafia' };
    }
    
    return { ended: false, winner: null };
  }

  /**
   * 게임 상태를 직렬화합니다 (클라이언트 전송용)
   */
  serializeGameState(roomId: string, requesterId: string): SerializableGameState | null {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return null;
    
    const requester = game.players.get(requesterId);
    const players: { [key: string]: MafiaPlayerState } = {};
    
    // 역할 숨김 처리
    game.players.forEach((player, playerId) => {
      const showRole = player.id === requesterId || 
        !player.isAlive || 
        (requester?.role === 'mafia' && player.role === 'mafia');
      
      players[playerId] = {
        ...player,
        role: showRole ? player.role : 'citizen'
      };
    });
    
    const votes: { [key: string]: string } = {};
    game.votes.forEach((target, voter) => {
      votes[voter] = target;
    });
    
    return {
      roomId: game.roomId,
      phase: game.phase,
      players,
      votes,
      meetingCaller: game.meetingCaller,
      roundNumber: game.roundNumber,
      meetingTimer: game.meetingTimer,
      votingTimer: game.votingTimer,
      lastKilledPlayer: game.lastKilledPlayer,
      lastVotedOutPlayer: game.lastVotedOutPlayer
    };
  }
}
