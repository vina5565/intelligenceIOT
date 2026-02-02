// src/gameLogic.ts
// 마피아 게임 로직 관리

import { Player, PlayerGameState } from './roomManager';

// 역할 타입 정의
export type Role = 'citizen' | 'mafia' | 'police' | 'doctor';

// 플레이어 게임 상태 (역할 포함)
export interface MafiaPlayerState extends PlayerGameState {
  role: Role;
  isAlive: boolean;
  hasVoted: boolean;
  votedFor: string | null;  // 투표한 대상의 socketId
  isProtected: boolean;     // 의사가 보호 중
}

// 게임 페이즈
export type GamePhase = 'playing' | 'meeting' | 'voting' | 'result' | 'ended';

// 게임 상태
export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Map<string, MafiaPlayerState>;
  votes: Map<string, string>;           // 투표자 -> 피투표자
  meetingCaller: string | null;         // 회의 소집자
  mafiaKillTarget: string | null;       // 마피아가 죽이려는 대상
  doctorProtectTarget: string | null;   // 의사가 보호하려는 대상
  policeCheckTarget: string | null;     // 경찰이 조사하려는 대상
  policeCheckResult: boolean | null;    // 경찰 조사 결과
  roundNumber: number;
  meetingTimer: number;                 // 회의 남은 시간 (초)
  votingTimer: number;                  // 투표 남은 시간 (초)
  lastKilledPlayer: string | null;      // 마지막으로 죽은 플레이어
  lastVotedOutPlayer: string | null;    // 마지막으로 추방된 플레이어
}

// 역할 배정 (인원수에 따라 자동 조정)
export function assignRoles(players: Player[]): Map<string, Role> {
  const roles = new Map<string, Role>();
  const playerCount = players.length;
  
  // 역할 개수 계산
  // 4-5명: 마피아 1, 경찰 1, 의사 0, 나머지 시민
  // 6-7명: 마피아 1, 경찰 1, 의사 1, 나머지 시민
  // 8-10명: 마피아 2, 경찰 1, 의사 1, 나머지 시민
  
  let mafiaCount = 1;
  let policeCount = 1;
  let doctorCount = 0;
  
  if (playerCount >= 6) {
    doctorCount = 1;
  }
  if (playerCount >= 8) {
    mafiaCount = 2;
  }
  
  // 역할 목록 생성
  const roleList: Role[] = [];
  for (let i = 0; i < mafiaCount; i++) roleList.push('mafia');
  for (let i = 0; i < policeCount; i++) roleList.push('police');
  for (let i = 0; i < doctorCount; i++) roleList.push('doctor');
  while (roleList.length < playerCount) roleList.push('citizen');
  
  // 역할 셔플 (Fisher-Yates 알고리즘)
  for (let i = roleList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roleList[i], roleList[j]] = [roleList[j], roleList[i]];
  }
  
  // 플레이어에게 역할 배정
  players.forEach((player, index) => {
    roles.set(player.id, roleList[index]);
  });
  
  return roles;
}

// 게임 상태 초기화
export function initializeGameState(roomId: string, players: Player[], gameStates: Map<string, PlayerGameState>): GameState {
  const roles = assignRoles(players);
  const playerStates = new Map<string, MafiaPlayerState>();
  
  players.forEach(player => {
    const gameState = gameStates.get(player.id);
    const role = roles.get(player.id) || 'citizen';
    
    playerStates.set(player.id, {
      id: player.id,
      x: gameState?.x || 400,
      y: gameState?.y || 300,
      color: gameState?.color || '#00d4ff',
      nickname: player.nickname,
      role: role,
      isAlive: true,
      hasVoted: false,
      votedFor: null,
      isProtected: false
    });
  });
  
  return {
    roomId,
    phase: 'playing',
    players: playerStates,
    votes: new Map(),
    meetingCaller: null,
    mafiaKillTarget: null,
    doctorProtectTarget: null,
    policeCheckTarget: null,
    policeCheckResult: null,
    roundNumber: 1,
    meetingTimer: 60,  // 60초 회의 시간
    votingTimer: 30,   // 30초 투표 시간
    lastKilledPlayer: null,
    lastVotedOutPlayer: null
  };
}

// 긴급 회의 시작
export function startEmergencyMeeting(gameState: GameState, callerId: string): boolean {
  if (gameState.phase !== 'playing') return false;
  
  const caller = gameState.players.get(callerId);
  if (!caller || !caller.isAlive) return false;
  
  gameState.phase = 'meeting';
  gameState.meetingCaller = callerId;
  gameState.meetingTimer = 60;
  gameState.votes.clear();
  
  // 모든 플레이어 투표 상태 초기화
  gameState.players.forEach(player => {
    player.hasVoted = false;
    player.votedFor = null;
  });
  
  return true;
}

// 시체 발견으로 회의 시작
export function startReportMeeting(gameState: GameState, reporterId: string, bodyId: string): boolean {
  if (gameState.phase !== 'playing') return false;
  
  const reporter = gameState.players.get(reporterId);
  const body = gameState.players.get(bodyId);
  
  if (!reporter || !reporter.isAlive) return false;
  if (!body || body.isAlive) return false;  // 시체가 없으면 실패
  
  gameState.phase = 'meeting';
  gameState.meetingCaller = reporterId;
  gameState.meetingTimer = 60;
  gameState.lastKilledPlayer = bodyId;
  gameState.votes.clear();
  
  // 모든 플레이어 투표 상태 초기화
  gameState.players.forEach(player => {
    player.hasVoted = false;
    player.votedFor = null;
  });
  
  return true;
}

// 투표 단계로 전환
export function startVotingPhase(gameState: GameState): boolean {
  if (gameState.phase !== 'meeting') return false;
  
  gameState.phase = 'voting';
  gameState.votingTimer = 30;
  
  return true;
}

// 투표하기
export function castVote(gameState: GameState, voterId: string, targetId: string | 'skip'): boolean {
  if (gameState.phase !== 'voting') return false;
  
  const voter = gameState.players.get(voterId);
  if (!voter || !voter.isAlive || voter.hasVoted) return false;
  
  // 타겟이 skip이 아닌 경우 타겟 검증
  if (targetId !== 'skip') {
    const target = gameState.players.get(targetId);
    if (!target || !target.isAlive) return false;
  }
  
  voter.hasVoted = true;
  voter.votedFor = targetId;
  gameState.votes.set(voterId, targetId);
  
  return true;
}

// 투표 결과 계산
export function calculateVoteResult(gameState: GameState): { ejected: string | null; voteCount: Map<string, number>; tie: boolean } {
  const voteCount = new Map<string, number>();
  
  // 투표 집계
  gameState.votes.forEach((targetId) => {
    const current = voteCount.get(targetId) || 0;
    voteCount.set(targetId, current + 1);
  });
  
  // 가장 많은 표를 받은 플레이어 찾기
  let maxVotes = 0;
  let ejectedPlayer: string | null = null;
  let tie = false;
  
  voteCount.forEach((count, playerId) => {
    if (playerId === 'skip') return;  // 스킵은 제외
    
    if (count > maxVotes) {
      maxVotes = count;
      ejectedPlayer = playerId;
      tie = false;
    } else if (count === maxVotes && count > 0) {
      tie = true;  // 동점
    }
  });
  
  // 스킵 표가 과반수이면 추방 없음
  const skipVotes = voteCount.get('skip') || 0;
  const totalVoters = gameState.votes.size;
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

// 플레이어 추방 (투표 결과)
export function ejectPlayer(gameState: GameState, playerId: string): boolean {
  const player = gameState.players.get(playerId);
  if (!player) return false;
  
  player.isAlive = false;
  gameState.lastVotedOutPlayer = playerId;
  
  return true;
}

// 마피아 킬
export function mafiaKill(gameState: GameState, mafiaId: string, targetId: string): { success: boolean; blocked: boolean } {
  if (gameState.phase !== 'playing') return { success: false, blocked: false };
  
  const mafia = gameState.players.get(mafiaId);
  const target = gameState.players.get(targetId);
  
  if (!mafia || mafia.role !== 'mafia' || !mafia.isAlive) return { success: false, blocked: false };
  if (!target || !target.isAlive) return { success: false, blocked: false };
  
  // 의사가 보호 중인지 확인
  if (target.isProtected) {
    target.isProtected = false;  // 보호 소모
    return { success: false, blocked: true };
  }
  
  // 킬 성공
  target.isAlive = false;
  gameState.lastKilledPlayer = targetId;
  
  return { success: true, blocked: false };
}

// 의사 치료/보호
export function doctorProtect(gameState: GameState, doctorId: string, targetId: string): boolean {
  const doctor = gameState.players.get(doctorId);
  const target = gameState.players.get(targetId);
  
  if (!doctor || doctor.role !== 'doctor' || !doctor.isAlive) return false;
  if (!target || !target.isAlive) return false;
  
  // 이전 보호 제거
  gameState.players.forEach(player => {
    player.isProtected = false;
  });
  
  target.isProtected = true;
  gameState.doctorProtectTarget = targetId;
  
  return true;
}

// 경찰 조사
export function policeInvestigate(gameState: GameState, policeId: string, targetId: string): { success: boolean; isMafia: boolean } {
  const police = gameState.players.get(policeId);
  const target = gameState.players.get(targetId);
  
  if (!police || police.role !== 'police' || !police.isAlive) return { success: false, isMafia: false };
  if (!target || !target.isAlive) return { success: false, isMafia: false };
  
  const isMafia = target.role === 'mafia';
  gameState.policeCheckTarget = targetId;
  gameState.policeCheckResult = isMafia;
  
  return { success: true, isMafia };
}

// 게임 결과 확인
export interface GameResult {
  ended: boolean;
  winner: 'mafia' | 'citizen' | null;
}

export function checkGameEnd(gameState: GameState): GameResult {
  let aliveCount = 0;
  let mafiaAliveCount = 0;
  
  gameState.players.forEach(player => {
    if (player.isAlive) {
      aliveCount++;
      if (player.role === 'mafia') {
        mafiaAliveCount++;
      }
    }
  });
  
  // 마피아가 전멸하면 시민 승리
  if (mafiaAliveCount === 0) {
    gameState.phase = 'ended';
    return { ended: true, winner: 'citizen' };
  }
  
  // 마피아가 시민과 동수 이상이면 마피아 승리
  const citizenAliveCount = aliveCount - mafiaAliveCount;
  if (mafiaAliveCount >= citizenAliveCount) {
    gameState.phase = 'ended';
    return { ended: true, winner: 'mafia' };
  }
  
  return { ended: false, winner: null };
}

// 결과 발표 후 플레이 단계로 복귀
export function returnToPlayPhase(gameState: GameState): void {
  gameState.phase = 'playing';
  gameState.meetingCaller = null;
  gameState.votes.clear();
  gameState.roundNumber++;
  
  // 보호 상태 리셋
  gameState.players.forEach(player => {
    player.hasVoted = false;
    player.votedFor = null;
    player.isProtected = false;
  });
  
  gameState.mafiaKillTarget = null;
  gameState.doctorProtectTarget = null;
  gameState.policeCheckTarget = null;
  gameState.policeCheckResult = null;
}

// 플레이어 정보 가져오기 (역할 숨김 옵션)
export function getPlayerInfo(gameState: GameState, requesterId: string, hideRoles: boolean = true): MafiaPlayerState[] {
  const players: MafiaPlayerState[] = [];
  const requester = gameState.players.get(requesterId);
  
  gameState.players.forEach(player => {
    if (hideRoles && player.id !== requesterId) {
      // 역할 숨기기 (본인 제외)
      // 단, 마피아는 다른 마피아를 볼 수 있음
      const showRole = !player.isAlive || 
        (requester?.role === 'mafia' && player.role === 'mafia');
      
      players.push({
        ...player,
        role: showRole ? player.role : 'citizen'  // 역할을 시민으로 숨김
      });
    } else {
      players.push({ ...player });
    }
  });
  
  return players;
}

// Serializable 버전의 GameState (Map을 Object로 변환)
export interface SerializableGameState {
  roomId: string;
  phase: GamePhase;
  players: { [key: string]: MafiaPlayerState };
  votes: { [key: string]: string };
  meetingCaller: string | null;
  roundNumber: number;
  meetingTimer: number;
  votingTimer: number;
  lastKilledPlayer: string | null;
  lastVotedOutPlayer: string | null;
}

export function serializeGameState(gameState: GameState, requesterId: string): SerializableGameState {
  const players: { [key: string]: MafiaPlayerState } = {};
  const playerInfos = getPlayerInfo(gameState, requesterId);
  
  playerInfos.forEach(player => {
    players[player.id] = player;
  });
  
  const votes: { [key: string]: string } = {};
  gameState.votes.forEach((target, voter) => {
    votes[voter] = target;
  });
  
  return {
    roomId: gameState.roomId,
    phase: gameState.phase,
    players,
    votes,
    meetingCaller: gameState.meetingCaller,
    roundNumber: gameState.roundNumber,
    meetingTimer: gameState.meetingTimer,
    votingTimer: gameState.votingTimer,
    lastKilledPlayer: gameState.lastKilledPlayer,
    lastVotedOutPlayer: gameState.lastVotedOutPlayer
  };
}
