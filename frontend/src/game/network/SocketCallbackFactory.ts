// src/game/network/SocketCallbackFactory.ts
// 소켓 콜백 팩토리 - GameScene에서 분리된 콜백 로직

import type { Socket } from 'socket.io-client';
import type { SocketHandlerCallbacks } from './SocketHandler';
import type { 
  PlayerData, GamePhase, Role,
  RoleInfo, MeetingInfo, VotingInfo, VotingResult,
  DeadBody, InvestigationResult, ProtectionResult,
  MafiaTeamInfo, GameEndInfo
} from '../types';
import type { Player } from '../player';
import type { OtherPlayersManager } from '../player';
import type { GameUI, MeetingUI } from '../ui';
import type { DeadBodyManager } from '../DeadBodyManager';

export interface CallbackDependencies {
  socket: Socket;
  player: Player;
  otherPlayers: OtherPlayersManager;
  deadBodyManager: DeadBodyManager;
  gameUI: GameUI;
  meetingUI: MeetingUI;
  showMessage: (text: string, duration?: number) => void;
  isSceneReady: () => boolean;
}

const PHASE_NAMES: { [key in GamePhase]: string } = {
  'playing': '플레이',
  'meeting': '회의',
  'voting': '투표',
  'result': '결과',
  'ended': '종료'
};

export function createSocketCallbacks(deps: CallbackDependencies): SocketHandlerCallbacks {
  const { socket, player, otherPlayers, deadBodyManager, gameUI, meetingUI, showMessage, isSceneReady } = deps;
  
  return {
    // 플레이어 이벤트
    onPlayerJoined: (data: PlayerData) => {
      if (data.id !== socket.id) {
        otherPlayers.addPlayer(data, isSceneReady());
      }
    },
    
    onPlayerLeft: (data: { playerId: string }) => {
      otherPlayers.removePlayer(data.playerId);
    },
    
    onPlayersUpdate: (players: PlayerData[]) => {
      players.forEach(p => {
        if (p.id !== socket.id) {
          otherPlayers.addPlayer(p, isSceneReady());
        }
      });
    },
    
    onPlayerMoved: (data: { id: string; x: number; y: number }) => {
      otherPlayers.updatePlayerPosition(data.id, data.x, data.y);
    },
    
    // 역할 이벤트
    onRoleAssigned: (data: RoleInfo) => {
      player.role = data.role as Role;
      gameUI.setRole(data.role, data.roleDescription);
      showMessage(`당신의 역할: ${data.roleName}`, 5000);
    },
    
    onMafiaTeamInfo: (data: MafiaTeamInfo) => {
      otherPlayers.setMafiaTeammates(data.teammates);
    },
    
    // 게임 액션 이벤트
    onPlayerKilled: (data: { killerId: string; victimId: string; victimName: string }) => {
      if (data.victimId === socket.id) {
        player.isAlive = false;
        showMessage('💀 당신이 죽었습니다!', 5000);
      } else {
        otherPlayers.killPlayer(data.victimId);
      }
    },
    
    onDeadBodySpawned: (data: DeadBody) => {
      deadBodyManager.createDeadBody(data.playerId, data.x, data.y, data.nickname);
    },
    
    onInvestigationResult: (data: InvestigationResult) => {
      const message = data.isMafia 
        ? `🔍 ${data.targetName}은(는) 마피아입니다!` 
        : `🔍 ${data.targetName}은(는) 마피아가 아닙니다.`;
      showMessage(message, 4000);
    },
    
    onProtectionResult: (data: ProtectionResult) => {
      showMessage(data.message, 3000);
    },
    
    // 회의/투표 이벤트
    onMeetingStarted: (data: MeetingInfo) => {
      player.gamePhase = 'meeting';
      gameUI.setPhaseText('페이즈: 회의');
      meetingUI.showMeeting(data);
      deadBodyManager.clearAll();
    },
    
    onVotingStarted: (data: VotingInfo) => {
      player.gamePhase = 'voting';
      gameUI.setPhaseText('페이즈: 투표');
      meetingUI.hideMeeting();
      meetingUI.showVoting(data.alivePlayers, player.isAlive);
    },
    
    onVotingResult: (data: VotingResult) => {
      meetingUI.hideVoting();
      if (data.ejectedName) {
        showMessage(`${data.ejectedName}님이 추방되었습니다.`, 4000);
        otherPlayers.ejectPlayer(data.ejected!);
      } else if (data.tie) {
        showMessage('동률! 아무도 추방되지 않았습니다.', 3000);
      }
    },
    
    // 게임 진행 이벤트
    onGamePhaseChanged: (data: { phase: GamePhase }) => {
      player.gamePhase = data.phase;
      gameUI.setPhaseText(`페이즈: ${PHASE_NAMES[data.phase]}`);
    },
    
    onGameEnded: (data: GameEndInfo) => {
      player.gamePhase = 'ended';
      meetingUI.showGameEnd(data);
    },
    
    // 에러
    onError: (data: { message: string }) => {
      showMessage(`❌ ${data.message}`, 3000);
    }
  };
}
