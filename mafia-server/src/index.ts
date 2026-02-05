// src/index.ts
// 엔트리 포인트 - 의존성 주입 및 애플리케이션 시작

import { Server } from './core/Server';
import { SocketManager } from './core/SocketManager';

// Repositories
import { InMemoryRoomRepository } from './domain/repositories/RoomRepository';
import { InMemoryGameRepository } from './domain/repositories/GameRepository';
import { InMemoryPlayerSessionRepository } from './domain/repositories/PlayerSessionRepository';

// Services
import { RoleService } from './domain/services/RoleService';
import { RoomService } from './domain/services/RoomService';
import { GameService } from './domain/services/GameService';
import { GameActionService } from './domain/services/GameActionService';

// Event Handlers
import { RoomEventHandler } from './events/handlers/RoomEventHandler';
import { GameEventHandler } from './events/handlers/GameEventHandler';
import { MeetingEventHandler } from './events/handlers/MeetingEventHandler';
import { PlayerEventHandler } from './events/handlers/PlayerEventHandler';
import { EventRouter } from './events/EventRouter';

/**
 * 애플리케이션 부트스트랩
 * DIP (Dependency Inversion Principle): 의존성 주입을 통한 느슨한 결합
 */
function bootstrap() {
  // 1. 서버 초기화
  const server = new Server();
  server.registerRoutes();

  // 2. Repositories 생성 (데이터 저장소)
  const roomRepository = new InMemoryRoomRepository();
  const gameRepository = new InMemoryGameRepository();
  const playerSessionRepository = new InMemoryPlayerSessionRepository();

  // 3. Services 생성 (비즈니스 로직)
  const roleService = new RoleService();
  const roomService = new RoomService(roomRepository, playerSessionRepository);
  const gameService = new GameService(gameRepository, roleService);
  const gameActionService = new GameActionService(gameRepository);

  // 4. Event Handlers 생성 (이벤트 처리)
  const roomEventHandler = new RoomEventHandler(
    server.io,
    roomService,
    playerSessionRepository
  );

  const gameEventHandler = new GameEventHandler(
    server.io,
    gameService,
    gameActionService,
    roleService,
    roomService
  );

  const meetingEventHandler = new MeetingEventHandler(
    server.io,
    gameService,
    gameActionService,
    roomService
  );

  const playerEventHandler = new PlayerEventHandler(
    server.io,
    roomService,
    gameService,
    playerSessionRepository
  );

  // 5. Event Router 생성 (이벤트 라우팅)
  const eventRouter = new EventRouter(
    roomEventHandler,
    gameEventHandler,
    meetingEventHandler,
    playerEventHandler
  );

  // 6. Socket Manager 초기화 (소켓 연결 관리)
  const socketManager = new SocketManager(server.io, eventRouter);
  socketManager.initialize();

  // 7. 서버 시작
  const PORT = process.env.PORT || 8000;
  server.start(PORT);

  console.log('✅ 마피아 서버가 성공적으로 시작되었습니다!');
  console.log('📦 아키텍처: Clean Architecture + DDD + SOLID');
}

// 애플리케이션 시작
bootstrap();
