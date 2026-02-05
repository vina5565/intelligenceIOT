// src/game/player/OtherPlayersManager.ts
// 다른 플레이어들 관리 클래스

import Phaser from 'phaser';
import type { PlayerData } from '../types';
import { NetworkInterpolation } from '../network/NetworkInterpolation';

export class OtherPlayersManager {
  private scene: Phaser.Scene;
  private players: Map<string, Phaser.Physics.Arcade.Sprite> = new Map();
  private interpolation: NetworkInterpolation = new NetworkInterpolation();
  private pendingPlayers: PlayerData[] = [];
  private mafiaTeammates: string[] = [];
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  // 마피아 팀 설정
  setMafiaTeammates(teammates: { id: string; nickname: string }[]) {
    this.mafiaTeammates = teammates.map(t => t.id);
    
    // 이미 추가된 플레이어에게 표시
    this.mafiaTeammates.forEach(id => {
      const sprite = this.players.get(id);
      if (sprite) {
        sprite.setTint(0xff6666);
      }
    });
  }
  
  // 플레이어 추가
  addPlayer(data: PlayerData, sceneReady: boolean = true): boolean {
    if (this.players.has(data.id)) {
      return false;
    }

    if (!sceneReady || !this.scene || !this.scene.physics || !this.scene.add) {
      if (!this.pendingPlayers.some(p => p.id === data.id)) {
        this.pendingPlayers.push(data);
      }
      return false;
    }

    try {
      const spriteKey = this.getCharacterSpriteKey(data.color);
      
      const otherPlayer = this.scene.physics.add.sprite(data.x, data.y, spriteKey);
      otherPlayer.setScale(0.5);
      otherPlayer.setDisplaySize(48, 48);
      otherPlayer.setData('isAlive', true);

      const nameText = this.scene.add.text(data.x, data.y - 40, data.nickname, {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 5, y: 2 }
      });
      nameText.setOrigin(0.5);
      otherPlayer.setData('nameText', nameText);

      this.players.set(data.id, otherPlayer);
      
      // 마피아 팀원이면 표시
      if (this.mafiaTeammates.includes(data.id)) {
        otherPlayer.setTint(0xff6666);
      }
      
      return true;
    } catch (error) {
      console.error('플레이어 추가 실패:', data.nickname, error);
      if (!this.pendingPlayers.some(p => p.id === data.id)) {
        this.pendingPlayers.push(data);
      }
      return false;
    }
  }
  
  // 대기 중인 플레이어들 처리
  processPendingPlayers(): number {
    if (this.pendingPlayers.length === 0) return 0;
    
    const playersToAdd = [...this.pendingPlayers];
    this.pendingPlayers = [];
    let addedCount = 0;
    
    playersToAdd.forEach(playerData => {
      if (this.addPlayer(playerData, true)) {
        addedCount++;
      }
    });
    
    return addedCount;
  }
  
  // 플레이어 이동 업데이트
  updatePlayerPosition(id: string, x: number, y: number) {
    // 보간 시스템에 스냅샷 추가
    this.interpolation.addSnapshot(id, x, y);
    
    const sprite = this.players.get(id);
    if (sprite) {
      // 보간된 위치 가져오기
      const interpolatedPos = this.interpolation.getInterpolatedPosition(id);
      if (interpolatedPos) {
        this.scene.tweens.add({
          targets: sprite,
          x: interpolatedPos.x,
          y: interpolatedPos.y,
          duration: 50,
          ease: 'Linear'
        });
      } else {
        this.scene.tweens.add({
          targets: sprite,
          x: x,
          y: y,
          duration: 30,
          ease: 'Linear'
        });
      }
    }
  }
  
  // 플레이어 제거
  removePlayer(id: string) {
    const sprite = this.players.get(id);
    if (sprite) {
      const nameText = sprite.getData('nameText') as Phaser.GameObjects.Text;
      if (nameText) nameText.destroy();
      sprite.destroy();
      this.players.delete(id);
    }
  }
  
  // 플레이어 죽음 처리
  killPlayer(id: string) {
    const sprite = this.players.get(id);
    if (sprite) {
      sprite.setTint(0x666666);
      sprite.setData('isAlive', false);
    }
  }
  
  // 플레이어 추방 처리 (숨기기)
  ejectPlayer(id: string) {
    const sprite = this.players.get(id);
    if (sprite) {
      sprite.setVisible(false);
      const nameText = sprite.getData('nameText') as Phaser.GameObjects.Text;
      if (nameText) nameText.setVisible(false);
    }
  }
  
  // 이름 텍스트 위치 업데이트
  updateNamePositions() {
    this.players.forEach((sprite) => {
      const text = sprite.getData('nameText') as Phaser.GameObjects.Text;
      if (text) {
        text.setPosition(sprite.x, sprite.y - 40);
      }
    });
  }
  
  // 근처 플레이어 찾기
  findNearbyPlayer(playerX: number, playerY: number, range: number): string | null {
    let nearbyId: string | null = null;
    
    this.players.forEach((sprite, playerId) => {
      if (sprite.getData('isAlive') !== false) {
        const distance = Phaser.Math.Distance.Between(
          playerX, playerY,
          sprite.x, sprite.y
        );
        if (distance < range) {
          nearbyId = playerId;
        }
      }
    });
    
    return nearbyId;
  }
  
  // 플레이어 맵 가져오기
  getPlayers(): Map<string, Phaser.Physics.Arcade.Sprite> {
    return this.players;
  }
  
  // 스프라이트 키 결정
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
  
  // 리소스 정리
  destroy() {
    this.players.forEach((sprite) => {
      const nameText = sprite.getData('nameText') as Phaser.GameObjects.Text;
      if (nameText) nameText.destroy();
      sprite.destroy();
    });
    this.players.clear();
    this.pendingPlayers = [];
  }
}
