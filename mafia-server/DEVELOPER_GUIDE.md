# 🎯 Mafia Server - 개발자 가이드

## 📚 코드 탐색 가이드

### 새로운 기능을 추가하고 싶을 때

#### 1. 새로운 역할 추가하기
**위치**: `src/domain/services/RoleService.ts`

```typescript
// 1. types/GameTypes.ts에 역할 추가
export type Role = 'citizen' | 'mafia' | 'police' | 'doctor' | 'detective'; // 추가

// 2. RoleService.ts에서 역할 정보 추가
getRoleName(role: Role): string {
  const names: Record<Role, string> = {
    // ...
    'detective': '탐정'  // 추가
  };
  return names[role];
}
```

#### 2. 새로운 게임 액션 추가하기
**위치**: `src/domain/services/GameActionService.ts`

```typescript
// 새로운 액션 메서드 추가
detectiveInvestigate(roomId: string, detectiveId: string, targetId: string): InvestigationResult {
  // 구현
}
```

#### 3. 새로운 소켓 이벤트 추가하기

**단계 1**: 이벤트 핸들러에 메서드 추가  
**위치**: `src/events/handlers/GameEventHandler.ts`

```typescript
handleDetectiveInvestigate(socket: Socket, targetId: string): void {
  // 구현
}
```

**단계 2**: 이벤트 라우터에 등록  
**위치**: `src/events/EventRouter.ts`

```typescript
socket.on('detectiveInvestigate', (targetId) => {
  this.gameEventHandler.handleDetectiveInvestigate(socket, targetId);
});
```

### 버그를 찾고 수정할 때

#### 문제 위치 찾기 가이드

1. **방 생성/참가 문제**
   - `src/domain/services/RoomService.ts`
   - `src/events/handlers/RoomEventHandler.ts`

2. **게임 로직 문제**
   - `src/domain/services/GameService.ts`
   - `src/domain/services/GameActionService.ts`

3. **역할 배정 문제**
   - `src/domain/services/RoleService.ts`

4. **회의/투표 문제**
   - `src/events/handlers/MeetingEventHandler.ts`

5. **플레이어 이동/채팅 문제**
   - `src/events/handlers/PlayerEventHandler.ts`

6. **소켓 연결 문제**
   - `src/core/SocketManager.ts`
   - `src/events/EventRouter.ts`

## 🔍 주요 클래스 설명

### 1. RoomService
**책임**: 방 생성, 참가, 나가기 등 방 관리

```typescript
// 방 생성
const room = roomService.createRoom("Game Room", player, 10);

// 방 참가
const result = roomService.joinRoom(roomId, player);

// 준비 토글
const result = roomService.toggleReady(socketId);
```

### 2. GameService
**책임**: 게임 초기화, 회의, 투표 등 게임 흐름 관리

```typescript
// 게임 초기화
const game = gameService.initializeGame(roomId, players, gameStates);

// 긴급 회의 시작
const success = gameService.startEmergencyMeeting(roomId, callerId);

// 투표
const success = gameService.castVote(roomId, voterId, targetId);
```

### 3. GameActionService
**책임**: 마피아 킬, 경찰 조사, 의사 보호 등 게임 액션

```typescript
// 마피아 킬
const result = gameActionService.mafiaKill(roomId, mafiaId, targetId);

// 경찰 조사
const result = gameActionService.policeInvestigate(roomId, policeId, targetId);

// 게임 종료 체크
const result = gameActionService.checkGameEnd(roomId);
```

### 4. RoleService
**책임**: 역할 배정 및 역할 정보 제공

```typescript
// 역할 배정
const roles = roleService.assignRoles(players);

// 마피아 플레이어 목록
const mafias = roleService.getMafiaPlayers(gameState.players);

// 역할 이름
const name = roleService.getRoleName('mafia'); // '마피아'
```

## 🧪 테스트 작성 가이드

### Service 테스트 예시

```typescript
// tests/RoomService.test.ts
describe('RoomService', () => {
  let roomService: RoomService;
  let roomRepo: InMemoryRoomRepository;
  let playerSessionRepo: InMemoryPlayerSessionRepository;

  beforeEach(() => {
    roomRepo = new InMemoryRoomRepository();
    playerSessionRepo = new InMemoryPlayerSessionRepository();
    roomService = new RoomService(roomRepo, playerSessionRepo);
  });

  it('should create a room', () => {
    const player = { id: '1', nickname: 'Test', university: 'Test Univ', isReady: false };
    const room = roomService.createRoom('Test Room', player, 10);
    
    expect(room.name).toBe('Test Room');
    expect(room.maxPlayers).toBe(10);
    expect(room.players).toHaveLength(1);
  });
});
```

## 🔧 의존성 주입 이해하기

`index.ts`에서 모든 컴포넌트를 조립합니다:

```typescript
// 1. Repositories 생성
const roomRepository = new InMemoryRoomRepository();

// 2. Services 생성 (Repository 주입)
const roomService = new RoomService(roomRepository, playerSessionRepository);

// 3. Event Handlers 생성 (Service 주입)
const roomEventHandler = new RoomEventHandler(io, roomService, playerSessionRepository);

// 4. Event Router 생성 (Handler 주입)
const eventRouter = new EventRouter(roomEventHandler, ...);
```

이렇게 하면:
- 테스트 시 Mock 객체를 쉽게 주입 가능
- 구현체 교체가 용이 (예: InMemoryRepository → PostgreSQLRepository)
- 각 컴포넌트가 독립적으로 개발 가능

## 🌟 베스트 프랙티스

### 1. 새로운 기능 추가 시

```
1. types/ 에 필요한 타입 정의
2. entities/ 에 엔티티 생성 (필요한 경우)
3. services/ 에 비즈니스 로직 추가
4. handlers/ 에 이벤트 처리 추가
5. EventRouter에 이벤트 등록
6. index.ts에 의존성 주입
```

### 2. 코드 작성 시 주의사항

- **단일 책임**: 하나의 클래스는 하나의 일만
- **명확한 네이밍**: 메서드 이름이 하는 일을 명확히 표현
- **작은 함수**: 함수는 가능한 짧게 (20줄 이하 권장)
- **주석**: 왜(Why)를 설명, 무엇(What)은 코드로 표현
- **타입 안전성**: any 타입 사용 최소화

### 3. 에러 처리

```typescript
// 명확한 에러 메시지
if (!player) {
  socket.emit('error', { message: '사용자 정보를 찾을 수 없습니다.' });
  return;
}

// 조기 반환(Early Return) 사용
if (!roomId) return;
if (!game) return;
```

## 📖 읽어볼 자료

1. **Clean Architecture** - Robert C. Martin
2. **SOLID 원칙** - 객체지향 설계의 5대 원칙
3. **Repository Pattern** - 데이터 접근 추상화
4. **Dependency Injection** - 의존성 관리
5. **TypeScript Best Practices** - 타입 시스템 활용

## 🤝 기여하기

1. 새로운 기능을 추가할 때는 관련 서비스를 찾아서 추가
2. 여러 서비스에 걸친 기능은 새로운 서비스 생성 고려
3. 테스트를 작성하여 기능 검증
4. README 업데이트

---

궁금한 점이 있으면 코드 내 주석을 참고하거나, 각 클래스의 JSDoc을 확인하세요!
