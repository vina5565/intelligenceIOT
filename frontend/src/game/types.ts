// src/game/types.ts
// 게임 관련 타입 정의

export type Role = 'citizen' | 'mafia' | 'police' | 'doctor';
export type GamePhase = 'playing' | 'meeting' | 'voting' | 'result' | 'ended';

export interface PlayerData {
  id: string;
  x: number;
  y: number;
  nickname: string;
  color: string;
}

export interface MafiaPlayerState extends PlayerData {
  role: Role;
  isAlive: boolean;
  hasVoted: boolean;
  votedFor: string | null;
  isProtected: boolean;
}

export interface RoleInfo {
  role: Role;
  roleName: string;
  roleDescription: string;
}

export interface MafiaTeamInfo {
  teammates: { id: string; nickname: string }[];
}

export interface MeetingInfo {
  type: 'emergency' | 'report';
  callerId: string;
  callerName: string;
  bodyId?: string;
  bodyName?: string;
  phase: string;
  timer: number;
  alivePlayers: MafiaPlayerState[];
}

export interface VotingInfo {
  phase: string;
  timer: number;
  alivePlayers: MafiaPlayerState[];
}

export interface VotingResult {
  ejected: string | null;
  ejectedName: string | null;
  ejectedRole: Role | null;
  tie: boolean;
  voteDetails: { playerId: string; nickname: string; votes: number }[];
}

export interface GameEndInfo {
  winner: 'mafia' | 'citizen';
  winnerName: string;
  players: MafiaPlayerState[];
}

export interface DeadBody {
  playerId: string;
  x: number;
  y: number;
  nickname: string;
}

export interface InvestigationResult {
  targetId: string;
  targetName: string;
  isMafia: boolean;
  message: string;
}

export interface ProtectionResult {
  targetId: string;
  targetName: string;
  message: string;
}

// 역할 관련 유틸리티
export const ROLE_COLORS: { [key in Role]: number } = {
  citizen: 0x4a90d9,   // 파란색
  mafia: 0xff4444,     // 빨간색
  police: 0xffd700,    // 금색
  doctor: 0x44ff44     // 초록색
};

export const ROLE_NAMES: { [key in Role]: string } = {
  citizen: '시민',
  mafia: '마피아',
  police: '경찰',
  doctor: '의사'
};
