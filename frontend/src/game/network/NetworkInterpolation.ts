// src/game/NetworkInterpolation.ts
// 네트워크 보간 및 예측을 위한 유틸리티

interface PositionSnapshot {
  x: number;
  y: number;
  timestamp: number;
}

interface PlayerInterpolationState {
  snapshots: PositionSnapshot[];
  currentX: number;
  currentY: number;
  velocityX: number;
  velocityY: number;
}

export class NetworkInterpolation {
  private states: Map<string, PlayerInterpolationState> = new Map();
  
  // 서버 업데이트 주기 (ms) - 향후 사용 예정
  private readonly _SERVER_UPDATE_RATE = 50;
  
  // 보간 지연 (ms) - 스냅샷 2개 사이를 보간하기 위한 버퍼
  private readonly INTERPOLATION_DELAY = 100;
  
  // 최대 스냅샷 저장 개수
  private readonly MAX_SNAPSHOTS = 20;
  
  // 플레이어 상태 초기화
  initPlayer(playerId: string, x: number, y: number): void {
    this.states.set(playerId, {
      snapshots: [{
        x,
        y,
        timestamp: Date.now()
      }],
      currentX: x,
      currentY: y,
      velocityX: 0,
      velocityY: 0
    });
  }
  
  // 새 위치 데이터 수신
  addSnapshot(playerId: string, x: number, y: number): void {
    let state = this.states.get(playerId);
    
    if (!state) {
      this.initPlayer(playerId, x, y);
      return;
    }
    
    const now = Date.now();
    const lastSnapshot = state.snapshots[state.snapshots.length - 1];
    
    // 속도 계산 (예측용)
    if (lastSnapshot) {
      const dt = (now - lastSnapshot.timestamp) / 1000;
      if (dt > 0) {
        state.velocityX = (x - lastSnapshot.x) / dt;
        state.velocityY = (y - lastSnapshot.y) / dt;
      }
    }
    
    // 새 스냅샷 추가
    state.snapshots.push({
      x,
      y,
      timestamp: now
    });
    
    // 오래된 스냅샷 제거
    while (state.snapshots.length > this.MAX_SNAPSHOTS) {
      state.snapshots.shift();
    }
  }
  
  // 현재 보간된 위치 계산
  getInterpolatedPosition(playerId: string): { x: number; y: number } | null {
    const state = this.states.get(playerId);
    if (!state || state.snapshots.length < 1) {
      return null;
    }
    
    // 보간 시점 계산 (현재 시간에서 지연 시간을 뺀 시점)
    const renderTime = Date.now() - this.INTERPOLATION_DELAY;
    
    // 보간할 두 스냅샷 찾기
    let before: PositionSnapshot | null = null;
    let after: PositionSnapshot | null = null;
    
    for (let i = 0; i < state.snapshots.length; i++) {
      if (state.snapshots[i].timestamp <= renderTime) {
        before = state.snapshots[i];
      } else {
        after = state.snapshots[i];
        break;
      }
    }
    
    // 두 스냅샷 사이를 선형 보간
    if (before && after) {
      const total = after.timestamp - before.timestamp;
      const elapsed = renderTime - before.timestamp;
      const t = Math.min(1, Math.max(0, elapsed / total));
      
      return {
        x: before.x + (after.x - before.x) * t,
        y: before.y + (after.y - before.y) * t
      };
    }
    
    // 스냅샷이 하나만 있거나 렌더 시간이 범위를 벗어난 경우
    if (before) {
      // 외삽 (예측) - 마지막 스냅샷에서 속도를 기반으로 예측
      const dt = (Date.now() - before.timestamp) / 1000;
      if (dt < 0.5) { // 0.5초 이내만 예측
        return {
          x: before.x + state.velocityX * dt * 0.5, // 예측 강도 조절
          y: before.y + state.velocityY * dt * 0.5
        };
      }
      return { x: before.x, y: before.y };
    }
    
    if (after) {
      return { x: after.x, y: after.y };
    }
    
    return { x: state.currentX, y: state.currentY };
  }
  
  // 플레이어 제거
  removePlayer(playerId: string): void {
    this.states.delete(playerId);
  }
  
  // 모든 플레이어 제거
  clear(): void {
    this.states.clear();
  }
}

// 클라이언트 측 예측을 위한 입력 버퍼
export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  timestamp: number;
  sequenceNumber: number;
}

export class ClientPrediction {
  private pendingInputs: InputState[] = [];
  private sequenceNumber: number = 0;
  
  // 서버에서 확인되지 않은 입력 수
  get pendingCount(): number {
    return this.pendingInputs.length;
  }
  
  // 새 입력 기록
  recordInput(up: boolean, down: boolean, left: boolean, right: boolean): InputState {
    const input: InputState = {
      up,
      down,
      left,
      right,
      timestamp: Date.now(),
      sequenceNumber: this.sequenceNumber++
    };
    
    this.pendingInputs.push(input);
    
    // 오래된 입력 정리 (1초 이상 된 것)
    const cutoff = Date.now() - 1000;
    this.pendingInputs = this.pendingInputs.filter(i => i.timestamp > cutoff);
    
    return input;
  }
  
  // 서버 응답 후 확인된 입력 제거
  acknowledgeInput(serverSequence: number): void {
    this.pendingInputs = this.pendingInputs.filter(
      input => input.sequenceNumber > serverSequence
    );
  }
  
  // 서버 위치에서 확인되지 않은 입력을 다시 적용 (재조정)
  reconcile(
    serverX: number, 
    serverY: number, 
    speed: number
  ): { x: number; y: number } {
    let x = serverX;
    let y = serverY;
    
    // 확인되지 않은 각 입력을 다시 적용
    for (const input of this.pendingInputs) {
      const dt = 1 / 60; // 프레임 시간 가정
      
      let vx = 0;
      let vy = 0;
      
      if (input.left) vx -= speed;
      if (input.right) vx += speed;
      if (input.up) vy -= speed;
      if (input.down) vy += speed;
      
      // 대각선 정규화
      if (vx !== 0 && vy !== 0) {
        vx *= 0.707;
        vy *= 0.707;
      }
      
      x += vx * dt;
      y += vy * dt;
    }
    
    return { x, y };
  }
  
  // 모든 입력 초기화
  clear(): void {
    this.pendingInputs = [];
    this.sequenceNumber = 0;
  }
}
