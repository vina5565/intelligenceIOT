// src/game/DeadBodyManager.ts
// 시체 관리 클래스

import Phaser from 'phaser';

export interface DeadBodyConfig {
  scene: Phaser.Scene;
  onBodyCreated?: (playerId: string, body: Phaser.GameObjects.Container) => void;
}

export class DeadBodyManager {
  private scene: Phaser.Scene;
  private deadBodies: Map<string, Phaser.GameObjects.Container> = new Map();
  private onBodyCreated?: (playerId: string, body: Phaser.GameObjects.Container) => void;

  constructor(config: DeadBodyConfig) {
    this.scene = config.scene;
    this.onBodyCreated = config.onBodyCreated;
  }

  // 시체 생성
  createDeadBody(playerId: string, x: number, y: number, nickname: string): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    
    // 시체 표시 (빨간 원)
    const body = this.scene.add.circle(0, 0, 20, 0xff0000, 0.8);
    container.add(body);
    
    // 닉네임 표시
    const nameText = this.scene.add.text(0, -35, nickname, {
      fontSize: '12px',
      color: '#ff0000',
      backgroundColor: '#000000aa',
      padding: { x: 4, y: 2 }
    });
    nameText.setOrigin(0.5);
    container.add(nameText);
    
    // X 표시
    const xMark = this.scene.add.text(0, 0, '✖', {
      fontSize: '24px',
      color: '#ffffff'
    });
    xMark.setOrigin(0.5);
    container.add(xMark);
    
    this.deadBodies.set(playerId, container);
    
    if (this.onBodyCreated) {
      this.onBodyCreated(playerId, container);
    }
    
    return container;
  }

  // 근처 시체 찾기
  findNearbyBody(x: number, y: number, range: number): string | null {
    let nearestId: string | null = null;
    let nearestDistance = range;

    this.deadBodies.forEach((body, id) => {
      const distance = Phaser.Math.Distance.Between(x, y, body.x, body.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = id;
      }
    });

    return nearestId;
  }

  // 시체 가져오기
  getBody(playerId: string): Phaser.GameObjects.Container | undefined {
    return this.deadBodies.get(playerId);
  }

  // 모든 시체 제거
  clearAll() {
    this.deadBodies.forEach((body) => body.destroy());
    this.deadBodies.clear();
  }

  // 특정 시체 제거
  removeBody(playerId: string) {
    const body = this.deadBodies.get(playerId);
    if (body) {
      body.destroy();
      this.deadBodies.delete(playerId);
    }
  }

  // 시체 개수
  get count(): number {
    return this.deadBodies.size;
  }

  // 리소스 정리
  destroy() {
    this.clearAll();
  }
}
