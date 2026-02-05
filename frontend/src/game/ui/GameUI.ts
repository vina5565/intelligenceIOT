// src/game/ui/GameUI.ts
// 게임 UI 관리 클래스

import Phaser from 'phaser';
import type { Role, GamePhase } from '../types';
import { ROLE_NAMES } from '../types';

export interface GameUIConfig {
  scene: Phaser.Scene;
  onKillClick: () => void;
  onReportClick: () => void;
  onMeetingClick: () => void;
  onSpecialClick: () => void;
}

export class GameUI {
  private scene: Phaser.Scene;
  
  // UI 요소들
  private roleText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private killButton!: Phaser.GameObjects.Container;
  private reportButton!: Phaser.GameObjects.Container;
  private meetingButton!: Phaser.GameObjects.Container;
  private specialActionButton!: Phaser.GameObjects.Container;
  
  // 콜백
  private onKillClick: () => void;
  private onReportClick: () => void;
  private onMeetingClick: () => void;
  private onSpecialClick: () => void;
  
  constructor(config: GameUIConfig) {
    this.scene = config.scene;
    this.onKillClick = config.onKillClick;
    this.onReportClick = config.onReportClick;
    this.onMeetingClick = config.onMeetingClick;
    this.onSpecialClick = config.onSpecialClick;
  }
  
  // UI 생성
  create(): void {
    // 역할 표시
    this.roleText = this.scene.add.text(20, 20, '역할: 대기중...', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 5 }
    });
    this.roleText.setScrollFactor(0);
    this.roleText.setDepth(1000);

    // 게임 페이즈 표시
    this.phaseText = this.scene.add.text(20, 55, '페이즈: 플레이', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 5 }
    });
    this.phaseText.setScrollFactor(0);
    this.phaseText.setDepth(1000);

    // 버튼들 생성
    this.createActionButtons();
  }
  
  // 역할 설정
  setRole(role: Role, description: string): void {
    this.roleText.setText(`역할: ${ROLE_NAMES[role]}`);
    this.roleText.setBackgroundColor(this.getRoleBackgroundColor(role));
    
    // 역할에 따른 UI 업데이트
    if (role === 'mafia') {
      this.killButton.setVisible(true);
    } else if (role === 'police' || role === 'doctor') {
      this.specialActionButton.setVisible(true);
      const actionLabel = role === 'police' ? '🔍 조사' : '💉 치료';
      (this.specialActionButton.list[1] as Phaser.GameObjects.Text).setText(actionLabel);
    }
  }
  
  // 페이즈 텍스트 업데이트
  setPhaseText(text: string): void {
    this.phaseText.setText(text);
  }
  
  // 버튼 상태 업데이트
  updateButtonStates(
    role: Role,
    gamePhase: GamePhase,
    isAlive: boolean,
    nearbyPlayer: string | null,
    nearbyBody: string | null,
    killCooldown: number
  ): void {
    // 킬 버튼 (마피아 전용)
    if (this.killButton) {
      const canKill = role === 'mafia' && 
                      nearbyPlayer !== null && 
                      killCooldown <= 0 &&
                      gamePhase === 'playing' &&
                      isAlive;
      this.killButton.setAlpha(canKill ? 1 : 0.5);
      this.killButton.setData('enabled', canKill);
    }

    // 리포트 버튼
    if (this.reportButton) {
      const canReport = nearbyBody !== null && gamePhase === 'playing' && isAlive;
      this.reportButton.setAlpha(canReport ? 1 : 0.5);
      this.reportButton.setData('enabled', canReport);
    }

    // 긴급 회의 버튼
    if (this.meetingButton) {
      const canMeet = gamePhase === 'playing' && isAlive;
      this.meetingButton.setAlpha(canMeet ? 1 : 0.5);
      this.meetingButton.setData('enabled', canMeet);
    }
    
    // 특수 능력 버튼
    if (this.specialActionButton && this.specialActionButton.visible) {
      const canUse = nearbyPlayer !== null && gamePhase === 'playing' && isAlive;
      this.specialActionButton.setAlpha(canUse ? 1 : 0.5);
      this.specialActionButton.setData('enabled', canUse);
    }
  }
  
  // 액션 버튼 생성
  private createActionButtons(): void {
    const camera = this.scene.cameras.main;
    const buttonY = camera.height - 80;
    const buttonSpacing = 120;
    const startX = camera.width / 2 - buttonSpacing * 1.5;

    // 킬 버튼 (마피아 전용)
    this.killButton = this.createButton(startX, buttonY, '🔪 킬', 0xff4444, () => {
      if (this.killButton.getData('enabled')) {
        this.onKillClick();
      }
    });
    this.killButton.setVisible(false);

    // 리포트 버튼
    this.reportButton = this.createButton(startX + buttonSpacing, buttonY, '💀 리포트', 0xffa500, () => {
      if (this.reportButton.getData('enabled')) {
        this.onReportClick();
      }
    });

    // 긴급 회의 버튼
    this.meetingButton = this.createButton(startX + buttonSpacing * 2, buttonY, '🚨 회의', 0xff6600, () => {
      if (this.meetingButton.getData('enabled')) {
        this.onMeetingClick();
      }
    });

    // 특수 능력 버튼 (경찰/의사용)
    this.specialActionButton = this.createButton(startX + buttonSpacing * 3, buttonY, '⭐ 능력', 0x9966ff, () => {
      if (this.specialActionButton.getData('enabled')) {
        this.onSpecialClick();
      }
    });
    this.specialActionButton.setVisible(false);
  }
  
  private createButton(x: number, y: number, text: string, color: number, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    container.setScrollFactor(0);
    container.setDepth(1001);

    const bg = this.scene.add.graphics();
    bg.fillStyle(color, 0.8);
    bg.fillRoundedRect(-50, -25, 100, 50, 10);
    bg.lineStyle(2, 0xffffff, 0.5);
    bg.strokeRoundedRect(-50, -25, 100, 50, 10);

    const label = this.scene.add.text(0, 0, text, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    label.setOrigin(0.5);

    container.add([bg, label]);
    container.setInteractive(new Phaser.Geom.Rectangle(-50, -25, 100, 50), Phaser.Geom.Rectangle.Contains);
    container.on('pointerdown', onClick);
    container.on('pointerover', () => container.setScale(1.1));
    container.on('pointerout', () => container.setScale(1));

    return container;
  }
  
  // 메시지 표시
  showMessage(text: string, duration: number = 3000): void {
    const camera = this.scene.cameras.main;
    const message = this.scene.add.text(
      camera.width / 2,
      100,
      text,
      {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 20, y: 10 }
      }
    );
    message.setOrigin(0.5);
    message.setScrollFactor(0);
    message.setDepth(2000);

    this.scene.time.delayedCall(duration, () => {
      message.destroy();
    });
  }
  
  private getRoleBackgroundColor(role: Role): string {
    const colors: { [key in Role]: string } = {
      citizen: '#4a90d9aa',
      mafia: '#ff4444aa',
      police: '#ffd700aa',
      doctor: '#44ff44aa'
    };
    return colors[role] || '#000000aa';
  }
}
