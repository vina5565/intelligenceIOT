// src/core/Server.ts
// 서버 초기화 및 설정 클래스

import express, { Express } from 'express';
import cors from 'cors';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

/**
 * 서버 설정 클래스
 * SRP: 서버 초기화 및 환경 설정만 담당
 */
export class Server {
  public app: Express;
  public httpServer: HttpServer;
  public io: SocketServer;
  public supabase: SupabaseClient;

  constructor() {
    // 환경 변수 로드
    dotenv.config();

    // Express 앱 생성
    this.app = express();
    this.httpServer = createServer(this.app);

    // CORS 설정
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || '*',
      credentials: true
    }));
    this.app.use(express.json());

    // Socket.IO 설정
    this.io = new SocketServer(this.httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || '*',
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    // Supabase 연결
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SUPABASE_KEY = process.env.SUPABASE_KEY!;
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  /**
   * HTTP API 라우트를 등록합니다
   */
  registerRoutes(): void {
    // 서버 상태 확인 (헬스체크)
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    });

    // 유저 입장 (Supabase 저장)
    this.app.post('/api/join', async (req, res) => {
      const { nickname, university } = req.body;

      const { data, error } = await this.supabase
        .from('user-login')
        .insert([{ nickname, university }])
        .select();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({ message: "입장 성공!", data });
    });
  }

  /**
   * 서버를 시작합니다
   */
  start(port: number | string): void {
    this.httpServer.listen(port, () => {
      console.log(`🚀 서버가 포트 ${port}에서 실행 중입니다!`);
      console.log(`📡 Frontend URL: ${process.env.FRONTEND_URL || '*'}`);
    });
  }
}
