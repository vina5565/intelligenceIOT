// src/roomManager.ts
// 방 관리 시스템 - 메모리 기반 저장

export interface Player {
  id: string;          // socket.id
  nickname: string;
  university: string;
  userId?: string;     // Supabase user ID
  isReady: boolean;
}

export interface PlayerGameState {
  id: string;
  x: number;
  y: number;
  color: string;
  nickname: string;
}

export interface Room {
  id: string;
  name: string;
  host: string;        // socket.id of host
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'in-game' | 'finished';
  createdAt: Date;
  gameStates?: Map<string, PlayerGameState>; // 게임 중 플레이어 상태
}

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRoomMap: Map<string, string> = new Map(); // socketId -> roomId

  // 방 생성
  createRoom(roomName: string, host: Player, maxPlayers: number = 10): Room {
    const roomId = this.generateRoomId();
    
    const newRoom: Room = {
      id: roomId,
      name: roomName,
      host: host.id,
      players: [{ ...host, isReady: true }], // 방장은 자동 준비 완료
      maxPlayers,
      status: 'waiting',
      createdAt: new Date()
    };

    this.rooms.set(roomId, newRoom);
    this.playerRoomMap.set(host.id, roomId);
    
    return newRoom;
  }

  // 방 참가
  joinRoom(roomId: string, player: Player): { success: boolean; room?: Room; error?: string } {
    const room = this.rooms.get(roomId);

    if (!room) {
      return { success: false, error: '방을 찾을 수 없습니다.' };
    }

    if (room.status !== 'waiting') {
      return { success: false, error: '게임이 이미 시작되었습니다.' };
    }

    if (room.players.length >= room.maxPlayers) {
      return { success: false, error: '방이 가득 찼습니다.' };
    }

    // 이미 방에 있는지 확인
    if (room.players.some(p => p.id === player.id)) {
      return { success: false, error: '이미 방에 참가했습니다.' };
    }

    room.players.push({ ...player, isReady: false });
    this.playerRoomMap.set(player.id, roomId);

    return { success: true, room };
  }

  // 방 나가기
  leaveRoom(socketId: string): { roomId?: string; room?: Room; wasHost: boolean } {
    const roomId = this.playerRoomMap.get(socketId);
    
    if (!roomId) {
      return { wasHost: false };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.playerRoomMap.delete(socketId);
      return { wasHost: false };
    }

    const wasHost = room.host === socketId;
    
    // 플레이어 제거
    room.players = room.players.filter(p => p.id !== socketId);
    this.playerRoomMap.delete(socketId);

    // 방이 비었으면 삭제
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return { roomId, wasHost };
    }

    // 방장이 나갔으면 새 방장 지정
    if (wasHost && room.players.length > 0) {
      room.host = room.players[0].id;
      room.players[0].isReady = true;
    }

    return { roomId, room, wasHost };
  }

  // 플레이어 준비 상태 토글
  toggleReady(socketId: string): { success: boolean; room?: Room; error?: string } {
    const roomId = this.playerRoomMap.get(socketId);
    
    if (!roomId) {
      return { success: false, error: '방에 참가하지 않았습니다.' };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: '방을 찾을 수 없습니다.' };
    }

    const player = room.players.find(p => p.id === socketId);
    if (!player) {
      return { success: false, error: '플레이어를 찾을 수 없습니다.' };
    }

    // 방장은 항상 준비 완료 상태
    if (room.host === socketId) {
      return { success: true, room };
    }

    player.isReady = !player.isReady;
    return { success: true, room };
  }

  // 게임 시작 (모든 플레이어가 준비되었는지 확인)
  startGame(socketId: string): { success: boolean; room?: Room; error?: string } {
    const roomId = this.playerRoomMap.get(socketId);
    
    if (!roomId) {
      return { success: false, error: '방에 참가하지 않았습니다.' };
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: '방을 찾을 수 없습니다.' };
    }

    // 방장만 게임 시작 가능
    if (room.host !== socketId) {
      return { success: false, error: '방장만 게임을 시작할 수 있습니다.' };
    }

    // 최소 인원 체크 (테스트: 2명, 실제 게임: 4명)
    if (room.players.length < 2) {
      return { success: false, error: '최소 2명 이상이어야 게임을 시작할 수 있습니다.' };
    }

    // 모든 플레이어가 준비되었는지 확인
    const allReady = room.players.every(p => p.isReady);
    if (!allReady) {
      return { success: false, error: '모든 플레이어가 준비되어야 합니다.' };
    }

    room.status = 'in-game';
    return { success: true, room };
  }

  // 모든 방 목록 가져오기
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  // 특정 방 정보 가져오기
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  // 플레이어가 속한 방 ID 가져오기
  getPlayerRoom(socketId: string): string | undefined {
    return this.playerRoomMap.get(socketId);
  }

  // 플레이어 게임 상태 업데이트
  updatePlayerGameState(socketId: string, gameState: Partial<PlayerGameState>): boolean {
    const roomId = this.playerRoomMap.get(socketId);
    if (!roomId) return false;

    const room = this.rooms.get(roomId);
    if (!room) return false;

    if (!room.gameStates) {
      room.gameStates = new Map();
    }

    const currentState = room.gameStates.get(socketId);
    if (currentState) {
      room.gameStates.set(socketId, { ...currentState, ...gameState });
    } else {
      const player = room.players.find(p => p.id === socketId);
      if (!player) return false;
      
      room.gameStates.set(socketId, {
        id: socketId,
        x: gameState.x || 400,
        y: gameState.y || 300,
        color: gameState.color || '#00d4ff',
        nickname: player.nickname,
        ...gameState
      });
    }

    return true;
  }

  // 방의 모든 플레이어 게임 상태 가져오기
  getPlayerGameStates(roomId: string): PlayerGameState[] {
    const room = this.rooms.get(roomId);
    if (!room || !room.gameStates) return [];
    
    return Array.from(room.gameStates.values());
  }

  // 방 ID 생성 (간단한 랜덤 ID)
  private generateRoomId(): string {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// 싱글톤 인스턴스 export
export const roomManager = new RoomManager();

