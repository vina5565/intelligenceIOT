// src/game/GameScene.ts
import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';
import type { 
  PlayerData, Role, GamePhase, MafiaPlayerState, 
  RoleInfo, MeetingInfo, DeadBody 
} from './types';
import { NetworkInterpolation } from './NetworkInterpolation';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private socket: Socket;
  private otherPlayers: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();
  private deadBodies: Map<string, Phaser.GameObjects.Container> = new Map();
  private playerNickname: string;
  private playerColor: string;
  private lastPosition = { x: 0, y: 0 };
  private sceneReady: boolean = false;
  private pendingPlayers: PlayerData[] = [];
  
  // 네트워크 보간 시스템
  private interpolation: NetworkInterpolation = new NetworkInterpolation();

  // 마피아 게임 상태
  private myRole: Role = 'citizen';
  private gamePhase: GamePhase = 'playing';
  private isAlive: boolean = true;
  private mafiaTeammates: { id: string; nickname: string }[] = [];
  
  // UI 요소들
  private roleText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;

  private killButton!: Phaser.GameObjects.Container;
  private reportButton!: Phaser.GameObjects.Container;
  private meetingButton!: Phaser.GameObjects.Container;
  private specialActionButton!: Phaser.GameObjects.Container;
  private killCooldown: number = 0;
  private nearbyPlayer: string | null = null;
  private nearbyBody: string | null = null;

  constructor(socket: Socket, nickname: string) {
    super({ key: 'GameScene' });
    this.socket = socket;
    this.playerNickname = nickname;
    this.playerColor = this.getRandomColor();
  }

  preload() {
    // 캐릭터 스프라이트 이미지 로드
    this.load.image('character_red', '/assets/characters/character_sprite_red_1769977413169.png');
    this.load.image('character_blue', '/assets/characters/character_sprite_blue_1769977426399.png');
    this.load.image('character_green', '/assets/characters/character_sprite_green_1769977443342.png');
    this.load.image('character_yellow', '/assets/characters/character_sprite_yellow_1769977460632.png');
  }

  create() {
    // 배경 설정
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // 대학교 캠퍼스 맵 생성
    this.createCampusMap();

    // 플레이어 색상에 맞는 스프라이트 선택
    const spriteKey = this.getCharacterSpriteKey(this.playerColor);
    
    // 플레이어 생성
    this.player = this.physics.add.sprite(500, 400, spriteKey);
    this.player.setCollideWorldBounds(true);
    this.player.setScale(0.5);
    this.player.setDisplaySize(48, 48);

    // 플레이어 이름 표시
    const nameText = this.add.text(0, -40, this.playerNickname, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 5, y: 2 }
    });
    nameText.setOrigin(0.5);
    this.player.setData('nameText', nameText);

    // 키보드 입력 설정
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    
    // 스페이스바 - 역할별 능력 사용
    const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    spaceKey.on('down', () => this.handleSpacebarAction());

    // 카메라 설정
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);

    // UI 생성
    this.createGameUI();

    // Socket.IO 이벤트 리스너 설정
    this.setupSocketListeners();

    // Scene 준비 완료 표시
    this.sceneReady = true;

    // 초기 위치 전송
    console.log('플레이어 게임 참가:', this.playerNickname, 'at', this.player.x, this.player.y);
    this.socket.emit('playerJoinedGame', {
      x: this.player.x,
      y: this.player.y,
      nickname: this.playerNickname,
      color: this.playerColor
    });

    // Scene이 준비되기 전에 도착한 플레이어들 추가
    if (this.pendingPlayers.length > 0) {
      console.log('대기 중인 플레이어 추가:', this.pendingPlayers.length, '명');
      this.pendingPlayers.forEach(playerData => {
        this.addOtherPlayer(playerData);
      });
      this.pendingPlayers = [];
    }
  }

  update() {
    if (!this.player || !this.isAlive) return;

    // 대기 중인 플레이어가 있고 Scene이 준비되었으면 추가 시도
    if (this.pendingPlayers.length > 0 && this.sceneReady && this.physics) {
      const playersToAdd = [...this.pendingPlayers];
      this.pendingPlayers = [];
      playersToAdd.forEach(playerData => {
        this.addOtherPlayer(playerData);
      });
    }

    // 게임 페이즈가 playing일 때만 이동 가능
    if (this.gamePhase === 'playing') {
      this.handleMovement();
    }

    // 이름 텍스트 위치 업데이트
    const nameText = this.player.getData('nameText') as Phaser.GameObjects.Text;
    if (nameText) {
      nameText.setPosition(this.player.x, this.player.y - 40);
    }

    // 위치 전송
    this.sendPositionUpdate();

    // 다른 플레이어 이름 텍스트 업데이트
    this.otherPlayers.forEach((sprite) => {
      const text = sprite.getData('nameText') as Phaser.GameObjects.Text;
      if (text) {
        text.setPosition(sprite.x, sprite.y - 40);
      }
    });

    // 근처 플레이어/시체 체크 (마피아 킬, 리포트용)
    this.checkNearbyObjects();
    
    // 킬 쿨다운 업데이트
    if (this.killCooldown > 0) {
      this.killCooldown -= this.game.loop.delta / 1000;
    }
    
    // 버튼 활성화 상태 업데이트
    this.updateButtonStates();
  }

  private handleMovement() {
    const speed = 200;
    let velocityX = 0;
    let velocityY = 0;

    if (this.cursors.left.isDown || this.wasd.A.isDown) {
      velocityX = -speed;
    } else if (this.cursors.right.isDown || this.wasd.D.isDown) {
      velocityX = speed;
    }

    if (this.cursors.up.isDown || this.wasd.W.isDown) {
      velocityY = -speed;
    } else if (this.cursors.down.isDown || this.wasd.S.isDown) {
      velocityY = speed;
    }

    // 대각선 이동 시 속도 정규화
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }
    this.player.setVelocity(velocityX, velocityY);
  }

  private sendPositionUpdate() {
    const distance = Phaser.Math.Distance.Between(
      this.lastPosition.x,
      this.lastPosition.y,
      this.player.x,
      this.player.y
    );

    if (distance > 2) {
      const roundedX = Math.round(this.player.x);
      const roundedY = Math.round(this.player.y);
      
      this.socket.emit('playerMove', {
        x: roundedX,
        y: roundedY
      });
      this.lastPosition = { x: roundedX, y: roundedY };
    }
  }

  private checkNearbyObjects() {
    const KILL_RANGE = 100;
    const REPORT_RANGE = 80;

    // 근처 플레이어 체크 (마피아 킬용)
    this.nearbyPlayer = null;
    if (this.myRole === 'mafia' && this.isAlive && this.gamePhase === 'playing') {
      this.otherPlayers.forEach((sprite, playerId) => {
        if (sprite.getData('isAlive') !== false) {
          const distance = Phaser.Math.Distance.Between(
            this.player.x, this.player.y,
            sprite.x, sprite.y
          );
          if (distance < KILL_RANGE) {
            this.nearbyPlayer = playerId;
          }
        }
      });
    }

    // 근처 시체 체크 (리포트용)
    this.nearbyBody = null;
    if (this.isAlive && this.gamePhase === 'playing') {
      this.deadBodies.forEach((body, playerId) => {
        const distance = Phaser.Math.Distance.Between(
          this.player.x, this.player.y,
          body.x, body.y
        );
        if (distance < REPORT_RANGE) {
          this.nearbyBody = playerId;
        }
      });
    }
  }

  private updateButtonStates() {
    // 킬 버튼 (마피아 전용)
    if (this.killButton) {
      const canKill = this.myRole === 'mafia' && 
                      this.nearbyPlayer !== null && 
                      this.killCooldown <= 0 &&
                      this.gamePhase === 'playing';
      this.killButton.setAlpha(canKill ? 1 : 0.5);
      this.killButton.setData('enabled', canKill);
    }

    // 리포트 버튼
    if (this.reportButton) {
      const canReport = this.nearbyBody !== null && this.gamePhase === 'playing';
      this.reportButton.setAlpha(canReport ? 1 : 0.5);
      this.reportButton.setData('enabled', canReport);
    }

    // 긴급 회의 버튼
    if (this.meetingButton) {
      const canMeet = this.gamePhase === 'playing' && this.isAlive;
      this.meetingButton.setAlpha(canMeet ? 1 : 0.5);
      this.meetingButton.setData('enabled', canMeet);
    }
  }

  private createGameUI() {
    // UI를 카메라에 고정
    const uiContainer = this.add.container(0, 0);
    uiContainer.setScrollFactor(0);
    uiContainer.setDepth(1000);

    // 역할 표시
    this.roleText = this.add.text(20, 20, '역할: 대기중...', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 5 }
    });
    this.roleText.setScrollFactor(0);
    this.roleText.setDepth(1000);

    // 게임 페이즈 표시
    this.phaseText = this.add.text(20, 55, '페이즈: 플레이', {
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

  private createActionButtons() {
    const buttonY = this.cameras.main.height - 80;
    const buttonSpacing = 120;
    const startX = this.cameras.main.width / 2 - buttonSpacing * 1.5;

    // 킬 버튼 (마피아 전용)
    this.killButton = this.createButton(startX, buttonY, '🔪 킬', 0xff4444, () => {
      if (this.killButton.getData('enabled') && this.nearbyPlayer) {
        this.socket.emit('mafiaKill', this.nearbyPlayer);
        this.killCooldown = 30; // 30초 쿨다운
      }
    });
    this.killButton.setVisible(false); // 마피아만 보임

    // 리포트 버튼
    this.reportButton = this.createButton(startX + buttonSpacing, buttonY, '💀 리포트', 0xffa500, () => {
      if (this.reportButton.getData('enabled') && this.nearbyBody) {
        this.socket.emit('reportBody', this.nearbyBody);
      }
    });

    // 긴급 회의 버튼
    this.meetingButton = this.createButton(startX + buttonSpacing * 2, buttonY, '🚨 회의', 0xff6600, () => {
      if (this.meetingButton.getData('enabled')) {
        this.socket.emit('callEmergencyMeeting');
      }
    });

    // 특수 능력 버튼 (경찰/의사용)
    this.specialActionButton = this.createButton(startX + buttonSpacing * 3, buttonY, '⭐ 능력', 0x9966ff, () => {
      this.handleSpecialAction();
    });
    this.specialActionButton.setVisible(false); // 경찰/의사만 보임
  }

  private createButton(x: number, y: number, text: string, color: number, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setScrollFactor(0);
    container.setDepth(1001);

    const bg = this.add.graphics();
    bg.fillStyle(color, 0.8);
    bg.fillRoundedRect(-50, -25, 100, 50, 10);
    bg.lineStyle(2, 0xffffff, 0.5);
    bg.strokeRoundedRect(-50, -25, 100, 50, 10);

    const label = this.add.text(0, 0, text, {
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

  private handleSpecialAction() {
    if (!this.nearbyPlayer) {
      this.showMessage('주변에 플레이어가 없습니다.');
      return;
    }

    if (this.myRole === 'police') {
      this.socket.emit('policeInvestigate', this.nearbyPlayer);
    } else if (this.myRole === 'doctor') {
      this.socket.emit('doctorProtect', this.nearbyPlayer);
    }
  }

  // 스페이스바 액션 - 역할별 능력 사용
  private handleSpacebarAction() {
    if (!this.isAlive || this.gamePhase !== 'playing') {
      return;
    }

    // 역할별 능력 처리
    switch (this.myRole) {
      case 'mafia':
        // 마피아: 근처 플레이어 킬
        if (this.nearbyPlayer && this.killCooldown <= 0) {
          this.socket.emit('mafiaKill', this.nearbyPlayer);
          this.killCooldown = 30; // 30초 쿨다운
          this.showMessage('🔪 킬 시도 중...', 2000);
        } else if (this.killCooldown > 0) {
          this.showMessage(`⏳ 쿨다운: ${Math.ceil(this.killCooldown)}초`, 1500);
        } else {
          this.showMessage('주변에 킬할 수 있는 플레이어가 없습니다.', 2000);
        }
        break;

      case 'police':
        // 경찰: 근처 플레이어 조사
        if (this.nearbyPlayer) {
          this.socket.emit('policeInvestigate', this.nearbyPlayer);
          this.showMessage('🔍 조사 중...', 2000);
        } else {
          this.showMessage('주변에 조사할 플레이어가 없습니다.', 2000);
        }
        break;

      case 'doctor':
        // 의사: 근처 플레이어 보호
        if (this.nearbyPlayer) {
          this.socket.emit('doctorProtect', this.nearbyPlayer);
          this.showMessage('💉 보호 설정...', 2000);
        } else {
          this.showMessage('주변에 보호할 플레이어가 없습니다.', 2000);
        }
        break;

      case 'citizen':
        // 시민: 특별 능력 없음
        this.showMessage('시민은 특수 능력이 없습니다.', 2000);
        break;
    }
  }

  private showMessage(text: string, duration: number = 3000) {
    const message = this.add.text(
      this.cameras.main.width / 2,
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

    this.time.delayedCall(duration, () => {
      message.destroy();
    });
  }

  private createCampusMap() {
    const graphics = this.add.graphics();
    
    // 맵 크기 확장
    this.physics.world.setBounds(0, 0, 2000, 1500);
    
    // 메인 잔디밭 (캠퍼스 중앙)
    graphics.fillStyle(0x2d5a2d, 1);
    graphics.fillRect(0, 0, 2000, 1500);
    
    // 도로
    graphics.fillStyle(0x4a4a5a, 1);
    // 가로 도로
    graphics.fillRect(0, 700, 2000, 100);
    // 세로 도로
    graphics.fillRect(950, 0, 100, 1500);
    
    // 도로 중앙선
    graphics.fillStyle(0xffff00, 1);
    graphics.fillRect(0, 745, 2000, 10);
    graphics.fillRect(995, 0, 10, 1500);

    // 건물들 생성
    this.createBuildings(graphics);
    
    // 나무 및 장식물
    this.createDecorations();
  }

  private createBuildings(graphics: Phaser.GameObjects.Graphics) {
    // 건물 스타일
    const buildings = [
      // 좌상단 - 본관
      { x: 100, y: 100, w: 350, h: 250, color: 0x8b4513, name: '본관' },
      // 우상단 - 도서관
      { x: 1150, y: 100, w: 300, h: 200, color: 0x6b8e23, name: '도서관' },
      // 좌하단 - 학생회관
      { x: 100, y: 850, w: 300, h: 250, color: 0x4682b4, name: '학생회관' },
      // 우하단 - 체육관
      { x: 1200, y: 900, w: 350, h: 280, color: 0xcd5c5c, name: '체육관' },
      // 중앙상단 - 강의동 A
      { x: 550, y: 150, w: 200, h: 180, color: 0x708090, name: '강의동 A' },
      // 중앙하단 - 강의동 B
      { x: 550, y: 900, w: 200, h: 180, color: 0x708090, name: '강의동 B' },
      // 우측 - 연구동
      { x: 1550, y: 400, w: 200, h: 250, color: 0x9370db, name: '연구동' },
      // 좌측 - 기숙사
      { x: 100, y: 450, w: 180, h: 200, color: 0xda70d6, name: '기숙사' },
    ];

    buildings.forEach(b => {
      // 건물 그림자
      graphics.fillStyle(0x000000, 0.3);
      graphics.fillRect(b.x + 10, b.y + 10, b.w, b.h);
      
      // 건물 본체
      graphics.fillStyle(b.color, 1);
      graphics.fillRect(b.x, b.y, b.w, b.h);
      
      // 건물 테두리
      graphics.lineStyle(3, 0x1a1a2a, 1);
      graphics.strokeRect(b.x, b.y, b.w, b.h);
      
      // 지붕
      graphics.fillStyle(b.color - 0x222222, 1);
      graphics.fillRect(b.x, b.y, b.w, 30);
      
      // 창문들
      graphics.fillStyle(0x87ceeb, 0.8);
      const windowRows = Math.floor((b.h - 60) / 50);
      const windowCols = Math.floor(b.w / 60);
      for (let r = 0; r < windowRows; r++) {
        for (let c = 0; c < windowCols; c++) {
          graphics.fillRect(b.x + 20 + c * 60, b.y + 50 + r * 50, 30, 30);
        }
      }
      
      // 문
      graphics.fillStyle(0x3d2314, 1);
      graphics.fillRect(b.x + b.w / 2 - 20, b.y + b.h - 50, 40, 50);
      
      // 건물 이름 표시
      this.add.text(b.x + b.w / 2, b.y - 15, b.name, {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 5, y: 2 }
      }).setOrigin(0.5);
    });

    // 건물 충돌 영역 설정 (간단한 사각형)
    buildings.forEach(b => {
      const wall = this.add.rectangle(b.x + b.w/2, b.y + b.h/2, b.w, b.h);
      this.physics.add.existing(wall, true);
      if (this.player) {
        this.physics.add.collider(this.player, wall);
      }
    });
  }

  private createDecorations() {
    // 나무들
    const treePositions = [
      { x: 480, y: 400 }, { x: 520, y: 550 },
      { x: 1100, y: 350 }, { x: 1130, y: 550 },
      { x: 850, y: 200 }, { x: 880, y: 350 },
      { x: 450, y: 1100 }, { x: 550, y: 1200 },
      { x: 1400, y: 150 }, { x: 1700, y: 750 },
    ];

    treePositions.forEach(pos => {
      this.createTree(pos.x, pos.y);
    });

    // 벤치들
    const benchPositions = [
      { x: 800, y: 600 }, { x: 1200, y: 600 },
      { x: 500, y: 700 }, { x: 1500, y: 1100 },
    ];

    benchPositions.forEach(pos => {
      this.createBench(pos.x, pos.y);
    });

    // 분수대 (중앙)
    this.createFountain(1000, 400);
  }

  private createTree(x: number, y: number) {
    const graphics = this.add.graphics();
    
    // 나무 그림자
    graphics.fillStyle(0x000000, 0.3);
    graphics.fillEllipse(x + 5, y + 30, 60, 20);
    
    // 나무 줄기
    graphics.fillStyle(0x8b4513, 1);
    graphics.fillRect(x - 8, y - 30, 16, 60);
    
    // 나뭇잎
    graphics.fillStyle(0x228b22, 1);
    graphics.fillCircle(x, y - 50, 35);
    graphics.fillCircle(x - 20, y - 35, 25);
    graphics.fillCircle(x + 20, y - 35, 25);
  }

  private createBench(x: number, y: number) {
    const graphics = this.add.graphics();
    
    // 벤치
    graphics.fillStyle(0x8b4513, 1);
    graphics.fillRect(x - 30, y - 5, 60, 10);
    graphics.fillStyle(0x654321, 1);
    graphics.fillRect(x - 25, y + 5, 10, 15);
    graphics.fillRect(x + 15, y + 5, 10, 15);
  }

  private createFountain(x: number, y: number) {
    const graphics = this.add.graphics();
    
    // 분수대 베이스
    graphics.fillStyle(0x808080, 1);
    graphics.fillCircle(x, y, 50);
    graphics.fillStyle(0x6495ed, 0.8);
    graphics.fillCircle(x, y, 40);
    
    // 중앙 기둥
    graphics.fillStyle(0xa0a0a0, 1);
    graphics.fillRect(x - 10, y - 40, 20, 40);
    
    // 물 효과 (간단한 원)
    graphics.fillStyle(0x87ceeb, 0.6);
    graphics.fillCircle(x, y - 45, 15);
    
    // 분수대 이름
    this.add.text(x, y + 60, '중앙 분수대', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#00000066',
      padding: { x: 3, y: 2 }
    }).setOrigin(0.5);
  }

  private setupSocketListeners() {
    // 역할 배정 받기
    this.socket.on('roleAssigned', (data: RoleInfo) => {
      this.myRole = data.role;
      this.roleText.setText(`역할: ${data.roleName}`);
      this.roleText.setBackgroundColor(this.getRoleBackgroundColor(data.role));
      
      // 역할에 따른 UI 업데이트
      if (data.role === 'mafia') {
        this.killButton.setVisible(true);
        this.showMessage(`당신은 마피아입니다!\n${data.roleDescription}`, 5000);
      } else if (data.role === 'police' || data.role === 'doctor') {
        this.specialActionButton.setVisible(true);
        const actionLabel = data.role === 'police' ? '🔍 조사' : '💉 치료';
        (this.specialActionButton.list[1] as Phaser.GameObjects.Text).setText(actionLabel);
        this.showMessage(`당신은 ${data.roleName}입니다!\n${data.roleDescription}`, 5000);
      } else {
        this.showMessage(`당신은 시민입니다!\n${data.roleDescription}`, 5000);
      }
    });

    // 마피아 팀원 정보
    this.socket.on('mafiaTeam', (data: { teammates: { id: string; nickname: string }[] }) => {
      this.mafiaTeammates = data.teammates;
      if (data.teammates.length > 0) {
        const names = data.teammates.map(t => t.nickname).join(', ');
        this.showMessage(`동료 마피아: ${names}`, 4000);
      }
      
      // 마피아 팀원을 다른 색으로 표시
      data.teammates.forEach(teammate => {
        const sprite = this.otherPlayers.get(teammate.id);
        if (sprite) {
          sprite.setTint(0xff6666);
        }
      });
    });

    // 플레이어 킬됨
    this.socket.on('playerKilled', (data: { killerId: string; victimId: string; victimName: string }) => {
      if (data.victimId === this.socket.id) {
        this.isAlive = false;
        this.player.setTint(0x666666);
        this.showMessage('당신이 죽었습니다!', 5000);
      }
      
      // 다른 플레이어가 죽은 경우 표시
      const victim = this.otherPlayers.get(data.victimId);
      if (victim) {
        victim.setTint(0x666666);
        victim.setData('isAlive', false);
      }
    });

    // 시체 생성
    this.socket.on('deadBodySpawned', (data: DeadBody) => {
      this.createDeadBody(data);
    });

    // 회의 시작
    this.socket.on('meetingStarted', (data: MeetingInfo) => {
      this.gamePhase = 'meeting';
      this.phaseText.setText(`페이즈: 회의 (${data.timer}초)`);
      this.player.setVelocity(0, 0);
      
      const meetingType = data.type === 'emergency' ? '긴급 회의' : '시체 발견';
      this.showMessage(`${data.callerName}님이 ${meetingType}를 소집했습니다!`, 3000);
      
      // 회의 화면으로 전환 (여기서는 간단히 메시지만)
      this.showMeetingUI(data);
    });

    // 투표 시작
    this.socket.on('votingStarted', (data: { phase: string; timer: number; alivePlayers: MafiaPlayerState[] }) => {
      this.gamePhase = 'voting';
      this.phaseText.setText(`페이즈: 투표 (${data.timer}초)`);
      this.showVotingUI(data.alivePlayers);
    });

    // 타이머 업데이트
    this.socket.on('timerUpdate', (data: { phase: string; timeLeft: number }) => {
      this.phaseText.setText(`페이즈: ${data.phase === 'meeting' ? '회의' : '투표'} (${data.timeLeft}초)`);
    });

    // 투표 결과
    this.socket.on('votingResult', (data: { ejected: string | null; ejectedName: string | null; ejectedRole: Role | null; tie: boolean; voteDetails: any[] }) => {
      this.gamePhase = 'result';
      
      if (data.tie) {
        this.showMessage('동점! 아무도 추방되지 않았습니다.', 4000);
      } else if (data.ejected) {
        this.showMessage(`${data.ejectedName}님이 추방되었습니다.\n역할: ${this.getRoleName(data.ejectedRole!)}`, 4000);
        
        // 추방된 플레이어 처리
        const ejectedSprite = this.otherPlayers.get(data.ejected);
        if (ejectedSprite) {
          ejectedSprite.setVisible(false);
        }
        if (data.ejected === this.socket.id) {
          this.isAlive = false;
          this.player.setVisible(false);
        }
      } else {
        this.showMessage('스킵! 아무도 추방되지 않았습니다.', 4000);
      }
      
      // 투표 UI 숨기기
      this.hideVotingUI();
    });

    // 페이즈 변경
    this.socket.on('phaseChanged', (data: { phase: GamePhase; roundNumber: number }) => {
      this.gamePhase = data.phase;
      this.phaseText.setText(`페이즈: 플레이 (라운드 ${data.roundNumber})`);
      
      // 회의 관련 UI 숨기기
      this.hideMeetingUI();
      this.hideVotingUI();
      
      // 시체 제거
      this.deadBodies.forEach((body) => {
        body.destroy();
      });
      this.deadBodies.clear();
    });

    // 게임 종료
    this.socket.on('gameEnded', (data: { winner: string; winnerName: string; players: MafiaPlayerState[] }) => {
      this.gamePhase = 'ended';
      this.showGameEndScreen(data);
    });

    // 경찰 조사 결과
    this.socket.on('investigationResult', (data: { targetName: string; isMafia: boolean; message: string }) => {
      // 조사 결과에 따른 메시지 표시
      this.showMessage(data.message, 4000);
    });

    // 의사 보호 설정
    this.socket.on('protectionSet', (data: { targetName: string; message: string }) => {
      this.showMessage(data.message, 3000);
    });

    // 다른 플레이어 관련 이벤트 (기존 코드 유지)
    this.socket.on('otherPlayerJoined', (data: PlayerData) => {
      console.log('다른 플레이어 참가:', data.nickname, data.id);
      if (this.sceneReady) {
        this.addOtherPlayer(data);
      } else {
        this.pendingPlayers.push(data);
      }
    });

    this.socket.on('otherPlayerMoved', (data: { id: string; x: number; y: number }) => {
      // 보간 시스템에 스냅샷 추가
      this.interpolation.addSnapshot(data.id, data.x, data.y);
      
      const otherPlayer = this.otherPlayers.get(data.id);
      if (otherPlayer) {
        // 보간된 위치 가져오기
        const interpolatedPos = this.interpolation.getInterpolatedPosition(data.id);
        if (interpolatedPos) {
          this.tweens.add({
            targets: otherPlayer,
            x: interpolatedPos.x,
            y: interpolatedPos.y,
            duration: 50,  // 부드러운 보간을 위해 약간 늘림
            ease: 'Linear'
          });
        } else {
          // 보간 실패 시 직접 이동
          this.tweens.add({
            targets: otherPlayer,
            x: data.x,
            y: data.y,
            duration: 30,
            ease: 'Linear'
          });
        }
      }
    });

    this.socket.on('playerLeftGame', (playerId: string) => {
      const otherPlayer = this.otherPlayers.get(playerId);
      if (otherPlayer) {
        const nameText = otherPlayer.getData('nameText') as Phaser.GameObjects.Text;
        if (nameText) nameText.destroy();
        otherPlayer.destroy();
        this.otherPlayers.delete(playerId);
      }
    });

    this.socket.on('currentPlayers', (players: PlayerData[]) => {
      players.forEach((playerData) => {
        if (playerData.id !== this.socket.id) {
          if (this.sceneReady) {
            this.addOtherPlayer(playerData);
          } else {
            this.pendingPlayers.push(playerData);
          }
        }
      });
    });
  }

  private createDeadBody(data: DeadBody) {
    const container = this.add.container(data.x, data.y);
    
    // 시체 그래픽
    const bodyGraphics = this.add.graphics();
    bodyGraphics.fillStyle(0x8b0000, 1);
    bodyGraphics.fillEllipse(0, 0, 40, 25);
    
    // X 표시
    const xMark = this.add.text(0, 0, '💀', {
      fontSize: '24px'
    });
    xMark.setOrigin(0.5);
    
    // 이름
    const nameText = this.add.text(0, -30, data.nickname, {
      fontSize: '12px',
      color: '#ff4444',
      backgroundColor: '#000000aa',
      padding: { x: 3, y: 2 }
    });
    nameText.setOrigin(0.5);
    
    container.add([bodyGraphics, xMark, nameText]);
    container.setDepth(50);
    
    this.deadBodies.set(data.playerId, container);
  }

  private showMeetingUI(data: MeetingInfo) {
    // 회의 배경
    const meetingBg = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      600, 400,
      0x000000, 0.9
    );
    meetingBg.setScrollFactor(0);
    meetingBg.setDepth(1500);
    meetingBg.setData('meetingUI', true);

    // 회의 제목
    const title = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 150,
      data.type === 'emergency' ? '🚨 긴급 회의' : '💀 시체 발견',
      { fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }
    );
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(1501);
    title.setData('meetingUI', true);

    // 소집자 정보
    const callerInfo = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 100,
      `${data.callerName}님이 소집`,
      { fontSize: '20px', color: '#cccccc' }
    );
    callerInfo.setOrigin(0.5);
    callerInfo.setScrollFactor(0);
    callerInfo.setDepth(1501);
    callerInfo.setData('meetingUI', true);

    if (data.type === 'report' && data.bodyName) {
      const bodyInfo = this.add.text(
        this.cameras.main.width / 2,
        this.cameras.main.height / 2 - 70,
        `발견된 시체: ${data.bodyName}`,
        { fontSize: '18px', color: '#ff6666' }
      );
      bodyInfo.setOrigin(0.5);
      bodyInfo.setScrollFactor(0);
      bodyInfo.setDepth(1501);
      bodyInfo.setData('meetingUI', true);
    }
  }

  private hideMeetingUI() {
    this.children.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData && child.getData('meetingUI')) {
        child.destroy();
      }
    });
  }

  private showVotingUI(alivePlayers: MafiaPlayerState[]) {
    // 투표 배경
    const votingBg = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      700, 500,
      0x1a1a2e, 0.95
    );
    votingBg.setScrollFactor(0);
    votingBg.setDepth(1500);
    votingBg.setData('votingUI', true);

    // 투표 제목
    const title = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 200,
      '🗳️ 투표',
      { fontSize: '28px', color: '#ffffff', fontStyle: 'bold' }
    );
    title.setOrigin(0.5);
    title.setScrollFactor(0);
    title.setDepth(1501);
    title.setData('votingUI', true);

    // 플레이어 버튼들
    const startY = this.cameras.main.height / 2 - 120;
    const cols = 3;
    const buttonWidth = 180;
    const buttonHeight = 50;
    const paddingX = 20;
    const paddingY = 15;

    alivePlayers.forEach((player, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = this.cameras.main.width / 2 - (cols - 1) * (buttonWidth + paddingX) / 2 + col * (buttonWidth + paddingX);
      const y = startY + row * (buttonHeight + paddingY);

      const button = this.add.container(x, y);
      button.setScrollFactor(0);
      button.setDepth(1502);
      button.setData('votingUI', true);

      const bg = this.add.graphics();
      const isMe = player.id === this.socket.id;
      bg.fillStyle(isMe ? 0x4a90d9 : 0x3a3a5a, 1);
      bg.fillRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);
      bg.lineStyle(2, 0x6b6b8a, 1);
      bg.strokeRoundedRect(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight, 8);

      const label = this.add.text(0, 0, player.nickname, {
        fontSize: '16px',
        color: '#ffffff'
      });
      label.setOrigin(0.5);

      button.add([bg, label]);

      if (!isMe && this.isAlive) {
        button.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth/2, -buttonHeight/2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);
        button.on('pointerdown', () => {
          this.socket.emit('vote', player.id);
          this.showMessage(`${player.nickname}에게 투표했습니다.`, 2000);
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
    const skipButton = this.add.container(this.cameras.main.width / 2, skipY);
    skipButton.setScrollFactor(0);
    skipButton.setDepth(1502);
    skipButton.setData('votingUI', true);

    const skipBg = this.add.graphics();
    skipBg.fillStyle(0x666666, 1);
    skipBg.fillRoundedRect(-80, -25, 160, 50, 10);
    skipBg.lineStyle(2, 0x888888, 1);
    skipBg.strokeRoundedRect(-80, -25, 160, 50, 10);

    const skipLabel = this.add.text(0, 0, '⏭️ 스킵', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    skipLabel.setOrigin(0.5);

    skipButton.add([skipBg, skipLabel]);

    if (this.isAlive) {
      skipButton.setInteractive(new Phaser.Geom.Rectangle(-80, -25, 160, 50), Phaser.Geom.Rectangle.Contains);
      skipButton.on('pointerdown', () => {
        this.socket.emit('vote', 'skip');
        this.showMessage('투표를 스킵했습니다.', 2000);
      });
    }
  }

  private hideVotingUI() {
    this.children.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData && child.getData('votingUI')) {
        child.destroy();
      }
    });
  }

  private showGameEndScreen(data: { winner: string; winnerName: string; players: MafiaPlayerState[] }) {
    // 전체 화면 오버레이
    const overlay = this.add.rectangle(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      this.cameras.main.width,
      this.cameras.main.height,
      data.winner === 'mafia' ? 0x330000 : 0x003300,
      0.9
    );
    overlay.setScrollFactor(0);
    overlay.setDepth(2000);

    // 승리 팀 표시
    const winnerText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 100,
      `🎉 ${data.winnerName} 승리! 🎉`,
      { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }
    );
    winnerText.setOrigin(0.5);
    winnerText.setScrollFactor(0);
    winnerText.setDepth(2001);

    // 플레이어 역할 공개
    const playerList = data.players.map(p => 
      `${p.nickname}: ${this.getRoleName(p.role)} ${p.isAlive ? '✓' : '✗'}`
    ).join('\n');

    const rolesText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 50,
      playerList,
      { fontSize: '18px', color: '#cccccc', align: 'center' }
    );
    rolesText.setOrigin(0.5);
    rolesText.setScrollFactor(0);
    rolesText.setDepth(2001);
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

  private getRoleName(role: Role): string {
    const names: { [key in Role]: string } = {
      citizen: '시민',
      mafia: '마피아',
      police: '경찰',
      doctor: '의사'
    };
    return names[role] || '알 수 없음';
  }

  private getCharacterSpriteKey(color: string): string {
    const colorMap: { [key: string]: string } = {
      '#ff0000': 'character_red',
      '#ff0f00': 'character_red',
      '#0000ff': 'character_blue',
      '#00d4ff': 'character_blue',
      '#00ff00': 'character_green',
      '#1f00d0': 'character_blue',
      '#ffff00': 'character_yellow',
      '#ff88d0': 'character_red',
    };

    const result = colorMap[color.toLowerCase()];
    if (result) return result;

    if (color.includes('ff') && color.indexOf('ff') < 3) {
      return 'character_red';
    } else if (color.includes('00') && (color.includes('ff') || color.includes('d4'))) {
      return 'character_blue';
    } else if (color.includes('ff00')) {
      return 'character_yellow';
    }
    
    return 'character_green';
  }

  private addOtherPlayer(data: PlayerData) {
    if (this.otherPlayers.has(data.id)) {
      return;
    }

    if (!this.scene || !this.physics || !this.add || !this.textures) {
      if (!this.pendingPlayers.some(p => p.id === data.id)) {
        this.pendingPlayers.push(data);
      }
      return;
    }

    try {
      const spriteKey = this.getCharacterSpriteKey(data.color);
      
      const otherPlayer = this.physics.add.sprite(data.x, data.y, spriteKey);
      otherPlayer.setScale(0.5);
      otherPlayer.setDisplaySize(48, 48);
      otherPlayer.setData('isAlive', true);

      const nameText = this.add.text(data.x, data.y - 40, data.nickname, {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 5, y: 2 }
      });
      nameText.setOrigin(0.5);
      otherPlayer.setData('nameText', nameText);

      this.otherPlayers.set(data.id, otherPlayer);
      
      // 마피아 팀원이면 표시
      if (this.mafiaTeammates.some(t => t.id === data.id)) {
        otherPlayer.setTint(0xff6666);
      }
    } catch (error) {
      console.error('플레이어 추가 실패:', data.nickname, error);
      if (!this.pendingPlayers.some(p => p.id === data.id)) {
        this.pendingPlayers.push(data);
      }
    }
  }

  private getRandomColor(): string {
    const colors = [
      '#ff0000', '#0000ff', '#00ff00', '#ffff00',
      '#ff00ff', '#00ffff', '#ff8800', '#8800ff'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  shutdown() {
    this.socket.off('roleAssigned');
    this.socket.off('mafiaTeam');
    this.socket.off('playerKilled');
    this.socket.off('deadBodySpawned');
    this.socket.off('meetingStarted');
    this.socket.off('votingStarted');
    this.socket.off('timerUpdate');
    this.socket.off('votingResult');
    this.socket.off('phaseChanged');
    this.socket.off('gameEnded');
    this.socket.off('investigationResult');
    this.socket.off('protectionSet');
    this.socket.off('otherPlayerJoined');
    this.socket.off('otherPlayerMoved');
    this.socket.off('playerLeftGame');
    this.socket.off('currentPlayers');
  }
}
