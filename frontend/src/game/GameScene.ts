// src/game/GameScene.ts
// 메인 게임 씬 - 리팩토링된 버전

import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';

// 모듈 임포트
import { Player, OtherPlayersManager } from './player';
import { CampusMap } from './map';
import { SkillManager } from './skill';
import { GameUI, MeetingUI } from './ui';
import { SocketHandler, createSocketCallbacks } from './network';
import { DeadBodyManager } from './DeadBodyManager';

export class GameScene extends Phaser.Scene {
  // 핵심 의존성
  private socket: Socket;
  private playerNickname: string;
  private playerColor: string;
  
  // 매니저 클래스들
  private player!: Player;
  private otherPlayers!: OtherPlayersManager;
  private campusMap!: CampusMap;
  private skillManager!: SkillManager;
  private gameUI!: GameUI;
  private meetingUI!: MeetingUI;
  private socketHandler!: SocketHandler;
  private deadBodyManager!: DeadBodyManager;
  
  // 씬 상태
  private sceneReady: boolean = false;
  
  // 근처 객체 (UI 업데이트용)
  private nearbyPlayer: string | null = null;
  private nearbyBody: string | null = null;

  constructor(socket: Socket, nickname: string) {
    super({ key: 'GameScene' });
    this.socket = socket;
    this.playerNickname = nickname;
    this.playerColor = this.getRandomColor();
  }

  preload() {
    // 캐릭터 스프라이트 로드
    this.load.image('character_red', '/assets/characters/red.png');
    this.load.image('character_blue', '/assets/characters/blue.png');
    this.load.image('character_green', '/assets/characters/green.png');
    this.load.image('character_yellow', '/assets/characters/yellow.png');
  }

  create() {
    // 맵 생성
    this.campusMap = new CampusMap(this);
    this.campusMap.create();
    
    // 플레이어 생성 (Player 클래스 사용)
    this.player = new Player({
      scene: this,
      socket: this.socket,
      x: 700,
      y: 500,
      nickname: this.playerNickname,
      color: this.playerColor,
      spriteKey: this.getCharacterSpriteKey(this.playerColor),
      onSpacebarPress: () => this.handleSpacebarAction()
    });
    
    // 맵 충돌 추가
    this.campusMap.addColliderToPlayer(this.player.phaserSprite);
    
    // 다른 플레이어 매니저
    this.otherPlayers = new OtherPlayersManager(this);
    
    // 스킬 매니저
    this.skillManager = new SkillManager({
      socket: this.socket,
      onMessage: this.showMessage.bind(this)
    });
    
    // UI 생성
    this.gameUI = new GameUI({
      scene: this,
      onKillClick: () => this.handleKillAction(),
      onReportClick: () => this.handleReportAction(),
      onMeetingClick: () => this.handleMeetingAction(),
      onSpecialClick: () => this.handleSpecialAction()
    });
    this.meetingUI = new MeetingUI(this, this.socket);
    
    // 시체 매니저
    this.deadBodyManager = new DeadBodyManager({ scene: this });
    
    // 카메라 설정
    this.cameras.main.startFollow(this.player.phaserSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);

    // UI 생성
    this.gameUI.create();

    // 소켓 이벤트 핸들러 설정
    this.setupSocketHandler();

    // Scene 준비 완료
    this.sceneReady = true;

    // 초기 위치 전송
    console.log('플레이어 게임 참가:', this.playerNickname, 'at', this.player.x, this.player.y);
    this.socket.emit('playerJoinedGame', {
      x: this.player.x,
      y: this.player.y,
      nickname: this.playerNickname,
      color: this.playerColor
    });

    // 대기 중인 플레이어 처리
    this.otherPlayers.processPendingPlayers();
  }

  update(_time: number, delta: number) {
    if (!this.player || !this.sceneReady) return;

    // 플레이어 업데이트 (이동 + 위치 전송)
    this.player.update();
    this.player.sendPositionUpdate();
    this.player.updateNamePosition();
    
    // 다른 플레이어 업데이트
    this.otherPlayers.updateNamePositions();
    
    // 근처 객체 확인
    this.checkNearbyObjects();
    
    // 버튼 상태 업데이트
    this.gameUI.updateButtonStates(
      this.player.role,
      this.player.gamePhase,
      this.player.isAlive,
      this.nearbyPlayer,
      this.nearbyBody,
      this.skillManager.getKillCooldown()
    );
    
    // 스킬 쿨다운 업데이트
    this.skillManager.updateCooldowns(delta);
  }

  // === 근처 객체 확인 ===
  
  private checkNearbyObjects() {
    const nearbyRange = 100;

    // 근처 플레이어 확인
    this.nearbyPlayer = this.otherPlayers.findNearbyPlayer(
      this.player.x, 
      this.player.y, 
      nearbyRange
    );

    // 근처 시체 확인
    this.nearbyBody = this.deadBodyManager.findNearbyBody(
      this.player.x,
      this.player.y,
      nearbyRange
    );
  }

  // === 액션 핸들러 ===
  
  private handleSpacebarAction() {
    this.skillManager.handleSpacebarAction(
      this.player.role,
      this.player.isAlive,
      this.player.gamePhase,
      this.nearbyPlayer
    );
  }
  
  private handleKillAction() {
    if (this.skillManager.useKillAbility(this.nearbyPlayer)) {
      this.showMessage('🔪 킬 시도 중...', 2000);
    }
  }
  
  private handleReportAction() {
    if (this.nearbyBody) {
      this.skillManager.reportBody(this.nearbyBody);
    }
  }
  
  private handleMeetingAction() {
    this.skillManager.callEmergencyMeeting();
  }
  
  private handleSpecialAction() {
    if (!this.nearbyPlayer) {
      this.showMessage('주변에 플레이어가 없습니다.');
      return;
    }

    if (this.player.role === 'police') {
      this.skillManager.useInvestigateAbility(this.nearbyPlayer);
    } else if (this.player.role === 'doctor') {
      this.skillManager.useProtectAbility(this.nearbyPlayer);
    }
  }

  // === 메시지 표시 ===
  
  private showMessage(text: string, duration: number = 3000) {
    this.gameUI.showMessage(text, duration);
  }

  // === 소켓 이벤트 핸들러 ===
  
  private setupSocketHandler() {
    const callbacks = createSocketCallbacks({
      socket: this.socket,
      player: this.player,
      otherPlayers: this.otherPlayers,
      deadBodyManager: this.deadBodyManager,
      gameUI: this.gameUI,
      meetingUI: this.meetingUI,
      showMessage: this.showMessage.bind(this),
      isSceneReady: () => this.sceneReady
    });
    
    this.socketHandler = new SocketHandler(this.socket, callbacks);
    this.socketHandler.setupListeners();
  }

  // === 유틸리티 ===
  
  private getCharacterSpriteKey(color: string): string {
    const colorMap: { [key: string]: string } = {
      '#ff0000': 'character_red',
      '#0000ff': 'character_blue',
      '#00ff00': 'character_green',
      '#ffff00': 'character_yellow'
    };

    return colorMap[color.toLowerCase()] || 'character_green';
  }

  private getRandomColor(): string {
    const colors = ['#ff0000', '#0000ff', '#00ff00', '#ffff00'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  shutdown() {
    console.log('GameScene 종료');
    this.socketHandler?.removeListeners();
    this.otherPlayers?.destroy();
    this.player?.destroy();
    this.deadBodyManager?.destroy();
  }
}
