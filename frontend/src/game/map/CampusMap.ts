// src/game/map/CampusMap.ts
// 대학교 캠퍼스 맵 생성 클래스

import Phaser from 'phaser';

interface Building {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  name: string;
}

export class CampusMap {
  private scene: Phaser.Scene;
  private buildings: Building[] = [];
  private walls: Phaser.GameObjects.Rectangle[] = [];
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  // 전체 맵 생성
  create(): void {
    const graphics = this.scene.add.graphics();
    
    // 맵 크기 설정
    this.scene.physics.world.setBounds(0, 0, 2000, 1500);
    
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

    // 건물 생성
    this.createBuildings(graphics);
    
    // 장식물 생성
    this.createDecorations();
  }
  
  // 건물들 생성
  private createBuildings(graphics: Phaser.GameObjects.Graphics): void {
    this.buildings = [
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

    this.buildings.forEach(b => {
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
      this.scene.add.text(b.x + b.w / 2, b.y - 15, b.name, {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 5, y: 2 }
      }).setOrigin(0.5);
    });

    // 건물 충돌 영역 생성
    this.buildings.forEach(b => {
      const wall = this.scene.add.rectangle(b.x + b.w/2, b.y + b.h/2, b.w, b.h);
      this.scene.physics.add.existing(wall, true);
      this.walls.push(wall);
    });
  }
  
  // 장식물 생성
  private createDecorations(): void {
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
  
  private createTree(x: number, y: number): void {
    const graphics = this.scene.add.graphics();
    
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
  
  private createBench(x: number, y: number): void {
    const graphics = this.scene.add.graphics();
    
    // 벤치
    graphics.fillStyle(0x8b4513, 1);
    graphics.fillRect(x - 30, y - 5, 60, 10);
    graphics.fillStyle(0x654321, 1);
    graphics.fillRect(x - 25, y + 5, 10, 15);
    graphics.fillRect(x + 15, y + 5, 10, 15);
  }
  
  private createFountain(x: number, y: number): void {
    const graphics = this.scene.add.graphics();
    
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
    this.scene.add.text(x, y + 60, '중앙 분수대', {
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#00000066',
      padding: { x: 3, y: 2 }
    }).setOrigin(0.5);
  }
  
  // 플레이어에 충돌 추가
  addColliderToPlayer(player: Phaser.Physics.Arcade.Sprite): void {
    this.walls.forEach(wall => {
      this.scene.physics.add.collider(player, wall);
    });
  }
  
  // 건물 목록 반환
  getBuildings(): Building[] {
    return this.buildings;
  }
}
