// src/core/SocketManager.ts
// Socket.IO 연결 관리 클래스

import { Server as SocketServer } from 'socket.io';
import { EventRouter } from '../events/EventRouter';

/**
 * 소켓 연결 관리 클래스
 * SRP: Socket.IO 연결 및 이벤트 라우팅만 담당
 */
export class SocketManager {
  constructor(
    private io: SocketServer,
    private eventRouter: EventRouter
  ) {}

  /**
   * Socket.IO 연결 이벤트를 초기화합니다
   */
  initialize(): void {
    this.io.on('connection', (socket) => {
      console.log('새로운 유저 접속:', socket.id);

      // 이벤트 라우터에 소켓 등록
      this.eventRouter.registerSocketEvents(socket);
    });
  }
}
