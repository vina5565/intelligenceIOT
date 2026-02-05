// src/events/EventRouter.ts
// 소켓 이벤트 라우팅 - 모든 이벤트 핸들러를 연결

import { Socket, Server } from 'socket.io';
import { RoomEventHandler } from './handlers/RoomEventHandler';
import { GameEventHandler } from './handlers/GameEventHandler';
import { MeetingEventHandler } from './handlers/MeetingEventHandler';
import { PlayerEventHandler } from './handlers/PlayerEventHandler';

/**
 * 이벤트 라우터
 * SRP: 소켓 이벤트를 적절한 핸들러로 라우팅하는 역할만 담당
 */
export class EventRouter {
  constructor(
    private roomEventHandler: RoomEventHandler,
    private gameEventHandler: GameEventHandler,
    private meetingEventHandler: MeetingEventHandler,
    private playerEventHandler: PlayerEventHandler
  ) {}

  /**
   * 소켓에 이벤트 리스너를 등록합니다
   */
  registerSocketEvents(socket: Socket): void {
    // === 방 관련 이벤트 ===
    socket.on('register', (userData) => {
      this.roomEventHandler.handleRegister(socket, userData);
    });

    socket.on('getRooms', () => {
      this.roomEventHandler.handleGetRooms(socket);
    });

    socket.on('createRoom', (data) => {
      this.roomEventHandler.handleCreateRoom(socket, data);
    });

    socket.on('joinRoom', (roomId) => {
      this.roomEventHandler.handleJoinRoom(socket, roomId);
    });

    socket.on('leaveRoom', () => {
      this.roomEventHandler.handleLeaveRoom(socket);
    });

    socket.on('toggleReady', () => {
      this.roomEventHandler.handleToggleReady(socket);
    });

    // === 게임 관련 이벤트 ===
    socket.on('startGame', () => {
      this.gameEventHandler.handleStartGame(socket);
    });

    socket.on('mafiaKill', (targetId) => {
      this.gameEventHandler.handleMafiaKill(socket, targetId);
    });

    socket.on('policeInvestigate', (targetId) => {
      this.gameEventHandler.handlePoliceInvestigate(socket, targetId);
    });

    socket.on('doctorProtect', (targetId) => {
      this.gameEventHandler.handleDoctorProtect(socket, targetId);
    });

    socket.on('getGameState', () => {
      this.gameEventHandler.handleGetGameState(socket);
    });

    // === 회의 및 투표 이벤트 ===
    socket.on('callEmergencyMeeting', () => {
      this.meetingEventHandler.handleCallEmergencyMeeting(socket);
    });

    socket.on('reportBody', (bodyId) => {
      this.meetingEventHandler.handleReportBody(socket, bodyId);
    });

    socket.on('vote', (targetId) => {
      this.meetingEventHandler.handleVote(socket, targetId);
    });

    // === 플레이어 이벤트 ===
    socket.on('playerJoinedGame', (data) => {
      this.playerEventHandler.handlePlayerJoinedGame(socket, data);
    });

    socket.on('playerMove', (data) => {
      this.playerEventHandler.handlePlayerMove(socket, data);
    });

    socket.on('playerLeftGame', () => {
      this.playerEventHandler.handlePlayerLeftGame(socket);
    });

    socket.on('move', (data) => {
      this.playerEventHandler.handleMove(socket, data);
    });

    // === 채팅 이벤트 ===
    socket.on('lobbyChatMessage', (message) => {
      this.playerEventHandler.handleLobbyChatMessage(socket, message);
    });

    socket.on('roomChatMessage', (message) => {
      this.playerEventHandler.handleRoomChatMessage(socket, message);
    });

    socket.on('gameChatMessage', (message) => {
      this.playerEventHandler.handleGameChatMessage(socket, message);
    });

    // === 연결 해제 ===
    socket.on('disconnect', () => {
      this.roomEventHandler.handleDisconnect(socket);
    });
  }
}
