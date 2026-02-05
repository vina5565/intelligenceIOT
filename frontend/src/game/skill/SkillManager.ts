// src/game/skill/SkillManager.ts
// 역할별 스킬 관리 클래스

import type { Socket } from 'socket.io-client';
import type { Role, GamePhase } from '../types';

export interface SkillConfig {
  socket: Socket;
  onMessage: (text: string, duration?: number) => void;
}

export class SkillManager {
  private socket: Socket;
  private onMessage: (text: string, duration?: number) => void;
  
  // 쿨다운
  private killCooldown: number = 0;
  private investigateCooldown: number = 0;
  private protectCooldown: number = 0;
  
  // 상수
  private readonly KILL_COOLDOWN = 30;      // 30초
  private readonly INVESTIGATE_COOLDOWN = 60; // 60초
  private readonly PROTECT_COOLDOWN = 45;    // 45초
  
  constructor(config: SkillConfig) {
    this.socket = config.socket;
    this.onMessage = config.onMessage;
  }
  
  // 쿨다운 업데이트 (매 프레임 호출)
  updateCooldowns(delta: number): void {
    const deltaSeconds = delta / 1000;
    
    if (this.killCooldown > 0) {
      this.killCooldown -= deltaSeconds;
    }
    if (this.investigateCooldown > 0) {
      this.investigateCooldown -= deltaSeconds;
    }
    if (this.protectCooldown > 0) {
      this.protectCooldown -= deltaSeconds;
    }
  }
  
  // 킬 쿨다운 가져오기
  getKillCooldown(): number {
    return this.killCooldown;
  }
  
  // 스페이스바 액션 처리
  handleSpacebarAction(
    role: Role,
    isAlive: boolean,
    gamePhase: GamePhase,
    nearbyPlayerId: string | null
  ): void {
    if (!isAlive || gamePhase !== 'playing') {
      return;
    }

    switch (role) {
      case 'mafia':
        this.handleMafiaKill(nearbyPlayerId);
        break;
      case 'police':
        this.handlePoliceInvestigate(nearbyPlayerId);
        break;
      case 'doctor':
        this.handleDoctorProtect(nearbyPlayerId);
        break;
      case 'citizen':
        this.onMessage('시민은 특수 능력이 없습니다.', 2000);
        break;
    }
  }
  
  // 마피아 킬
  private handleMafiaKill(nearbyPlayerId: string | null): void {
    if (nearbyPlayerId && this.killCooldown <= 0) {
      this.socket.emit('mafiaKill', nearbyPlayerId);
      this.killCooldown = this.KILL_COOLDOWN;
      this.onMessage('🔪 킬 시도 중...', 2000);
    } else if (this.killCooldown > 0) {
      this.onMessage(`⏳ 쿨다운: ${Math.ceil(this.killCooldown)}초`, 1500);
    } else {
      this.onMessage('주변에 킬할 수 있는 플레이어가 없습니다.', 2000);
    }
  }
  
  // 경찰 조사
  private handlePoliceInvestigate(nearbyPlayerId: string | null): void {
    if (nearbyPlayerId && this.investigateCooldown <= 0) {
      this.socket.emit('policeInvestigate', nearbyPlayerId);
      this.investigateCooldown = this.INVESTIGATE_COOLDOWN;
      this.onMessage('🔍 조사 중...', 2000);
    } else if (this.investigateCooldown > 0) {
      this.onMessage(`⏳ 쿨다운: ${Math.ceil(this.investigateCooldown)}초`, 1500);
    } else {
      this.onMessage('주변에 조사할 플레이어가 없습니다.', 2000);
    }
  }
  
  // 의사 보호
  private handleDoctorProtect(nearbyPlayerId: string | null): void {
    if (nearbyPlayerId && this.protectCooldown <= 0) {
      this.socket.emit('doctorProtect', nearbyPlayerId);
      this.protectCooldown = this.PROTECT_COOLDOWN;
      this.onMessage('💉 보호 설정...', 2000);
    } else if (this.protectCooldown > 0) {
      this.onMessage(`⏳ 쿨다운: ${Math.ceil(this.protectCooldown)}초`, 1500);
    } else {
      this.onMessage('주변에 보호할 플레이어가 없습니다.', 2000);
    }
  }
  
  // 버튼 클릭으로 사용
  useKillAbility(nearbyPlayerId: string | null): boolean {
    if (nearbyPlayerId && this.killCooldown <= 0) {
      this.socket.emit('mafiaKill', nearbyPlayerId);
      this.killCooldown = this.KILL_COOLDOWN;
      return true;
    }
    return false;
  }
  
  useInvestigateAbility(nearbyPlayerId: string | null): boolean {
    if (nearbyPlayerId) {
      this.socket.emit('policeInvestigate', nearbyPlayerId);
      return true;
    }
    return false;
  }
  
  useProtectAbility(nearbyPlayerId: string | null): boolean {
    if (nearbyPlayerId) {
      this.socket.emit('doctorProtect', nearbyPlayerId);
      return true;
    }
    return false;
  }
  
  // 긴급 회의 소집
  callEmergencyMeeting(): void {
    this.socket.emit('callEmergencyMeeting');
  }
  
  // 시체 리포트
  reportBody(bodyId: string): void {
    this.socket.emit('reportBody', bodyId);
  }
  
  // 쿨다운 리셋 (라운드 시작 시)
  resetCooldowns(): void {
    this.killCooldown = 0;
    this.investigateCooldown = 0;
    this.protectCooldown = 0;
  }
}
