// src/types/GameTypes.ts
// 게임 관련 타입 정의

export type Role = 'citizen' | 'mafia' | 'police' | 'doctor';
export type GamePhase = 'playing' | 'meeting' | 'voting' | 'result' | 'ended';

export interface MafiaPlayerState {
  id: string;
  x: number;
  y: number;
  color: string;
  nickname: string;
  role: Role;
  isAlive: boolean;
  hasVoted: boolean;
  votedFor: string | null;
  isProtected: boolean;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Map<string, MafiaPlayerState>;
  votes: Map<string, string>;
  meetingCaller: string | null;
  mafiaKillTarget: string | null;
  doctorProtectTarget: string | null;
  policeCheckTarget: string | null;
  policeCheckResult: boolean | null;
  roundNumber: number;
  meetingTimer: number;
  votingTimer: number;
  lastKilledPlayer: string | null;
  lastVotedOutPlayer: string | null;
}

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

export interface GameResult {
  ended: boolean;
  winner: 'mafia' | 'citizen' | null;
}

export interface VoteResult {
  ejected: string | null;
  voteCount: Map<string, number>;
  tie: boolean;
}

export interface KillResult {
  success: boolean;
  blocked: boolean;
}

export interface InvestigationResult {
  success: boolean;
  isMafia: boolean;
}
