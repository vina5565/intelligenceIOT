// src/game/network/SocketHandler.ts
// 소켓 이벤트 핸들러 클래스

import type { Socket } from 'socket.io-client';
import type { 
  PlayerData, GamePhase, 
  RoleInfo, MeetingInfo, VotingInfo, VotingResult, 
  DeadBody, InvestigationResult, ProtectionResult,
  MafiaTeamInfo, GameEndInfo
} from '../types';

export interface SocketHandlerCallbacks {
  // 플레이어 이벤트
  onPlayerJoined: (data: PlayerData) => void;
  onPlayerLeft: (data: { playerId: string }) => void;
  onPlayersUpdate: (players: PlayerData[]) => void;
  onPlayerMoved: (data: { id: string; x: number; y: number }) => void;
  
  // 역할 이벤트
  onRoleAssigned: (data: RoleInfo) => void;
  onMafiaTeamInfo: (data: MafiaTeamInfo) => void;
  
  // 게임 액션 이벤트
  onPlayerKilled: (data: { killerId: string; victimId: string; victimName: string }) => void;
  onDeadBodySpawned: (data: DeadBody) => void;
  onInvestigationResult: (data: InvestigationResult) => void;
  onProtectionResult: (data: ProtectionResult) => void;
  
  // 회의/투표 이벤트
  onMeetingStarted: (data: MeetingInfo) => void;
  onVotingStarted: (data: VotingInfo) => void;
  onVotingResult: (data: VotingResult) => void;
  
  // 게임 진행 이벤트
  onGamePhaseChanged: (data: { phase: GamePhase }) => void;
  onGameEnded: (data: GameEndInfo) => void;
  
  // 에러
  onError: (data: { message: string }) => void;
}

export class SocketHandler {
  private socket: Socket;
  private callbacks: SocketHandlerCallbacks;
  
  constructor(socket: Socket, callbacks: SocketHandlerCallbacks) {
    this.socket = socket;
    this.callbacks = callbacks;
  }
  
  // 이벤트 리스너 등록
  setupListeners(): void {
    // 플레이어 이벤트
    this.socket.on('playerJoined', (data: PlayerData) => {
      console.log('플레이어 참가:', data.nickname);
      this.callbacks.onPlayerJoined(data);
    });
    
    // 백엔드에서 보내는 실제 이벤트 (이벤트 이름 매핑)
    this.socket.on('otherPlayerJoined', (data: PlayerData) => {
      console.log('다른 플레이어 참가:', data.nickname);
      this.callbacks.onPlayerJoined(data);
    });
    
    this.socket.on('currentPlayers', (players: PlayerData[]) => {
      console.log('현재 플레이어 목록:', players.length);
      this.callbacks.onPlayersUpdate(players);
    });
    
    this.socket.on('playerLeft', (data: { playerId: string }) => {
      console.log('플레이어 퇴장:', data.playerId);
      this.callbacks.onPlayerLeft(data);
    });
    
    this.socket.on('playerLeftGame', (playerId: string) => {
      console.log('플레이어 게임 퇴장:', playerId);
      this.callbacks.onPlayerLeft({ playerId });
    });
    
    this.socket.on('playersUpdate', (players: PlayerData[]) => {
      this.callbacks.onPlayersUpdate(players);
    });
    
    this.socket.on('playerMoved', (data: { id: string; x: number; y: number }) => {
      this.callbacks.onPlayerMoved(data);
    });
    
    this.socket.on('otherPlayerMoved', (data: { id: string; x: number; y: number }) => {
      this.callbacks.onPlayerMoved(data);
    });
    
    // 역할 이벤트
    this.socket.on('roleAssigned', (data: RoleInfo) => {
      console.log('역할 배정:', data.roleName);
      this.callbacks.onRoleAssigned(data);
    });
    
    this.socket.on('mafiaTeamInfo', (data: MafiaTeamInfo) => {
      console.log('마피아 팀:', data.teammates.map(t => t.nickname).join(', '));
      this.callbacks.onMafiaTeamInfo(data);
    });
    
    // 백엔드에서 mafiaTeam으로 보내는 경우
    this.socket.on('mafiaTeam', (data: MafiaTeamInfo) => {
      console.log('마피아 팀 (mafiaTeam):', data.teammates.map(t => t.nickname).join(', '));
      this.callbacks.onMafiaTeamInfo(data);
    });
    
    // 게임 액션 이벤트
    this.socket.on('playerKilled', (data: { killerId: string; victimId: string; victimName: string }) => {
      console.log('플레이어 킬됨:', data.victimName);
      this.callbacks.onPlayerKilled(data);
    });
    
    this.socket.on('deadBodySpawned', (data: DeadBody) => {
      this.callbacks.onDeadBodySpawned(data);
    });
    
    this.socket.on('investigationResult', (data: InvestigationResult) => {
      this.callbacks.onInvestigationResult(data);
    });
    
    this.socket.on('protectionResult', (data: ProtectionResult) => {
      this.callbacks.onProtectionResult(data);
    });
    
    // 회의/투표 이벤트
    this.socket.on('meetingStarted', (data: MeetingInfo) => {
      console.log('회의 시작:', data.type);
      this.callbacks.onMeetingStarted(data);
    });
    
    this.socket.on('votingStarted', (data: VotingInfo) => {
      console.log('투표 시작');
      this.callbacks.onVotingStarted(data);
    });
    
    this.socket.on('votingResult', (data: VotingResult) => {
      console.log('투표 결과:', data.ejectedName || '동률');
      this.callbacks.onVotingResult(data);
    });
    
    // 게임 진행 이벤트
    this.socket.on('gamePhaseChanged', (data: { phase: GamePhase }) => {
      console.log('게임 페이즈 변경:', data.phase);
      this.callbacks.onGamePhaseChanged(data);
    });
    
    // 백엔드에서 phaseChanged로 보내는 경우
    this.socket.on('phaseChanged', (data: { phase: GamePhase }) => {
      console.log('페이즈 변경 (phaseChanged):', data.phase);
      this.callbacks.onGamePhaseChanged(data);
    });
    
    this.socket.on('gameEnded', (data: GameEndInfo) => {
      console.log('게임 종료:', data.winnerName);
      this.callbacks.onGameEnded(data);
    });
    
    // 보호 결과 매핑 (protectionSet -> protectionResult)
    this.socket.on('protectionSet', (data: ProtectionResult) => {
      this.callbacks.onProtectionResult(data);
    });
    
    // 킬 실패 (의사 보호)
    this.socket.on('killBlocked', (data: { message: string }) => {
      this.callbacks.onError(data); // 메시지 보여주기용
    });

    // 타이머 업데이트 (현재 UI에 반영할 메서드가 없다면 콘솔이라도)
    this.socket.on('timerUpdate', (data: { phase: string, timeLeft: number }) => {
      // TODO: 타이머 UI 업데이트 연결
      // console.log(`타이머: ${data.phase} - ${data.timeLeft}`);
    });

    // 투표 현황
    this.socket.on('playerVoted', (data: any) => {
      // TODO: 투표 UI 업데이트 연결
    });

    // 게임 채팅
    this.socket.on('gameChatMessage', (data: any) => {
      // TODO: 게임 채팅 UI 연결
      console.log(`[게임채팅] ${data.nickname}: ${data.message}`);
    });

    // 에러
    this.socket.on('mafiaKillError', (data: { message: string }) => {
      this.callbacks.onError(data);
    });
    
    this.socket.on('error', (data: { message: string }) => {
      this.callbacks.onError(data);
    });
  }
  
  // 리스너 제거
  removeListeners(): void {
    const events = [
      'playerJoined', 'playerLeft', 'playersUpdate', 'playerMoved',
      'otherPlayerJoined', 'otherPlayerMoved', 'currentPlayers', 'playerLeftGame',
      'roleAssigned', 'mafiaTeamInfo', 'mafiaTeam',
      'playerKilled', 'deadBodySpawned', 'investigationResult', 'protectionResult', 'protectionSet',
      'meetingStarted', 'votingStarted', 'votingResult',
      'gamePhaseChanged', 'phaseChanged', 'gameEnded',
      'mafiaKillError', 'error', 'killBlocked',
      'timerUpdate', 'playerVoted', 'gameChatMessage'
    ];
    
    events.forEach(event => {
      this.socket.off(event);
    });
  }
}
