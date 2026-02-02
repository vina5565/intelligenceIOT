//src/index.ts

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { roomManager, Player } from './roomManager';
import {
  GameState,
  initializeGameState,
  startEmergencyMeeting,
  startReportMeeting,
  startVotingPhase,
  castVote,
  calculateVoteResult,
  ejectPlayer,
  mafiaKill,
  doctorProtect,
  policeInvestigate,
  checkGameEnd,
  returnToPlayPhase,
  serializeGameState,
  MafiaPlayerState
} from './gameLogic';

// 게임 상태 저장 (roomId -> GameState)
const gameStates = new Map<string, GameState>();

// 회의/투표 타이머 관리
const meetingTimers = new Map<string, NodeJS.Timeout>();
const votingTimers = new Map<string, NodeJS.Timeout>();

// 환경 변수 로드
dotenv.config();

const app = express();
const httpServer = createServer(app);

// 1. CORS 설정 (프런트엔드 접속 허용)
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// 2. Supabase 연결 (환경 변수 사용)
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 3. Socket.IO 설정 (실시간 게임용)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 사용자 세션 저장 (socketId -> 사용자 정보)
const userSessions = new Map<string, Player>();

// [API] 유저 입장 (기존 Python의 /api/join 로직)
app.post('/api/join', async (req, res) => {
  const { nickname, university } = req.body;

  const { data, error } = await supabase
    .from('user-login')
    .insert([{ nickname, university }])
    .select();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.json({ message: "입장 성공!", data });
});

// [API] 서버 상태 확인
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: roomManager.getAllRooms().length,
    timestamp: new Date().toISOString()
  });
});

// [Socket] 실시간 통신 연결
io.on('connection', (socket) => {
  console.log('새로운 유저 접속:', socket.id);

  // 사용자 정보 등록
  socket.on('register', (userData: { nickname: string; university: string; userId?: string }) => {
    const player: Player = {
      id: socket.id,
      nickname: userData.nickname,
      university: userData.university,
      userId: userData.userId,
      isReady: false
    };
    
    userSessions.set(socket.id, player);
    console.log(`사용자 등록: ${userData.nickname} (${socket.id})`);
    
    // 현재 방 목록 전송
    socket.emit('roomListUpdate', roomManager.getAllRooms());
  });

  // 방 목록 요청
  socket.on('getRooms', () => {
    socket.emit('roomListUpdate', roomManager.getAllRooms());
  });

  // 방 생성
  socket.on('createRoom', (data: { roomName: string; maxPlayers: number }) => {
    const player = userSessions.get(socket.id);
    
    if (!player) {
      socket.emit('error', { message: '사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.' });
      return;
    }

    try {
      const newRoom = roomManager.createRoom(data.roomName, player, data.maxPlayers);
      
      // 방을 만든 사람을 Socket.IO room에 join
      socket.join(newRoom.id);
      
      // 방을 만든 사람에게 방 정보 전송
      socket.emit('joinedRoom', newRoom);
      
      // 모든 사용자에게 방 목록 업데이트
      io.emit('roomListUpdate', roomManager.getAllRooms());
      
      console.log('방 생성:', data.roomName, 'by', player.nickname);
    } catch (error) {
      socket.emit('error', { message: '방 생성에 실패했습니다.' });
    }
  });

  // 방 참가
  socket.on('joinRoom', (roomId: string) => {
    const player = userSessions.get(socket.id);
    
    if (!player) {
      socket.emit('error', { message: '사용자 정보를 찾을 수 없습니다.' });
      return;
    }

    const result = roomManager.joinRoom(roomId, player);
    
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }

    // 소켓 룸에 참가
    socket.join(roomId);
    
    // 참가자에게 방 정보 전송
    socket.emit('roomJoined', result.room);
    
    // 같은 방의 모든 사용자에게 업데이트 알림
    io.to(roomId).emit('roomUpdate', result.room);
    
    // 모든 사용자에게 방 목록 업데이트
    io.emit('roomListUpdate', roomManager.getAllRooms());
    
    console.log(`${player.nickname}이(가) 방 ${roomId}에 참가했습니다.`);
  });

  // 방 나가기
  socket.on('leaveRoom', () => {
    const result = roomManager.leaveRoom(socket.id);
    
    if (result.roomId) {
      socket.leave(result.roomId);
      
      // 방이 아직 존재하면 업데이트 전송
      if (result.room) {
        io.to(result.roomId).emit('roomUpdate', result.room);
      }
      
      // 모든 사용자에게 방 목록 업데이트
      io.emit('roomListUpdate', roomManager.getAllRooms());
      
      socket.emit('leftRoom');
      console.log(`사용자 ${socket.id}이(가) 방을 나갔습니다.`);
    }
  });

  // 준비 상태 토글
  socket.on('toggleReady', () => {
    const result = roomManager.toggleReady(socket.id);
    
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }

    const roomId = roomManager.getPlayerRoom(socket.id);
    if (roomId && result.room) {
      // 같은 방의 모든 사용자에게 업데이트
      io.to(roomId).emit('roomUpdate', result.room);
      io.emit('roomListUpdate', roomManager.getAllRooms());
    }
  });

  // 게임 시작
  socket.on('startGame', () => {
    const result = roomManager.startGame(socket.id);
    
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }

    const roomId = roomManager.getPlayerRoom(socket.id);
    if (roomId && result.room) {
      // 게임 시작 시 room의 gameStates 초기화
      if (!result.room.gameStates) {
        result.room.gameStates = new Map();
      }
      
      // 모든 플레이어를 Socket.IO room에 join (중요!)
      result.room.players.forEach((player) => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
          playerSocket.join(roomId);
          console.log(`플레이어 ${player.nickname}(${player.id})를 room ${roomId}에 join`);
        }
      });
      
      // 🎮 게임 상태 초기화 및 역할 배정
      const gameState = initializeGameState(
        roomId, 
        result.room.players, 
        result.room.gameStates
      );
      gameStates.set(roomId, gameState);
      
      // 각 플레이어에게 개별적으로 역할 전송 (본인 역할만 알 수 있음)
      result.room.players.forEach((player) => {
        const playerSocket = io.sockets.sockets.get(player.id);
        const playerState = gameState.players.get(player.id);
        
        if (playerSocket && playerState) {
          // 본인의 역할 정보만 전송
          playerSocket.emit('roleAssigned', {
            role: playerState.role,
            roleName: getRoleName(playerState.role),
            roleDescription: getRoleDescription(playerState.role)
          });
          
          console.log(`역할 배정: ${player.nickname} -> ${playerState.role}`);
        }
      });
      
      // 마피아들끼리는 서로를 알 수 있도록 정보 전송
      const mafiaPlayers: { id: string; nickname: string }[] = [];
      gameState.players.forEach((playerState, playerId) => {
        if (playerState.role === 'mafia') {
          mafiaPlayers.push({ id: playerId, nickname: playerState.nickname });
        }
      });
      
      mafiaPlayers.forEach(mafia => {
        const mafiaSocket = io.sockets.sockets.get(mafia.id);
        if (mafiaSocket) {
          mafiaSocket.emit('mafiaTeam', {
            teammates: mafiaPlayers.filter(m => m.id !== mafia.id)
          });
        }
      });
      
      // 방의 모든 플레이어에게 게임 시작 알림
      io.to(roomId).emit('gameStarted', {
        ...result.room,
        gamePhase: 'playing'
      });
      
      // 모든 사용자에게 방 목록 업데이트
      io.emit('roomListUpdate', roomManager.getAllRooms());
      
      console.log(`🎮 게임 시작: 방 ${roomId}, ${result.room.players.length}명 참가`);
    }
  });

  // 역할 이름 반환 헬퍼 함수
  function getRoleName(role: string): string {
    const names: { [key: string]: string } = {
      'citizen': '시민',
      'mafia': '마피아',
      'police': '경찰',
      'doctor': '의사'
    };
    return names[role] || '시민';
  }

  // 역할 설명 반환 헬퍼 함수
  function getRoleDescription(role: string): string {
    const descriptions: { [key: string]: string } = {
      'citizen': '마피아를 찾아서 추방하세요! 회의에서 올바른 선택을 내려야 합니다.',
      'mafia': '들키지 않게 시민들을 제거하세요. 다른 마피아와 협력하세요.',
      'police': '매 라운드 한 명을 조사하여 마피아인지 확인할 수 있습니다.',
      'doctor': '매 라운드 한 명을 보호하여 마피아의 공격으로부터 지킬 수 있습니다.'
    };
    return descriptions[role] || '';
  }

  // 캐릭터 이동 이벤트 (기존 기능 유지)
  socket.on('move', (data) => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (roomId) {
      // 같은 방의 다른 플레이어들에게만 전송
      socket.to(roomId).emit('playerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  // === 게임 관련 이벤트 ===
  
  // 플레이어가 게임에 참가
  socket.on('playerJoinedGame', (data: { x: number; y: number; nickname: string; color: string }) => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (roomId) {
      // 플레이어 게임 상태 저장
      roomManager.updatePlayerGameState(socket.id, {
        x: data.x,
        y: data.y,
        color: data.color,
        nickname: data.nickname
      });

      // 같은 방의 다른 플레이어들에게 알림
      socket.to(roomId).emit('otherPlayerJoined', {
        id: socket.id,
        x: data.x,
        y: data.y,
        nickname: data.nickname,
        color: data.color
      });

      // 현재 방에 있는 모든 플레이어의 게임 상태 전송
      const currentPlayers = roomManager.getPlayerGameStates(roomId)
        .filter(p => p.id !== socket.id); // 본인 제외
      
      socket.emit('currentPlayers', currentPlayers);
      
      console.log(`플레이어 ${data.nickname}(${socket.id})가 게임에 참가. 기존 플레이어 ${currentPlayers.length}명`);
    }
  });

  // 플레이어 이동 (게임 내) - 최적화: 스로틀링
  socket.on('playerMove', (data: { x: number; y: number }) => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (roomId) {
      // 플레이어 상태 업데이트
      roomManager.updatePlayerGameState(socket.id, { x: data.x, y: data.y });
      
      // 같은 방의 다른 플레이어들에게 전송
      socket.to(roomId).emit('otherPlayerMoved', {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  // 플레이어가 게임에서 나감
  socket.on('playerLeftGame', () => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (roomId) {
      socket.to(roomId).emit('playerLeftGame', socket.id);
    }
  });

  // === 마피아 게임 이벤트 ===

  // 🔪 마피아 킬
  socket.on('mafiaKill', (targetId: string) => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (!roomId) return;

    const gameState = gameStates.get(roomId);
    if (!gameState || gameState.phase !== 'playing') {
      socket.emit('error', { message: '킬은 플레이 단계에서만 가능합니다.' });
      return;
    }

    const result = mafiaKill(gameState, socket.id, targetId);
    
    if (result.success) {
      // 킬 성공 - 모든 플레이어에게 알림
      io.to(roomId).emit('playerKilled', {
        killerId: socket.id,
        victimId: targetId,
        victimName: gameState.players.get(targetId)?.nickname
      });
      
      // 시체 위치 정보 전송
      const victim = gameState.players.get(targetId);
      if (victim) {
        io.to(roomId).emit('deadBodySpawned', {
          playerId: targetId,
          x: victim.x,
          y: victim.y,
          nickname: victim.nickname
        });
      }
      
      // 게임 종료 체크
      const endResult = checkGameEnd(gameState);
      if (endResult.ended) {
        io.to(roomId).emit('gameEnded', {
          winner: endResult.winner,
          winnerName: endResult.winner === 'mafia' ? '마피아' : '시민',
          players: Array.from(gameState.players.values())
        });
        gameStates.delete(roomId);
      }
    } else if (result.blocked) {
      // 의사가 보호함
      socket.emit('killBlocked', { message: '대상이 보호받고 있습니다.' });
    } else {
      socket.emit('error', { message: '킬에 실패했습니다.' });
    }
  });

  // 🚨 긴급 회의 소집
  socket.on('callEmergencyMeeting', () => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (!roomId) return;

    const gameState = gameStates.get(roomId);
    if (!gameState) return;

    if (startEmergencyMeeting(gameState, socket.id)) {
      const caller = gameState.players.get(socket.id);
      
      // 모든 플레이어에게 회의 시작 알림
      io.to(roomId).emit('meetingStarted', {
        type: 'emergency',
        callerId: socket.id,
        callerName: caller?.nickname,
        phase: 'meeting',
        timer: gameState.meetingTimer,
        alivePlayers: Array.from(gameState.players.values()).filter(p => p.isAlive)
      });

      // 회의 타이머 시작
      startMeetingTimer(roomId, gameState);
    }
  });

  // 💀 시체 발견 (리포트)
  socket.on('reportBody', (bodyId: string) => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (!roomId) return;

    const gameState = gameStates.get(roomId);
    if (!gameState) return;

    if (startReportMeeting(gameState, socket.id, bodyId)) {
      const reporter = gameState.players.get(socket.id);
      const body = gameState.players.get(bodyId);
      
      io.to(roomId).emit('meetingStarted', {
        type: 'report',
        callerId: socket.id,
        callerName: reporter?.nickname,
        bodyId: bodyId,
        bodyName: body?.nickname,
        phase: 'meeting',
        timer: gameState.meetingTimer,
        alivePlayers: Array.from(gameState.players.values()).filter(p => p.isAlive)
      });

      // 회의 타이머 시작
      startMeetingTimer(roomId, gameState);
    }
  });

  // 🗳️ 투표하기
  socket.on('vote', (targetId: string | 'skip') => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (!roomId) return;

    const gameState = gameStates.get(roomId);
    if (!gameState || gameState.phase !== 'voting') {
      socket.emit('error', { message: '투표는 투표 단계에서만 가능합니다.' });
      return;
    }

    if (castVote(gameState, socket.id, targetId)) {
      const voter = gameState.players.get(socket.id);
      
      // 모든 플레이어에게 투표 현황 알림 (누가 투표했는지만, 대상은 숨김)
      io.to(roomId).emit('playerVoted', {
        voterId: socket.id,
        voterName: voter?.nickname,
        totalVotes: gameState.votes.size,
        totalAlive: Array.from(gameState.players.values()).filter(p => p.isAlive).length
      });

      // 모든 살아있는 플레이어가 투표했는지 확인
      const alivePlayers = Array.from(gameState.players.values()).filter(p => p.isAlive);
      const allVoted = alivePlayers.every(p => p.hasVoted);

      if (allVoted) {
        // 투표 종료 - 결과 계산
        clearTimeout(votingTimers.get(roomId));
        votingTimers.delete(roomId);
        processVotingResult(roomId, gameState);
      }
    }
  });

  // 🔍 경찰 조사
  socket.on('policeInvestigate', (targetId: string) => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (!roomId) return;

    const gameState = gameStates.get(roomId);
    if (!gameState) return;

    const result = policeInvestigate(gameState, socket.id, targetId);
    
    if (result.success) {
      const target = gameState.players.get(targetId);
      socket.emit('investigationResult', {
        targetId: targetId,
        targetName: target?.nickname,
        isMafia: result.isMafia,
        message: result.isMafia ? '이 플레이어는 마피아입니다!' : '이 플레이어는 마피아가 아닙니다.'
      });
    }
  });

  // 💉 의사 보호
  socket.on('doctorProtect', (targetId: string) => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (!roomId) return;

    const gameState = gameStates.get(roomId);
    if (!gameState) return;

    if (doctorProtect(gameState, socket.id, targetId)) {
      const target = gameState.players.get(targetId);
      socket.emit('protectionSet', {
        targetId: targetId,
        targetName: target?.nickname,
        message: `${target?.nickname}을(를) 보호합니다.`
      });
    }
  });

  // 📊 게임 상태 요청
  socket.on('getGameState', () => {
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (!roomId) return;

    const gameState = gameStates.get(roomId);
    if (!gameState) return;

    const serializedState = serializeGameState(gameState, socket.id);
    socket.emit('gameStateUpdate', serializedState);
  });

  // 회의 타이머 시작 헬퍼 함수
  function startMeetingTimer(roomId: string, gameState: GameState) {
    // 기존 타이머 정리
    if (meetingTimers.has(roomId)) {
      clearInterval(meetingTimers.get(roomId));
    }

    let timeLeft = gameState.meetingTimer;

    const timer = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit('timerUpdate', { phase: 'meeting', timeLeft });

      if (timeLeft <= 0) {
        clearInterval(timer);
        meetingTimers.delete(roomId);
        
        // 투표 단계로 전환
        if (startVotingPhase(gameState)) {
          io.to(roomId).emit('votingStarted', {
            phase: 'voting',
            timer: gameState.votingTimer,
            alivePlayers: Array.from(gameState.players.values()).filter(p => p.isAlive)
          });
          startVotingTimer(roomId, gameState);
        }
      }
    }, 1000);

    meetingTimers.set(roomId, timer);
  }

  // 투표 타이머 시작 헬퍼 함수
  function startVotingTimer(roomId: string, gameState: GameState) {
    if (votingTimers.has(roomId)) {
      clearTimeout(votingTimers.get(roomId));
    }

    let timeLeft = gameState.votingTimer;

    const timer = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit('timerUpdate', { phase: 'voting', timeLeft });

      if (timeLeft <= 0) {
        clearInterval(timer);
        votingTimers.delete(roomId);
        
        // 투표 결과 처리
        processVotingResult(roomId, gameState);
      }
    }, 1000);

    votingTimers.set(roomId, timer);
  }

  // 투표 결과 처리 헬퍼 함수
  function processVotingResult(roomId: string, gameState: GameState) {
    gameState.phase = 'result';
    
    const result = calculateVoteResult(gameState);
    
    // 투표 결과 공개
    const voteDetails: { playerId: string; nickname: string; votes: number }[] = [];
    result.voteCount.forEach((count, playerId) => {
      const player = gameState.players.get(playerId);
      voteDetails.push({
        playerId,
        nickname: player?.nickname || (playerId === 'skip' ? '스킵' : '알 수 없음'),
        votes: count
      });
    });

    io.to(roomId).emit('votingResult', {
      ejected: result.ejected,
      ejectedName: result.ejected ? gameState.players.get(result.ejected)?.nickname : null,
      ejectedRole: result.ejected ? gameState.players.get(result.ejected)?.role : null,
      tie: result.tie,
      voteDetails: voteDetails.sort((a, b) => b.votes - a.votes)
    });

    // 추방 처리
    if (result.ejected) {
      ejectPlayer(gameState, result.ejected);
    }

    // 게임 종료 체크
    setTimeout(() => {
      const endResult = checkGameEnd(gameState);
      if (endResult.ended) {
        io.to(roomId).emit('gameEnded', {
          winner: endResult.winner,
          winnerName: endResult.winner === 'mafia' ? '마피아' : '시민',
          players: Array.from(gameState.players.values())
        });
        gameStates.delete(roomId);
      } else {
        // 플레이 단계로 복귀
        returnToPlayPhase(gameState);
        io.to(roomId).emit('phaseChanged', {
          phase: 'playing',
          roundNumber: gameState.roundNumber
        });
      }
    }, 3000); // 3초 후 결과 보여주고 다음 단계로
  }

  // === 채팅 시스템 ===
  
  // 로비 채팅 (방에 참가하지 않은 상태)
  socket.on('lobbyChatMessage', (message: string) => {
    const player = userSessions.get(socket.id);
    if (!player) return;
    
    // 모든 로비 사용자에게 메시지 전송
    io.emit('lobbyChatMessage', {
      id: socket.id,
      nickname: player.nickname,
      university: player.university,
      message: message,
      timestamp: Date.now()
    });
  });
  
  // 방 채팅 (방 대기실에서)
  socket.on('roomChatMessage', (message: string) => {
    const player = userSessions.get(socket.id);
    if (!player) return;
    
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (!roomId) {
      socket.emit('error', { message: '방에 참가하지 않았습니다.' });
      return;
    }
    
    // 같은 방의 모든 플레이어에게 메시지 전송
    io.to(roomId).emit('roomChatMessage', {
      id: socket.id,
      nickname: player.nickname,
      message: message,
      timestamp: Date.now()
    });
    
    console.log(`[채팅] ${player.nickname}: ${message}`);
  });
  
  // 게임 내 채팅 (게임 중)
  socket.on('gameChatMessage', (message: string) => {
    const player = userSessions.get(socket.id);
    if (!player) return;
    
    const roomId = roomManager.getPlayerRoom(socket.id);
    if (!roomId) return;
    
    const gameState = gameStates.get(roomId);
    if (!gameState) return;
    
    const playerState = gameState.players.get(socket.id);
    
    // 죽은 플레이어는 죽은 플레이어끼리만 채팅 가능
    if (playerState && !playerState.isAlive) {
      // 죽은 플레이어들에게만 전송
      gameState.players.forEach((p, id) => {
        if (!p.isAlive) {
          io.to(id).emit('gameChatMessage', {
            id: socket.id,
            nickname: player.nickname,
            message: message,
            isGhost: true,
            timestamp: Date.now()
          });
        }
      });
    } else {
      // 살아있는 플레이어는 모두에게 전송
      io.to(roomId).emit('gameChatMessage', {
        id: socket.id,
        nickname: player.nickname,
        message: message,
        isGhost: false,
        timestamp: Date.now()
      });
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    console.log('유저 접속 종료:', socket.id);
    
    // 방에서 나가기 처리
    const result = roomManager.leaveRoom(socket.id);
    
    if (result.roomId) {
      // 방이 아직 존재하면 업데이트 전송
      if (result.room) {
        io.to(result.roomId).emit('roomUpdate', result.room);
      }
      
      // 모든 사용자에게 방 목록 업데이트
      io.emit('roomListUpdate', roomManager.getAllRooms());
    }
    
    // 사용자 세션 삭제
    userSessions.delete(socket.id);
  });
});

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다!`);
  console.log(`📡 Frontend URL: ${process.env.FRONTEND_URL || '*'}`);
});
