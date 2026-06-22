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
  lastAnsweredQuestionIndex: number | null; // 💡 [꼼수방지] 마지막으로 제출 완료한 퀴즈 인덱스 기록
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
  
  // 렌더 서버 배정 포트 수용 (포트 바인딩 에러 완전 해결)
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // CORS 자물쇠 해제 미들웨어 (구글 AI 스튜디오 통신 전면 허용)
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    
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

  // 학생 등록/입장
  app.post("/api/room/:roomCode/join", (req, res) => {
    const { roomCode } = req.params;
    const { studentId, name } = req.body;

    if (!studentId || !name) {
      res.status(400).json({ error: "studentId and name are required" });
      return;
    }

    const room = getOrCreateRoom(roomCode);

    const nameMatch = room.students.find((s) => s.name === name);
    const idMatch = room.students.find((s) => s.id === studentId);
    const existingStudent = nameMatch || idMatch;

    if (existingStudent) {
      res.json({ room, registeredStudentId: existingStudent.id });
    } else {
      const newStudent: Student = {
        id: studentId,
        name,
        score: 0,
        solvedCount: 0,
        lastAnswerCorrect: null,
        lastAnsweredAt: null,
        lastAnsweredQuestionIndex: null, // 초기값 null
      };
      room.students.push(newStudent);
      res.json({ room, registeredStudentId: studentId });
    }
  });

  // 학생 답안 제출 (꼼수 무력화 핵방어존)
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
      student = {
        id: studentId,
        name: name || "알 수 없는 선수",
        score: 0,
        solvedCount: 0,
        lastAnswerCorrect: null,
        lastAnsweredAt: null,
        lastAnsweredQuestionIndex: null,
      };
      room.students.push(student);
    }

    // 💡 [꼼수 검사 치트키] 이미 현재 문제 번호에 슛을 날린 이력이 있다면 점수 가산 없이 즉시 반사!
    if (student.lastAnsweredQuestionIndex === room.currentQuestionIndex) {
      res.json(room);
      return;
    }

    // 통과했다면 이제 이 퀴즈 문항을 해결했다고 낙인 찍기
    student.lastAnsweredQuestionIndex = room.currentQuestionIndex;
    
    // 점수 누적 가산 처리
    student.score += (score || 0);
    student.solvedCount += 1;
    student.lastAnswerCorrect = isCorrect;
    student.lastAnsweredAt = answeredAt;

    res.json(room);
  });

  // 방 전체 상태 업데이트
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

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Live classroom quiz backend running on port ${PORT}`);
  });
}

startServer();
