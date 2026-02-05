// src/domain/services/RoleService.ts
// 역할 관련 비즈니스 로직 - SRP 원칙

import { Role, MafiaPlayerState } from '../../types/GameTypes';
import { Player, PlayerGameState } from '../../types/RoomTypes';

/**
 * 역할 배정 및 관리 서비스
 * SRP: 역할 관련 로직만 담당
 */
export class RoleService {
  /**
   * 플레이어 수에 따라 역할을 배정합니다
   */
  assignRoles(players: Player[]): Map<string, Role> {
    const roles = new Map<string, Role>();
    const playerCount = players.length;
    
    // 역할 개수 계산
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
    this.shuffleArray(roleList);
    
    // 플레이어에게 역할 배정
    players.forEach((player, index) => {
      roles.set(player.id, roleList[index]);
    });
    
    return roles;
  }

  /**
   * 마피아 플레이어 목록을 반환합니다
   */
  getMafiaPlayers(players: Map<string, MafiaPlayerState>): { id: string; nickname: string }[] {
    const mafiaPlayers: { id: string; nickname: string }[] = [];
    
    players.forEach((playerState, playerId) => {
      if (playerState.role === 'mafia') {
        mafiaPlayers.push({ id: playerId, nickname: playerState.nickname });
      }
    });
    
    return mafiaPlayers;
  }

  /**
   * 역할 이름을 반환합니다
   */
  getRoleName(role: Role): string {
    const names: Record<Role, string> = {
      'citizen': '시민',
      'mafia': '마피아',
      'police': '경찰',
      'doctor': '의사'
    };
    return names[role];
  }

  /**
   * 역할 설명을 반환합니다
   */
  getRoleDescription(role: Role): string {
    const descriptions: Record<Role, string> = {
      'citizen': '마피아를 찾아서 추방하세요! 회의에서 올바른 선택을 내려야 합니다.',
      'mafia': '들키지 않게 시민들을 제거하세요. 다른 마피아와 협력하세요.',
      'police': '매 라운드 한 명을 조사하여 마피아인지 확인할 수 있습니다.',
      'doctor': '매 라운드 한 명을 보호하여 마피아의 공격으로부터 지킬 수 있습니다.'
    };
    return descriptions[role];
  }

  /**
   * 게임 상태 초기화 시 플레이어 상태를 생성합니다
   */
  createPlayerStates(
    players: Player[],
    roles: Map<string, Role>,
    gameStates: Map<string, PlayerGameState>
  ): Map<string, MafiaPlayerState> {
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
    
    return playerStates;
  }

  /**
   * 배열을 무작위로 섞습니다 (Fisher-Yates 알고리즘)
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
