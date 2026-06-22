import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface Student {
  id: string;
  name: string;
  score: number;
  solvedCount: number;
  lastAnswerCorrect: boolean | null;
  lastAnsweredAt: number | null;
}

interface Room {
  roomCode: string;
  gameState: "LOBBY" | "PLAYING" | "FINISHED";
  currentQuestionIndex: number;
  timeLeft: number;
  timerActive: boolean;
  students: Student[];
}

const rooms: Record<string, Room> = {};

function getOrCreateRoom(roomCode: string): Room {
  if (!rooms[roomCode]) {
    rooms[roomCode] = {
      roomCode,
      gameState: "LOBBY",
      currentQuestionIndex: 0,
      timeLeft: 60,
      timerActive: false,
      students: [],
    };
  }
  return rooms[roomCode];
}

async function startServer() {
  const app = express();
  
  // 💡 [렌더 최적화] 렌더 서버가 유동적으로 배정하는 포트를 수용하도록 수정
  const PORT = process.env.PORT || 3000;

  // JSON 파싱 미들웨어
  app.use(express.json());

  // 💡 [CORS 자물쇠 해제] 구글 AI 스튜디오 등 외부 사이트의 API 호출을 전면 허용합니다.
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    
    // 브라우저가 본 요청 전에 안전한지 간보는 OPTIONS 요청은 즉시 200 OK로 통과
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // --- API Routes 시작 ---

  // 방 상태 가져오기
  app.get("/api/room/:roomCode", (req, res) => {
    const { roomCode } = req.params;
    const room = getOrCreateRoom(roomCode);
    res.json(room);
  });

  // 학생 등록/입장 (이름과 룸 코드가 동일하면 튕김 방지 및 기존 세션 복구 지원!)
  app.post("/api/room/:roomCode/join", (req, res) => {
    const { roomCode } = req.params;
    const { studentId, name } = req.body;

    if (!studentId || !name) {
      res.status(400).json({ error: "studentId and name are required" });
      return;
    }

    const room = getOrCreateRoom(roomCode);

    // 1. 이름으로 검색하여 기존 학생 기록이 있는지 여부 체크
    const nameMatch = room.students.find((s) => s.name === name);
    // 2. ID로 검색
    const idMatch = room.students.find((s) => s.id === studentId);

    const existingStudent = nameMatch || idMatch;

    if (existingStudent) {
      // 이미 같은 이름 혹은 같은 ID의 학생이 있다면 그 데이터의 ID를 가져와서 덮어쓴다!
      // 스코어 역시 원래 받은 점수를 그대로 보존합니다.
      res.json({ room, registeredStudentId: existingStudent.id });
    } else {
      // 새로운 학생 등록
      const newStudent: Student = {
        id: studentId,
        name,
        score: 0,
        solvedCount: 0,
        lastAnswerCorrect: null,
        lastAnsweredAt: null,
      };
      room.students.push(newStudent);
      res.json({ room, registeredStudentId: studentId });
    }
  });

  // 학생 답안 제출 및 즉시 스코어 가산 반영
  app.post("/api/room/:roomCode/submit", (req, res) => {
    const { roomCode } = req.params;
    const { studentId, name, score, isCorrect, answeredAt } = req.body;

    if (!studentId) {
      res.status(400).json({ error: "studentId is required" });
      return;
    }

    const room = getOrCreateRoom(roomCode);
    let student = room.students.find((s) => s.id === studentId);

    if (!student) {
      // 혹시라도 대기실 누락된 경우 즉시 복원(Self-Healing)
      student = {
        id: studentId,
        name: name || "알 수 없는 선수",
        score: 0,
        solvedCount: 0,
        lastAnswerCorrect: null,
        lastAnsweredAt: null,
      };
      room.students.push(student);
    }

    // 누적 반영
    student.score += (score || 0);
    student.solvedCount += 1;
    student.lastAnswerCorrect = isCorrect;
    student.lastAnsweredAt = answeredAt;

    res.json(room);
  });

  // 방 전체 상태 업데이트 (교사 전용 타이머 틱, 게임 상태 변경 일괄 반영)
  app.post("/api/room/:roomCode/update", (req, res) => {
    const { roomCode } = req.params;
    const { gameState, currentQuestionIndex, timeLeft, timerActive, students } = req.body;

    const room = getOrCreateRoom(roomCode);

    if (gameState !== undefined) room.gameState = gameState;
    if (currentQuestionIndex !== undefined) room.currentQuestionIndex = currentQuestionIndex;
    if (timeLeft !== undefined) room.timeLeft = timeLeft;
    if (timerActive !== undefined) room.timerActive = timerActive;
    if (students !== undefined) room.students = students;

    res.json(room);
  });

  // 게임 리셋
  app.post("/api/room/:roomCode/reset", (req, res) => {
    const { roomCode } = req.params;
    rooms[roomCode] = {
      roomCode,
      gameState: "LOBBY",
      currentQuestionIndex: 0,
      timeLeft: 60,
      timerActive: false,
      students: [],
    };
    res.json(rooms[roomCode]);
  });

  // --- API Routes 끝 ---

  // 개발 모드 시 Vite 컴파일 미들웨어 기동
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // 빌드된 정적 리소스 서빙
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 0.0.0.0 포트로 외부 개방 수신 시작
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Live classroom quiz backend running on port ${PORT}`);
  });
}

startServer();
