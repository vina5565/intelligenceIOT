// src/domain/services/GameService.ts
// 게임 로직 비즈니스 서비스 (Part 1 - 게임 초기화 및 회의 관리)

import { GameEntity } from '../entities/Game';
import { IGameRepository } from '../repositories/GameRepository';
import { RoleService } from './RoleService';
import { Player, PlayerGameState } from '../../types/RoomTypes';
import { 
  GameResult, 
  VoteResult, 
  KillResult, 
  InvestigationResult,
  SerializableGameState,
  MafiaPlayerState 
} from '../../types/GameTypes';

/**
 * 게임 로직 서비스
 * SRP: 마피아 게임의 핵심 로직만 담당
 */
export class GameService {
  constructor(
    private gameRepository: IGameRepository,
    private roleService: RoleService
  ) {}

  /**
   * 게임을 초기화하고 역할을 배정합니다
   */
  initializeGame(
    roomId: string,
    players: Player[],
    gameStates: Map<string, PlayerGameState>
  ): GameEntity {
    // 역할 배정
    const roles = this.roleService.assignRoles(players);
    
    // 플레이어 상태 생성
    const playerStates = this.roleService.createPlayerStates(players, roles, gameStates);
    
    // 게임 생성
    const game = new GameEntity(roomId, playerStates);
    
    // 저장
    this.gameRepository.save(roomId, game);
    
    return game;
  }

  /**
   * 긴급 회의를 시작합니다
   */
  startEmergencyMeeting(roomId: string, callerId: string): boolean {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return false;
    
    if (game.phase !== 'playing') return false;
    
    const caller = game.players.get(callerId);
    if (!caller || !caller.isAlive) return false;
    
    game.startMeeting(callerId);
    this.gameRepository.save(roomId, game);
    
    return true;
  }

  /**
   * 시체 발견으로 회의를 시작합니다
   */
  startReportMeeting(roomId: string, reporterId: string, bodyId: string): boolean {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return false;
    
    if (game.phase !== 'playing') return false;
    
    const reporter = game.players.get(reporterId);
    const body = game.players.get(bodyId);
    
    if (!reporter || !reporter.isAlive) return false;
    if (!body || body.isAlive) return false;
    
    game.startMeeting(reporterId);
    game.lastKilledPlayer = bodyId;
    this.gameRepository.save(roomId, game);
    
    return true;
  }

  /**
   * 투표 단계로 전환합니다
   */
  startVotingPhase(roomId: string): boolean {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return false;
    
    if (game.phase !== 'meeting') return false;
    
    game.startVoting();
    this.gameRepository.save(roomId, game);
    
    return true;
  }

  /**
   * 투표합니다
   */
  castVote(roomId: string, voterId: string, targetId: string | 'skip'): boolean {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return false;
    
    if (game.phase !== 'voting') return false;
    
    const voter = game.players.get(voterId);
    if (!voter || !voter.isAlive || voter.hasVoted) return false;
    
    // 타겟 검증
    if (targetId !== 'skip') {
      const target = game.players.get(targetId);
      if (!target || !target.isAlive) return false;
    }
    
    voter.hasVoted = true;
    voter.votedFor = targetId;
    game.votes.set(voterId, targetId);
    
    this.gameRepository.save(roomId, game);
    return true;
  }

  /**
   * 투표 결과를 계산합니다
   */
  calculateVoteResult(roomId: string): VoteResult | null {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return null;
    
    const voteCount = new Map<string, number>();
    
    // 투표 집계
    game.votes.forEach((targetId) => {
      const current = voteCount.get(targetId) || 0;
      voteCount.set(targetId, current + 1);
    });
    
    // 가장 많은 표를 받은 플레이어 찾기
    let maxVotes = 0;
    let ejectedPlayer: string | null = null;
    let tie = false;
    
    voteCount.forEach((count, playerId) => {
      if (playerId === 'skip') return;
      
      if (count > maxVotes) {
        maxVotes = count;
        ejectedPlayer = playerId;
        tie = false;
      } else if (count === maxVotes && count > 0) {
        tie = true;
      }
    });
    
    // 스킵 표가 과반수이면 추방 없음
    const skipVotes = voteCount.get('skip') || 0;
    const totalVoters = game.votes.size;
    if (skipVotes > totalVoters / 2) {
      ejectedPlayer = null;
      tie = false;
    }
    
    // 동점이면 추방 없음
    if (tie) {
      ejectedPlayer = null;
    }
    
    return { ejected: ejectedPlayer, voteCount, tie };
  }

  /**
   * 플레이어를 추방합니다
   */
  ejectPlayer(roomId: string, playerId: string): boolean {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return false;
    
    const player = game.players.get(playerId);
    if (!player) return false;
    
    player.isAlive = false;
    game.lastVotedOutPlayer = playerId;
    
    this.gameRepository.save(roomId, game);
    return true;
  }

  /**
   * 게임 상태를 결과 단계로 변경합니다
   */
  setResultPhase(roomId: string): void {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return;
    
    game.showResult();
    this.gameRepository.save(roomId, game);
  }

  /**
   * 플레이 단계로 복귀합니다
   */
  returnToPlayPhase(roomId: string): void {
    const game = this.gameRepository.findByRoomId(roomId);
    if (!game) return;
    
    game.returnToPlay();
    this.gameRepository.save(roomId, game);
  }

  /**
   * 게임을 가져옵니다
   */
  getGame(roomId: string): GameEntity | undefined {
    return this.gameRepository.findByRoomId(roomId);
  }

  /**
   * 게임을 삭제합니다
   */
  deleteGame(roomId: string): void {
    this.gameRepository.delete(roomId);
  }
}
