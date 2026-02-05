// src/events/handlers/MeetingEventHandler.ts
// 회의 및 투표 관련 소켓 이벤트 핸들러

import { Socket, Server } from 'socket.io';
import { GameService } from '../../domain/services/GameService';
import { GameActionService } from '../../domain/services/GameActionService';
import { RoomService } from '../../domain/services/RoomService';

/**
 * 회의 및 투표 이벤트 핸들러
 * SRP: 회의 소집, 투표 관련 이벤트만 처리
 */
export class MeetingEventHandler {
  private meetingTimers: Map<string, NodeJS.Timeout> = new Map();
  private votingTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private io: Server,
    private gameService: GameService,
    private gameActionService: GameActionService,
    private roomService: RoomService
  ) {}

  /**
   * 긴급 회의 소집 이벤트
   */
  handleCallEmergencyMeeting(socket: Socket): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) return;

    const game = this.gameService.getGame(roomId);
    if (!game) return;

    if (this.gameService.startEmergencyMeeting(roomId, socket.id)) {
      const caller = game.players.get(socket.id);
      
      // 모든 플레이어에게 회의 시작 알림
      this.io.to(roomId).emit('meetingStarted', {
        type: 'emergency',
        callerId: socket.id,
        callerName: caller?.nickname,
        phase: 'meeting',
        timer: game.meetingTimer,
        alivePlayers: game.getAlivePlayers()
      });

      // 회의 타이머 시작
      this.startMeetingTimer(roomId, game.meetingTimer);
    }
  }

  /**
   * 시체 발견 (리포트) 이벤트
   */
  handleReportBody(socket: Socket, bodyId: string): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) return;

    const game = this.gameService.getGame(roomId);
    if (!game) return;

    if (this.gameService.startReportMeeting(roomId, socket.id, bodyId)) {
      const reporter = game.players.get(socket.id);
      const body = game.players.get(bodyId);
      
      this.io.to(roomId).emit('meetingStarted', {
        type: 'report',
        callerId: socket.id,
        callerName: reporter?.nickname,
        bodyId: bodyId,
        bodyName: body?.nickname,
        phase: 'meeting',
        timer: game.meetingTimer,
        alivePlayers: game.getAlivePlayers()
      });

      // 회의 타이머 시작
      this.startMeetingTimer(roomId, game.meetingTimer);
    }
  }

  /**
   * 투표 이벤트
   */
  handleVote(socket: Socket, targetId: string | 'skip'): void {
    const roomId = this.roomService.getPlayerRoom(socket.id);
    if (!roomId) return;

    const game = this.gameService.getGame(roomId);
    if (!game || game.phase !== 'voting') {
      socket.emit('error', { message: '투표는 투표 단계에서만 가능합니다.' });
      return;
    }

    if (this.gameService.castVote(roomId, socket.id, targetId)) {
      const voter = game.players.get(socket.id);
      
      // 모든 플레이어에게 투표 현황 알림
      this.io.to(roomId).emit('playerVoted', {
        voterId: socket.id,
        voterName: voter?.nickname,
        totalVotes: game.votes.size,
        totalAlive: game.getAlivePlayerCount()
      });

      // 모든 살아있는 플레이어가 투표했는지 확인
      if (game.hasAllVoted()) {
        // 투표 종료 - 결과 계산
        this.clearTimer(this.votingTimers, roomId);
        this.processVotingResult(roomId);
      }
    }
  }

  /**
   * 회의 타이머 시작
   */
  private startMeetingTimer(roomId: string, duration: number): void {
    this.clearTimer(this.meetingTimers, roomId);

    let timeLeft = duration;

    const timer = setInterval(() => {
      timeLeft--;
      this.io.to(roomId).emit('timerUpdate', { phase: 'meeting', timeLeft });

      if (timeLeft <= 0) {
        clearInterval(timer);
        this.meetingTimers.delete(roomId);
        
        // 투표 단계로 전환
        if (this.gameService.startVotingPhase(roomId)) {
          const game = this.gameService.getGame(roomId);
          
          this.io.to(roomId).emit('votingStarted', {
            phase: 'voting',
            timer: game?.votingTimer || 30,
            alivePlayers: game?.getAlivePlayers() || []
          });
          
          this.startVotingTimer(roomId, game?.votingTimer || 30);
        }
      }
    }, 1000);

    this.meetingTimers.set(roomId, timer);
  }

  /**
   * 투표 타이머 시작
   */
  private startVotingTimer(roomId: string, duration: number): void {
    this.clearTimer(this.votingTimers, roomId);

    let timeLeft = duration;

    const timer = setInterval(() => {
      timeLeft--;
      this.io.to(roomId).emit('timerUpdate', { phase: 'voting', timeLeft });

      if (timeLeft <= 0) {
        clearInterval(timer);
        this.votingTimers.delete(roomId);
        
        // 투표 결과 처리
        this.processVotingResult(roomId);
      }
    }, 1000);

    this.votingTimers.set(roomId, timer);
  }

  /**
   * 투표 결과 처리
   */
  private processVotingResult(roomId: string): void {
    const game = this.gameService.getGame(roomId);
    if (!game) return;

    this.gameService.setResultPhase(roomId);
    
    const result = this.gameService.calculateVoteResult(roomId);
    if (!result) return;
    
    // 투표 결과 공개
    const voteDetails: { playerId: string; nickname: string; votes: number }[] = [];
    result.voteCount.forEach((count, playerId) => {
      const player = game.players.get(playerId);
      voteDetails.push({
        playerId,
        nickname: player?.nickname || (playerId === 'skip' ? '스킵' : '알 수 없음'),
        votes: count
      });
    });

    this.io.to(roomId).emit('votingResult', {
      ejected: result.ejected,
      ejectedName: result.ejected ? game.players.get(result.ejected)?.nickname : null,
      ejectedRole: result.ejected ? game.players.get(result.ejected)?.role : null,
      tie: result.tie,
      voteDetails: voteDetails.sort((a, b) => b.votes - a.votes)
    });

    // 추방 처리
    if (result.ejected) {
      this.gameService.ejectPlayer(roomId, result.ejected);
    }

    // 게임 종료 체크
    setTimeout(() => {
      const endResult = this.gameActionService.checkGameEnd(roomId);
      
      if (endResult.ended) {
        const updatedGame = this.gameService.getGame(roomId);
        
        this.io.to(roomId).emit('gameEnded', {
          winner: endResult.winner,
          winnerName: endResult.winner === 'mafia' ? '마피아' : '시민',
          players: updatedGame ? Array.from(updatedGame.players.values()) : []
        });
        
        this.gameService.deleteGame(roomId);
      } else {
        // 플레이 단계로 복귀
        this.gameService.returnToPlayPhase(roomId);
        const updatedGame = this.gameService.getGame(roomId);
        
        this.io.to(roomId).emit('phaseChanged', {
          phase: 'playing',
          roundNumber: updatedGame?.roundNumber || 1
        });
      }
    }, 3000);
  }

  /**
   * 타이머 정리
   */
  private clearTimer(timers: Map<string, NodeJS.Timeout>, roomId: string): void {
    if (timers.has(roomId)) {
      clearInterval(timers.get(roomId));
      timers.delete(roomId);
    }
  }

  /**
   * 모든 타이머 정리 (서버 종료 시)
   */
  clearAllTimers(): void {
    this.meetingTimers.forEach(timer => clearInterval(timer));
    this.votingTimers.forEach(timer => clearInterval(timer));
    this.meetingTimers.clear();
    this.votingTimers.clear();
  }
}
