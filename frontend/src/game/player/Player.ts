// src/game/player/Player.ts
// 메인 플레이어 클래스

import Phaser from 'phaser';
import type { Socket } from 'socket.io-client';
import type { Role, GamePhase } from '../types';

export interface PlayerConfig {
  scene: Phaser.Scene;
  socket: Socket;
  x: number;
  y: number;
  nickname: string;
  color: string;
  spriteKey: string;
  onSpacebarPress?: () => void;
}

export class Player {
  private scene: Phaser.Scene;
  private socket: Socket;
  private sprite: Phaser.Physics.Arcade.Sprite;
  private nameText: Phaser.GameObjects.Text;
  private _nickname: string;
  private color: string;
  private lastPosition = { x: 0, y: 0 };
  
  // 입력 관리
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  
  // 게임 상태
  private _role: Role = 'citizen';
  private _isAlive: boolean = true;
  private _gamePhase: GamePhase = 'playing';
  
  constructor(config: PlayerConfig) {
    this.scene = config.scene;
    this.socket = config.socket;
    this._nickname = config.nickname;
    this.color = config.color;
    
    // 스프라이트 생성
    this.sprite = this.scene.physics.add.sprite(config.x, config.y, config.spriteKey);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setScale(0.5);
    this.sprite.setDisplaySize(48, 48);
    
    // 이름 텍스트 생성
    this.nameText = this.scene.add.text(0, -40, this._nickname, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 5, y: 2 }
    });
    this.nameText.setOrigin(0.5);
    this.sprite.setData('nameText', this.nameText);
    
    // 입력 설정
    this.setupInput(config.onSpacebarPress);
  }
  
  private setupInput(onSpacebarPress?: () => void) {
    this.cursors = this.scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    
    if (onSpacebarPress) {
      const spaceKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      spaceKey.on('down', onSpacebarPress);
    }
  }
  
  // Getters
  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get nickname(): string { return this._nickname; }
  get role(): Role { return this._role; }
  get isAlive(): boolean { return this._isAlive; }
  get gamePhase(): GamePhase { return this._gamePhase; }
  get phaserSprite(): Phaser.Physics.Arcade.Sprite { return this.sprite; }
  
  // Setters
  set role(value: Role) { this._role = value; }
  set isAlive(value: boolean) {
    this._isAlive = value;
    if (!value) {
      this.sprite.setTint(0x666666);
    }
  }
  set gamePhase(value: GamePhase) { this._gamePhase = value; }
  
  // 이동 처리 (내부 입력 사용)
  update() {
    if (!this._isAlive || this._gamePhase !== 'playing') {
      this.sprite.setVelocity(0, 0);
      return;
    }
    
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
    
    this.sprite.setVelocity(velocityX, velocityY);
  }
  
  // 이전 버전 호환용 (deprecated)
  handleMovement(cursors: Phaser.Types.Input.Keyboard.CursorKeys, wasd: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  }) {
    if (!this._isAlive) return;
    if (this._gamePhase !== 'playing') {
      this.sprite.setVelocity(0, 0);
      return;
    }
    
    const speed = 200;
    let velocityX = 0;
    let velocityY = 0;

    if (cursors.left.isDown || wasd.A.isDown) {
      velocityX = -speed;
    } else if (cursors.right.isDown || wasd.D.isDown) {
      velocityX = speed;
    }

    if (cursors.up.isDown || wasd.W.isDown) {
      velocityY = -speed;
    } else if (cursors.down.isDown || wasd.S.isDown) {
      velocityY = speed;
    }

    // 대각선 이동 시 속도 정규화
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707;
      velocityY *= 0.707;
    }
    
    this.sprite.setVelocity(velocityX, velocityY);
  }
  
  // 위치 업데이트 전송
  sendPositionUpdate(): boolean {
    const distance = Phaser.Math.Distance.Between(
      this.lastPosition.x,
      this.lastPosition.y,
      this.sprite.x,
      this.sprite.y
    );

    if (distance > 2) {
      const roundedX = Math.round(this.sprite.x);
      const roundedY = Math.round(this.sprite.y);
      
      this.socket.emit('playerMove', {
        x: roundedX,
        y: roundedY
      });
      this.lastPosition = { x: roundedX, y: roundedY };
      return true;
    }
    return false;
  }
  
  // 이름 텍스트 위치 업데이트
  updateNamePosition() {
    this.nameText.setPosition(this.sprite.x, this.sprite.y - 40);
  }
  
  // 플레이어 숨기기
  hide() {
    this.sprite.setVisible(false);
    this.nameText.setVisible(false);
  }
  
  // 리소스 정리
  destroy() {
    this.nameText.destroy();
    this.sprite.destroy();
  }
}
