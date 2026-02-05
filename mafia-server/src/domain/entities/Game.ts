// src/domain/entities/Game.ts
// Game 엔티티 - 단일 책임: 게임 상태 데이터 관리

import { GameState, GamePhase, MafiaPlayerState } from '../../types/GameTypes';

export class GameEntity implements GameState {
  public roomId: string;
  public phase: GamePhase;
  public players: Map<string, MafiaPlayerState>;
  public votes: Map<string, string>;
  public meetingCaller: string | null;
  public mafiaKillTarget: string | null;
  public doctorProtectTarget: string | null;
  public policeCheckTarget: string | null;
  public policeCheckResult: boolean | null;
  public roundNumber: number;
  public meetingTimer: number;
  public votingTimer: number;
  public lastKilledPlayer: string | null;
  public lastVotedOutPlayer: string | null;

  constructor(
    roomId: string,
    players: Map<string, MafiaPlayerState>
  ) {
    this.roomId = roomId;
    this.phase = 'playing';
    this.players = players;
    this.votes = new Map();
    this.meetingCaller = null;
    this.mafiaKillTarget = null;
    this.doctorProtectTarget = null;
    this.policeCheckTarget = null;
    this.policeCheckResult = null;
    this.roundNumber = 1;
    this.meetingTimer = 60;
    this.votingTimer = 30;
    this.lastKilledPlayer = null;
    this.lastVotedOutPlayer = null;
  }

  /**
   * 회의를 시작합니다
   */
  startMeeting(callerId: string): void {
    this.phase = 'meeting';
    this.meetingCaller = callerId;
    this.meetingTimer = 60;
    this.resetVotes();
  }

  /**
   * 투표 단계로 전환합니다
   */
  startVoting(): void {
    this.phase = 'voting';
    this.votingTimer = 30;
  }

  /**
   * 결과 단계로 전환합니다
   */
  showResult(): void {
    this.phase = 'result';
  }

  /**
   * 게임 종료 상태로 전환합니다
   */
  endGame(): void {
    this.phase = 'ended';
  }

  /**
   * 플레이 단계로 복귀합니다
   */
  returnToPlay(): void {
    this.phase = 'playing';
    this.meetingCaller = null;
    this.resetRound();
  }

  /**
   * 투표를 초기화합니다
   */
  resetVotes(): void {
    this.votes.clear();
    this.players.forEach(player => {
      player.hasVoted = false;
      player.votedFor = null;
    });
  }

  /**
   * 라운드를 초기화합니다
   */
  resetRound(): void {
    this.votes.clear();
    this.roundNumber++;
    
    this.players.forEach(player => {
      player.hasVoted = false;
      player.votedFor = null;
      player.isProtected = false;
    });
    
    this.mafiaKillTarget = null;
    this.doctorProtectTarget = null;
    this.policeCheckTarget = null;
    this.policeCheckResult = null;
  }

  /**
   * 살아있는 플레이어 수를 반환합니다
   */
  getAlivePlayerCount(): number {
    let count = 0;
    this.players.forEach(player => {
      if (player.isAlive) count++;
    });
    return count;
  }

  /**
   * 살아있는 마피아 수를 반환합니다
   */
  getAliveMafiaCount(): number {
    let count = 0;
    this.players.forEach(player => {
      if (player.isAlive && player.role === 'mafia') count++;
    });
    return count;
  }

  /**
   * 살아있는 플레이어 목록을 반환합니다
   */
  getAlivePlayers(): MafiaPlayerState[] {
    const alivePlayers: MafiaPlayerState[] = [];
    this.players.forEach(player => {
      if (player.isAlive) alivePlayers.push(player);
    });
    return alivePlayers;
  }

  /**
   * 모든 살아있는 플레이어가 투표했는지 확인
   */
  hasAllVoted(): boolean {
    const alivePlayers = this.getAlivePlayers();
    return alivePlayers.every(p => p.hasVoted);
  }
}
