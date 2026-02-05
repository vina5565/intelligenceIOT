// src/game/ui/MeetingUI.ts
// 회의/투표 UI 관리 클래스

import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';
import type { MafiaPlayerState, MeetingInfo, GameEndInfo, Role } from '../types';
import { ROLE_NAMES } from '../types';

export class MeetingUI {
  private scene: Phaser.Scene;
  private socket: Socket;
  private mySocketId: string;
  
  constructor(scene: Phaser.Scene, socket: Socket) {
    this.scene = scene;
    this.socket = socket;
    this.mySocketId = socket.id || '';
  }
  
  // 회의 UI 표시
  showMeeting(data: MeetingInfo): void {
    const camera = this.scene.cameras.main;
    
    // 회의 배경
    const meetingBg = this.scene.add.rectangle(
      camera.width / 2,
      camera.height / 2,
      600, 400,
      0x000000, 0.9
    );
    meetingBg.setScrollFactor(0);
    meetingBg.setDepth(1500);
    meetingBg.setData('meetingUI', true);

    // 회의 제목
    const title = this.scene.add.text(
      camera.width / 2,
      camera.height / 2 - 150,
      data.type === 'emergency' ? '🚨 긴급 회의' : '💀 시체 발견',
      { fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }
    );
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(1501);
    title.setData('meetingUI', true);

    // 소집자 정보
    const callerInfo = this.scene.add.text(
      camera.width / 2,
      camera.height / 2 - 100,
      `${data.callerName}님이 소집`,
      { fontSize: '20px', color: '#cccccc' }
    );
    callerInfo.setOrigin(0.5);
    callerInfo.setScrollFactor(0);
    callerInfo.setDepth(1501);
    callerInfo.setData('meetingUI', true);

    if (data.type === 'report' && data.bodyName) {
      const bodyInfo = this.scene.add.text(
        camera.width / 2,
        camera.height / 2 - 70,
        `발견된 시체: ${data.bodyName}`,
        { fontSize: '18px', color: '#ff6666' }
      );
      bodyInfo.setOrigin(0.5);
      bodyInfo.setScrollFactor(0);
      bodyInfo.setDepth(1501);
      bodyInfo.setData('meetingUI', true);
    }
  }
  
  // 회의 UI 숨기기
  hideMeeting(): void {
    this.scene.children.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData && child.getData('meetingUI')) {
        child.destroy();
      }
    });
  }
  
  // 투표 UI 표시
  showVoting(alivePlayers: MafiaPlayerState[], isAlive: boolean): void {
    const camera = this.scene.cameras.main;
    
    // 투표 배경
    const votingBg = this.scene.add.rectangle(
      camera.width / 2,
      camera.height / 2,
      700, 500,
      0x1a1a2e, 0.95
    );
    votingBg.setScrollFactor(0);
    votingBg.setDepth(1500);
    votingBg.setData('votingUI', true);

    // 투표 제목
    const title = this.scene.add.text(
      camera.width / 2,
      camera.height / 2 - 200,
      '🗳️ 투표',
      { fontSize: '28px', color: '#ffffff', fontStyle: 'bold' }
    );
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(1501);
    title.setData('votingUI', true);

    // 플레이어 버튼들
    const startY = camera.height / 2 - 120;
    const cols = 3;
    const buttonWidth = 180;
    const buttonHeight = 50;
    const paddingX = 20;
    const paddingY = 15;

    alivePlayers.forEach((player, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = camera.width / 2 - (cols - 1) * (buttonWidth + paddingX) / 2 + col * (buttonWidth + paddingX);
      const y = startY + row * (buttonHeight + paddingY);

      const button = this.scene.add.container(x, y);
      button.setScrollFactor(0);
      button.setDepth(1502);
      button.setData('votingUI', true);

      const bg = this.scene.add.graphics();
      const isMe = player.id === this.mySocketId;
      bg.fillStyle(isMe ? 0x4a90d9 : 0x3a3a5a, 1);
      bg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
      bg.lineStyle(2, 0x6b6b8a, 1);
      bg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);

      const label = this.scene.add.text(0, 0, player.nickname, {
        fontSize: '16px',
        color: '#ffffff'
      });
      label.setOrigin(0.5);

      button.add([bg, label]);

      if (!isMe && isAlive) {
        button.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
        button.on('pointerdown', () => {
          this.socket.emit('vote', player.id);
        });
        button.on('pointerover', () => {
          bg.clear();
          bg.fillStyle(0x5a5a7a, 1);
          bg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
          bg.lineStyle(2, 0x8b8bab, 1);
          bg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
        });
        button.on('pointerout', () => {
          bg.clear();
          bg.fillStyle(0x3a3a5a, 1);
          bg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
          bg.lineStyle(2, 0x6b6b8a, 1);
          bg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
        });
      }
    });

    // 스킵 버튼
    const skipY = startY + Math.ceil(alivePlayers.length / cols) * (buttonHeight + paddingY) + 30;
    const skipButton = this.scene.add.container(camera.width / 2, skipY);
    skipButton.setScrollFactor(0);
    skipButton.setDepth(1502);
    skipButton.setData('votingUI', true);

    const skipBg = this.scene.add.graphics();
    skipBg.fillStyle(0x666666, 1);
    skipBg.fillRoundedRect(-80, -25, 160, 50, 10);
    skipBg.lineStyle(2, 0x888888, 1);
    skipBg.strokeRoundedRect(-80, -25, 160, 50, 10);

    const skipLabel = this.scene.add.text(0, 0, '⏭️ 스킵', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    skipLabel.setOrigin(0.5);

    skipButton.add([skipBg, skipLabel]);

    if (isAlive) {
      skipButton.setInteractive(new Phaser.Geom.Rectangle(-80, -25, 160, 50), Phaser.Geom.Rectangle.Contains);
      skipButton.on('pointerdown', () => {
        this.socket.emit('vote', 'skip');
      });
    }
  }
  
  // 투표 UI 숨기기
  hideVoting(): void {
    this.scene.children.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData && child.getData('votingUI')) {
        child.destroy();
      }
    });
  }
  
  // 게임 종료 화면
  showGameEnd(data: GameEndInfo): void {
    const camera = this.scene.cameras.main;
    
    // 전체 화면 오버레이
    const overlay = this.scene.add.rectangle(
      camera.width / 2,
      camera.height / 2,
      camera.width,
      camera.height,
      data.winner === 'mafia' ? 0x330000 : 0x003300,
      0.9
    );
    overlay.setScrollFactor(0);
    overlay.setDepth(2000);

    // 승리 팀 표시
    const winnerText = this.scene.add.text(
      camera.width / 2,
      camera.height / 2 - 100,
      `🎉 ${data.winnerName} 승리! 🎉`,
      { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }
    );
    winnerText.setOrigin(0.5);
    winnerText.setScrollFactor(0);
    winnerText.setDepth(2001);

    // 플레이어 역할 공개
    const playerList = data.players.map(p => 
      `${p.nickname}: ${ROLE_NAMES[p.role]} ${p.isAlive ? '✓' : '✗'}`
    ).join('\n');

    const rolesText = this.scene.add.text(
      camera.width / 2,
      camera.height / 2 + 50,
      playerList,
      { fontSize: '18px', color: '#cccccc', align: 'center' }
    );
    rolesText.setOrigin(0.5);
    rolesText.setScrollFactor(0);
    rolesText.setDepth(2001);
  }
  
  // 시체 생성
  createDeadBody(playerId: string, x: number, y: number, nickname: string): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    
    // 시체 그래픽
    const bodyGraphics = this.scene.add.graphics();
    bodyGraphics.fillStyle(0x8b0000, 1);
    bodyGraphics.fillEllipse(0, 0, 40, 25);
    
    // X 표시
    const xMark = this.scene.add.text(0, 0, '💀', {
      fontSize: '24px'
    });
    xMark.setOrigin(0.5);
    
    // 이름
    const nameText = this.scene.add.text(0, -30, nickname, {
      fontSize: '12px',
      color: '#ff4444',
      backgroundColor: '#000000aa',
      padding: { x: 3, y: 2 }
    });
    nameText.setOrigin(0.5);
    
    container.add([bodyGraphics, xMark, nameText]);
    container.setDepth(50);
    container.setData('bodyId', playerId);
    
    return container;
  }
}
