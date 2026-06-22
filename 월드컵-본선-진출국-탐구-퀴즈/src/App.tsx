import React, { useState, useEffect, useRef, useMemo } from "react";
import { COUNTRIES, Country, WORLD_MAP_POLYGONS } from "./data";
import { 
  Trophy, 
  Users, 
  Clock, 
  Flag, 
  Play, 
  Compass, 
  Sparkles, 
  RefreshCw, 
  Award, 
  UserPlus, 
  CheckCircle, 
  XCircle, 
  HelpCircle, 
  MapPin, 
  Volume2, 
  ChevronRight, 
  UserCheck 
} from "lucide-react";

// 대기실 학생 정의
interface Student {
  id: string;
  name: string;
  score: number;
  solvedCount: number;
  lastAnswerCorrect: boolean | null;
  lastAnsweredAt: number | null; 
  pendingScoreToAdd?: number;      
  pendingIsCorrect?: boolean | null;  
  pendingAnsweredAt?: number | null; 
}

// 퀴즈 문제 정의
interface QuizQuestion {
  country: Country;
  options: string[];
}

// 결정론적 셔플 (Seeded Shuffle)로 보기가 시간에 따라 섞이지 않도록 방지
function deterministicShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentSeed = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    const x = Math.sin(currentSeed++) * 10000;
    const r = x - Math.floor(x);
    const j = Math.floor(r * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

export default function App() {
  // 모드 게이트웨이: null(선택 대기), 'TEACHER', 'STUDENT'
  const [role, setRole] = useState<"TEACHER" | "STUDENT" | null>(null);

  // 멀티플레이어 기본 세팅
  const [roomCode, setRoomCode] = useState<string>("2026"); 
  const [isTeacherCodeSetup, setIsTeacherCodeSetup] = useState<boolean>(false);
  const [studentName, setStudentName] = useState<string>("");
  const [myId, setMyId] = useState<string>("");
  const [isRegistered, setIsRegistered] = useState<boolean>(false);

  // 게임 글로벌 상태 (교사와 학생이 동기화할 상태)
  const [gameState, setGameState] = useState<"LOBBY" | "PLAYING" | "FINISHED">("LOBBY");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [students, setStudents] = useState<Student[]>([]);

  // 안전하게 학생 상태를 업데이트하는 헬퍼 함수 (서버 구조 변화에 따른 White Screen 원천 차단)
  const safeSetStudentsFromData = (data: any) => {
    if (!data) return;
    if (Array.isArray(data.students)) {
      setStudents(data.students);
    } else if (data.room && Array.isArray(data.room.students)) {
      setStudents(data.room.students);
    } else if (Array.isArray(data)) {
      setStudents(data);
    }
  };

  // 타이머 관련 (각 문제당 10s * 3힌트 + 30s 백지도 = 60초)
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [timerActive, setTimerActive] = useState<boolean>(false);

  // 안내 메시지
  const [feedbackMsg, setFeedbackMsg] = useState<string>("준비 완료! 문제를 주의 깊게 읽어보세요.");

  // 학생 개별 클라이언트 상태
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [earnedPoints, setEarnedPoints] = useState<number>(0);

  // 백지도 캔버스 Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 데모 생성용 학생 이름
  const DEMO_NAMES = [
    "김지우", "이민준", "박서윤", "최예준", "정서현", 
    "강도윤", "조하은", "윤주원", "장채원", "임도현", 
    "한지민", "오건우", "서유나", "신우진", "권다은", 
    "황준우", "안지아", "송민재", "전하윤", "유도윤"
  ];

  // 룸 코드와 상관없이 모든 사용자 기기(교사 및 모든 학생) 등에서 동일하고 이상 변형 없는 고정 오지선다 퀴즈셋을 보증합니다.
  const quizQuestions = useMemo<QuizQuestion[]>(() => {
    return COUNTRIES.map((country) => {
      const otherCountries = COUNTRIES.filter((c) => c.name !== country.name);
      const len = otherCountries.length;
      
      // 수학적 고정 공식을 이용해 각 국가에 매칭될 오답 4개를 완벽하게 정해둠
      const rawOthers = [
        otherCountries[(country.id * 1) % len].name,
        otherCountries[(country.id * 3) % len].name,
        otherCountries[(country.id * 7) % len].name,
        otherCountries[(country.id * 9) % len].name,
      ];

      // 중복 방지 보강
      const uniqueOthers = Array.from(new Set(rawOthers));
      while (uniqueOthers.length < 4) {
        for (let i = 0; i < len; i++) {
          const name = otherCountries[i].name;
          if (!uniqueOthers.includes(name)) {
            uniqueOthers.push(name);
            if (uniqueOthers.length >= 4) break;
          }
        }
      }

      // 정답을 더하고 가나다 순으로 완벽하게 확정 정렬!
      // 이로써 무작위 확률로 인한 이상 보기나 학생별 불일치가 100% 영구적으로 예방됩니다.
      const options = [country.name, ...uniqueOthers].sort((a, b) => a.localeCompare(b, 'ko'));
      
      return { country, options };
    });
  }, []);

  // 상태 실시간 참조를 위한 refs
  const roomCodeRef = useRef<string>(roomCode);
  const gameStateRef = useRef<"LOBBY" | "PLAYING" | "FINISHED">(gameState);
  const currentQuestionIndexRef = useRef<number>(currentQuestionIndex);
  const timeLeftRef = useRef<number>(timeLeft);
  const timerActiveRef = useRef<number | boolean>(timerActive);

  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { currentQuestionIndexRef.current = currentQuestionIndex; }, [currentQuestionIndex]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);
  useEffect(() => { timerActiveRef.current = timerActive; }, [timerActive]);

  // 컴포넌트 마운트 시 학생 고유 ID 생성
  useEffect(() => {
    const uniqueId = "student_" + Math.random().toString(36).substr(2, 9);
    setMyId(uniqueId);
  }, []);

  // 1초 간격 실시간 서버 폴링 루프
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const runPoll = async () => {
      if (!roomCode) return;
      try {
        const res = await fetch(`/api/room/${roomCode}`);
        if (res.ok) {
          const data = await res.json();
          
          if (role === "STUDENT") {
            setGameState(data.gameState || "LOBBY");
            setCurrentQuestionIndex(data.currentQuestionIndex || 0);
            safeSetStudentsFromData(data);
            setTimeLeft(data.timeLeft !== undefined ? data.timeLeft : 60);
            setTimerActive(!!data.timerActive);

            const isMeInRoom = Array.isArray(data.students) && data.students.some((s: any) => s.id === myId);
            
            if (isRegistered && !isMeInRoom) {
              // 학생이 등록 상태이지만 서버 명단에 없는 경우 (서버 초기화 등)
              setIsRegistered(false);
              setSelectedOption(null);
              setHasSubmitted(false);
              setIsCorrect(null);
              setEarnedPoints(0);
            } else if (data.gameState === "LOBBY") {
              // 단순 로비 대기 상황에서는 가치를 유지하고 답변 상태만 초기화
              setSelectedOption(null);
              setHasSubmitted(false);
              setIsCorrect(null);
              setEarnedPoints(0);
            }
          } else {
            // 교사 혹은 선택 대기 상태일 때는 학생들의 실시간 현황 점수판만 갱신
            safeSetStudentsFromData(data);
          }
        }
      } catch (err) {
        console.warn("방 정보 폴링 오류:", err);
      }
    };

    if (roomCode) {
      runPoll();
      intervalId = setInterval(runPoll, 1000); 
    }

    return () => { if (intervalId) clearInterval(intervalId); };
  }, [roomCode, role, myId, isRegistered]);

  // 교사 전용 상태 동기화 함수 
  // 중요: 타이머가 깎일 때(매초)는 students 인자를 누락시켜 서버의 학생 입장/제출 데이터가 덮어씌워지지 않게 차단합니다.
  const broadcastState = async (
    gState: "LOBBY" | "PLAYING" | "FINISHED",
    qIndex: number,
    tLeft: number,
    tActive: boolean,
    currentStudents?: Student[] | null
  ) => {
    try {
      const payload: any = {
        gameState: gState,
        currentQuestionIndex: qIndex,
        timeLeft: tLeft,
        timerActive: tActive
      };
      
      if (currentStudents) {
        payload.students = currentStudents;
      }

      await fetch(`/api/room/${roomCode}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("서버 상태 전송 오류:", err);
    }
  };

  // 타이머 카운트다운 핸들러 (교사 브라우저가 주도)
  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (role === "TEACHER" && timerActive && timeLeft > 0 && gameState === "PLAYING") {
      timerId = setTimeout(() => {
        const nextTime = timeLeft - 1;
        setTimeLeft(nextTime);
        // 실시간 타이머만 서버로 전송 (학생 배열 제외하여 동기화 락 방지)
        broadcastState(gameState, currentQuestionIndex, nextTime, timerActive);
      }, 1000);
    } else if (role === "TEACHER" && timeLeft === 0 && timerActive) {
      setTimerActive(false);
      broadcastState(gameState, currentQuestionIndex, 0, false);
    }

    return () => { if (timerId) clearTimeout(timerId); };
  }, [timeLeft, timerActive, role, gameState, currentQuestionIndex]);

  // 힌트 단계 확인 연산 (각 힌트 노출 10초 간격, 백지도 30초 간격 = 총 60초)
  const elapsed = 60 - timeLeft;
  const isHint1Active = elapsed >= 0;
  const isHint2Active = elapsed >= 10;
  const isHint3Active = elapsed >= 20;
  const isHint4Active = elapsed >= 30;

  // 배점 계산 헬퍼 (힌트 1: 30점, 힌트 2: 25점, 힌트 3: 20점, 힌트 4 백지도: 15점)
  const getPointsForTime = (timeElapsed: number): number => {
    if (timeElapsed < 10) return 30;
    if (timeElapsed < 20) return 25;
    if (timeElapsed < 30) return 20;
    return 15;
  };

  // 백지도 드로잉 핸들러
  useEffect(() => {
    if (isHint4Active && canvasRef.current && quizQuestions[currentQuestionIndex]) {
      drawWorldMap();
    }
  }, [isHint4Active, currentQuestionIndex, quizQuestions, timeLeft]);

  const drawWorldMap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0c4a23"; 
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let latLine = -60; latLine <= 75; latLine += 15) {
      const cy = getCanvasY(latLine, height);
      ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(width, cy); ctx.stroke();
    }
    for (let lngLine = -150; lngLine <= 150; lngLine += 30) {
      const cx = getCanvasX(lngLine, width);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, height); ctx.stroke();
    }

    // 대륙 윤곽선 폴리곤 그리기
    ctx.fillStyle = "rgba(16, 185, 129, 0.25)"; 
    ctx.strokeStyle = "#10b981"; 
    ctx.lineWidth = 1.5;

    WORLD_MAP_POLYGONS.forEach((polygon) => {
      ctx.beginPath();
      polygon.forEach((pt, idx) => {
        const cx = getCanvasX(pt.lng, width);
        const cy = getCanvasY(pt.lat, height);
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });

    // 정답 국가 타겟 레이더 마킹
    const currentQ = quizQuestions[currentQuestionIndex];
    if (currentQ) {
      const targetCountry = currentQ.country;
      const targetX = getCanvasX(targetCountry.lng, width);
      const targetY = getCanvasY(targetCountry.lat, height);

      ctx.strokeStyle = "rgba(239, 68, 68, 0.5)";
      ctx.beginPath();
      ctx.moveTo(0, targetY); ctx.lineTo(width, targetY);
      ctx.moveTo(targetX, 0); ctx.lineTo(targetX, height);
      ctx.stroke();

      const pulseRadius = 10 + (Date.now() % 1000) / 100;
      ctx.strokeStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(targetX, targetY, pulseRadius, 0, Math.PI * 2); ctx.stroke();

      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(targetX, targetY, 6, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("정답 국가 위치", targetX + 10, targetY - 6);
    }
  };

  const getCanvasX = (lng: number, width: number) => ((lng + 180) / 360) * width;
  const getCanvasY = (lat: number, height: number) => {
    const maxLat = 82; const minLat = -60;
    const scaledLat = Math.max(minLat, Math.min(maxLat, lat));
    return height - ((scaledLat - minLat) / (maxLat - minLat)) * height;
  };

  // 교사 모드: 데모 가상 학생 20명 실시간 생성
  const handleAddDemoStudents = () => {
    const existingRealStudents = students.filter(s => !s.id.startsWith("demo_"));
    const existingNames = existingRealStudents.map(s => s.name);

    const demoList: Student[] = DEMO_NAMES.filter(name => !existingNames.includes(name)).map((name, index) => ({
      id: `demo_${index + 1}_${Math.random().toString(36).substr(2, 4)}`,
      name, score: 0, solvedCount: 0, lastAnswerCorrect: null, lastAnsweredAt: null,
    }));

    const mergedList = [...existingRealStudents, ...demoList].slice(0, 20);
    setStudents(mergedList);
    setFeedbackMsg("데모 시연용 가상 학생 20명이 완벽하게 세팅되었습니다!");
    broadcastState(gameState, currentQuestionIndex, timeLeft, timerActive, mergedList);
  };

  // 교사 모드: 게임 시작 실행
  const handleStartGame = () => {
    if (students.length === 0) {
      alert("대기실에 학생이 최소 1명 이상 있어야 킥오프할 수 있습니다!");
      return;
    }
    setGameState("PLAYING");
    setCurrentQuestionIndex(0);
    setTimeLeft(60);
    setTimerActive(true);

    const resetStudents = students.map((s) => ({
      ...s, score: 0, solvedCount: 0, lastAnswerCorrect: null, lastAnsweredAt: null,
    }));
    setStudents(resetStudents);
    broadcastState("PLAYING", 0, 60, true, resetStudents);
  };

  // 교사 모드: 다음 문제 진행
  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      setTimeLeft(60);
      setTimerActive(true);

      const nextStudents = students.map((s) => ({
        ...s, lastAnswerCorrect: null, lastAnsweredAt: null,
      }));
      setStudents(nextStudents);
      broadcastState("PLAYING", nextIndex, 60, true, nextStudents);
    } else {
      setGameState("FINISHED");
      setTimerActive(false);
      broadcastState("FINISHED", currentQuestionIndex, 0, false, students);
    }
  };

  // 학생 모드: 서버 연동형 방 입장 처리
  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) return alert("이름을 입력해 주세요!");

    setIsRegistered(true);
    setFeedbackMsg(`대기실 입장 완료! 선생님의 호각 소리를 기다리는 중...`);

    try {
      const res = await fetch(`/api/room/${roomCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: myId, name: studentName }),
      });
      if (res.ok) {
        const data = await res.json();
        safeSetStudentsFromData(data);
        // 서버에서 이름이 동일한 경우 등 기존 가입 식별자를 건네 받으면, 클라이언트 myId를 덮어씀으로써 온전히 세션/점수를 복원 연계!
        if (data.registeredStudentId) {
          setMyId(data.registeredStudentId);
        }
      }
    } catch (err) {
      console.error("서버 방 조인 실패:", err);
    }
  };

  // 학생 모드: 객관식 보기 제출 처리
  const handleSubmitAnswer = async (optionName: string) => {
    if (hasSubmitted || timeLeft <= 0) return;

    setSelectedOption(optionName);
    setHasSubmitted(true);

    const currentQ = quizQuestions[currentQuestionIndex];
    if (!currentQ) return;

    const correct = currentQ.country.name === optionName;
    setIsCorrect(correct);

    const timeSpent = 60 - timeLeft;
    const points = correct ? getPointsForTime(timeSpent) : 0;
    setEarnedPoints(points);

    setFeedbackMsg(`제출 완료! 정답 판정은 60초 제한시간이 마감된 후 공개됩니다.`);

    try {
      const res = await fetch(`/api/room/${roomCode}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: myId,
          name: studentName,
          score: points,
          isCorrect: correct,
          answeredAt: timeSpent,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        safeSetStudentsFromData(data);
      }
    } catch (err) {
      console.error("서버 답안 제출 실패:", err);
    }
  };

  // 문제 변동 감지 시 상태 리셋
  useEffect(() => {
    setSelectedOption(null); setHasSubmitted(false); setIsCorrect(null); setEarnedPoints(0);
    setFeedbackMsg("새로운 문항이 시작되었습니다! 단서를 기반으로 맞춰보세요.");
  }, [currentQuestionIndex]);

  // 제한시간 종료 시 안내 문구 제어
  useEffect(() => {
    if (gameState === "PLAYING" && timeLeft === 0) {
      const currentQ = quizQuestions[currentQuestionIndex];
      if (currentQ) {
        if (!hasSubmitted) setFeedbackMsg(`⏰ 시간 초과! 아쉽게 슛을 쏘지 못했습니다. 정답은 [${currentQ.country.name}] 입니다.`);
        else if (isCorrect === false) setFeedbackMsg(`❌ 골대 밖으로! 오답입니다. 정답 국가는 [${currentQ.country.name}] 입니다.`);
        else setFeedbackMsg(`🎉 정확하게 골망을 흔들었습니다! 정답은 [${currentQ.country.name}] 입니다!`);
      }
    }
  }, [timeLeft, gameState, currentQuestionIndex, quizQuestions, hasSubmitted, isCorrect]);

  // 서버 초기화 호각소리 날리기
  const handleResetAll = async () => {
    try {
      await fetch(`/api/room/${roomCode}/reset`, { method: "POST" });
    } catch (err) {
      console.error("서버 초기화 실패:", err);
    }
    setRole(null); setIsTeacherCodeSetup(false); setGameState("LOBBY"); setStudents([]); setCurrentQuestionIndex(0); setIsRegistered(false);
  };

  const podiumStudents = [...students].sort((a, b) => b.score - a.score).slice(0, 3);
  const topFiveStudents = [...students].sort((a, b) => b.score - a.score).slice(0, 5);
  const myInfo = students.find((s) => s.id === myId);
  const myCurrentScore = myInfo ? myInfo.score : 0;
  const myCurrentSolvedCount = myInfo ? myInfo.solvedCount : 0;

  return (
    <div className="min-h-screen bg-emerald-950 font-sans text-gray-100 flex flex-col antialiased relative overflow-hidden">
      {/* 운동장 필드 배경 라인 데코 */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-4 border-2 border-dashed border-white rounded-lg"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white rounded-full"></div>
      </div>

      {/* 상단 네비바 */}
      <header className="bg-emerald-900/90 backdrop-blur-md border-b border-emerald-800/80 sticky top-0 z-40 px-4 py-3 shadow-lg flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-amber-500 text-emerald-950 p-1.5 rounded-lg shadow-inner"><Trophy className="w-6 h-6" /></div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>월드컵 20개국 퀴즈</span>
            </h1>
            <p className="text-xs text-emerald-300">초등학교 6학년 사회, 체육 퀴즈</p>
          </div>
        </div>

        {role && (
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-800/70 text-emerald-100 border border-emerald-700/50 flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${role === "TEACHER" ? "bg-amber-400" : "bg-sky-400"}`}></span>
              {role === "TEACHER" ? "👨‍🏫 교사 대시보드" : `🏃 선수: ${studentName}`}
            </span>
            <button onClick={handleResetAll} className="text-xs bg-red-600 hover:bg-red-700 font-bold px-2.5 py-1.5 rounded text-white flex items-center gap-1 shadow-sm">
              <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">전체초기화</span>
            </button>
          </div>
        )}
      </header>

      {/* 실시간 콘텐츠 본부 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col justify-center">
        {!role && (
          <div>
            {!isTeacherCodeSetup ? (
              <div className="max-w-xl w-full mx-auto bg-emerald-900/70 border border-emerald-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl text-center">
                <div className="inline-block bg-gradient-to-tr from-amber-500 to-yellow-400 text-emerald-950 p-4 rounded-3xl mb-4"><Trophy className="w-12 h-12" /></div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white">수업 역할을 선택해주세요</h2>
                <p className="text-emerald-300 text-sm mt-2 mb-6 font-medium">실시간 서버와 연동하여 여러 학급이 동시에 퀴즈를 진행할 수 있습니다.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button onClick={() => { setIsTeacherCodeSetup(true); }} className="bg-amber-500 hover:bg-amber-400 text-emerald-950 font-bold p-6 rounded-2xl border-b-4 border-amber-600 flex flex-col items-center space-y-2 cursor-pointer transition">
                    <span className="text-3xl">👨‍🏫</span> <span className="text-base font-black">연구수업 교사용 화면</span>
                  </button>
                  <button onClick={() => { setRole("STUDENT"); }} className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold p-6 rounded-2xl border border-emerald-700 flex flex-col items-center space-y-2 cursor-pointer transition">
                    <span className="text-3xl">🏃</span> <span className="text-base font-black text-yellow-300">참여용 학생 화면</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-md w-full mx-auto bg-emerald-900/70 border border-emerald-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
                <div className="text-center mb-6">
                  <span className="text-5xl">🧭</span> 
                  <h2 className="text-2xl font-black text-white mt-2">입장 룸코드 개설 및 설정</h2>
                  <p className="text-emerald-300 text-xs mt-1 leading-relaxed">
                    다른 학급 및 다른 분반과 분리된 나만의 퀴즈 경기장을 개설합니다.<br />
                    아래에 원하시는 코드명을 지정하거나 무작위 코드를 만드세요.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-emerald-200 mb-1.5 text-center">개설할 룸코드 (숫자 또는 영어 단어 지정 가능)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        maxLength={12}
                        value={roomCode} 
                        onChange={(e) => setRoomCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))} 
                        placeholder="예: 2026, class-a, room-601"
                        required 
                        className="flex-1 bg-emerald-950 border border-emerald-700 rounded-xl px-4 py-3 text-white text-center text-lg font-mono font-bold uppercase" 
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          const randCode = Math.floor(1000 + Math.random() * 9000).toString();
                          setRoomCode(randCode);
                        }}
                        className="bg-emerald-800 hover:bg-emerald-700 text-yellow-300 text-xs font-bold px-3 py-2 rounded-xl border border-emerald-700 cursor-pointer active:scale-95 transition"
                        title="임의의 4자리 숫자 생성"
                      >
                        무작위 생성
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button 
                      type="button"
                      onClick={() => setIsTeacherCodeSetup(false)} 
                      className="w-1/3 bg-emerald-950 hover:bg-emerald-900 text-emerald-200 font-bold py-3 px-2 rounded-xl border border-emerald-800 text-xs cursor-pointer"
                    >
                      이전으로
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        if (!roomCode.trim()) {
                          alert("개설할 대기실 룸코드를 입력해주세요!");
                          return;
                        }
                        setRole("TEACHER");
                        setGameState("LOBBY");
                      }} 
                      className="flex-1 bg-gradient-to-tr from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-emerald-950 font-black py-3 px-4 rounded-xl text-sm shadow-md cursor-pointer active:scale-95 transition"
                    >
                      채널 개설 및 경기 대기실 시작
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 👨‍🏫 교사 UI */}
        {role === "TEACHER" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className={`${gameState === "FINISHED" ? "lg:col-span-12" : "lg:col-span-8"} flex flex-col space-y-6`}>
              
              {gameState === "LOBBY" && (
                <div className="bg-emerald-900/60 border border-emerald-800/80 rounded-2xl p-6 shadow-2xl flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-emerald-800/60 pb-4 mb-5 gap-3">
                      <div>
                        <h3 className="text-2xl font-black text-white">교실 대기실 (선수 소집처)</h3>
                        <p className="text-xs text-emerald-300 mt-1">실시간으로 아이들의 기기와 연동됩니다.</p>
                      </div>
                      <div className="bg-yellow-400 text-emerald-950 px-5 py-2.5 rounded-xl font-black text-center shadow-md">
                        <span className="block text-[10px] text-emerald-800 font-bold">입장 룸 코드</span>
                        <span className="text-2xl font-mono font-black">{roomCode}</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-bold text-emerald-200 flex items-center gap-1.5"><Users className="w-4 h-4 text-amber-400" /> 대기 중인 인원 ({students.length}명)</span>
                        {students.length < 20 && (
                          <button onClick={handleAddDemoStudents} className="text-xs bg-emerald-800 hover:bg-emerald-700 text-yellow-300 font-bold px-3 py-1.5 rounded-lg border border-emerald-700/80 flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> 테스트용 가상 학생 채우기</button>
                        )}
                      </div>

                      {students.length === 0 ? (
                        <div className="border border-emerald-800/40 border-dashed rounded-2xl py-12 text-center text-emerald-400 text-sm flex flex-col items-center justify-center space-y-2">
                          <Users className="w-8 h-8 opacity-30 text-emerald-200 animate-pulse" />
                          <p>현재 입장한 학생이 없습니다. 다른 기기로 코드 [{roomCode}]를 쳐서 들어오거나 위 데모 단추를 눌러보세요.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[250px] overflow-y-auto">
                          {students.map((student, idx) => (
                            <div key={student.id} className="bg-emerald-800/40 border border-emerald-700/50 rounded-xl p-3 flex flex-col items-center text-center shadow-sm relative overflow-hidden group">
                              <span className="text-xl mb-1">🏃</span> <span className="text-xs font-bold text-white truncate max-w-full">{student.name}</span>
                              <span className="text-[10px] text-emerald-300 mt-1 font-mono">No.{idx + 1}</span>
                              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400"></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 border-t border-emerald-800/60 pt-5 flex items-center justify-between">
                    <span className="text-xs text-emerald-400">* 정원이 소집되면 우측 버튼을 눌러 본 게임 주파수를 전송하십시오.</span>
                    <button onClick={handleStartGame} disabled={students.length === 0} className={`font-black px-8 py-3.5 rounded-2xl shadow-xl flex items-center gap-2 ${students.length > 0 ? "bg-amber-500 hover:bg-amber-400 text-emerald-950 cursor-pointer" : "bg-emerald-800 text-emerald-600 cursor-not-allowed"}`}>
                      <Play className="w-5 h-5 fill-current" /> 경기 개시 (수업 시작)
                    </button>
                  </div>
                </div>
              )}

              {gameState === "PLAYING" && quizQuestions[currentQuestionIndex] && (
                <div className="bg-emerald-900/60 border border-emerald-800/80 rounded-2xl p-6 shadow-2xl flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center border-b border-emerald-800/50 pb-4 mb-4">
                      <div>
                        <span className="text-xs bg-amber-500/20 text-yellow-300 font-bold px-2.5 py-1 rounded-full">문제 {currentQuestionIndex + 1} / 20</span>
                        <h4 className="text-xl font-bold mt-2 text-white">정답 국가 : <span className="text-yellow-300 underline">{quizQuestions[currentQuestionIndex].country.name}</span> ({quizQuestions[currentQuestionIndex].country.continent})</h4>
                      </div>
                      <div className="flex items-center space-x-2 text-white font-mono font-bold bg-emerald-950/80 border border-emerald-800 px-4 py-2 rounded-xl">
                        <Clock className={`w-5 h-5 ${timeLeft < 10 ? "text-red-400 animate-bounce" : "text-amber-400"}`} /> <span className="text-xl">{timeLeft}s</span>
                      </div>
                    </div>

                    <div className="h-2 bg-emerald-950 rounded-full overflow-hidden mb-6">
                      <div className={`h-full transition-all duration-1000 ${timeLeft < 10 ? "bg-red-500" : "bg-gradient-to-r from-amber-500 to-yellow-400"}`} style={{ width: `${(timeLeft / 60) * 100}%` }}></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                      <div className={`p-3 rounded-xl border ${isHint1Active ? "bg-emerald-800/50 border-amber-500/50" : "text-emerald-600"}`}>
                        <span className="text-xs font-black block text-amber-400 mb-1">힌트 1 (30점)</span>
                        <p className="text-xs text-white line-clamp-2">{quizQuestions[currentQuestionIndex].country.hint1}</p>
                      </div>
                      <div className={`p-3 rounded-xl border ${isHint2Active ? "bg-emerald-800/50 border-amber-500/50" : "text-emerald-600"}`}>
                        <span className="text-xs font-black block text-amber-400 mb-1">힌트 2 (25점)</span>
                        <p className="text-xs text-white line-clamp-2">{isHint2Active ? quizQuestions[currentQuestionIndex].country.hint2 : "🔒 대기..."}</p>
                      </div>
                      <div className={`p-3 rounded-xl border ${isHint3Active ? "bg-emerald-800/50 border-amber-500/50" : "text-emerald-600"}`}>
                        <span className="text-xs font-black block text-amber-400 mb-1">힌트 3 (20점)</span>
                        <p className="text-xs text-white line-clamp-2">{isHint3Active ? quizQuestions[currentQuestionIndex].country.hint3 : "🔒 대기..."}</p>
                      </div>
                      <div className={`p-3 rounded-xl border ${isHint4Active ? "bg-emerald-800/50 border-amber-500/50" : "text-emerald-600"}`}>
                        <span className="text-xs font-black block text-red-400 mb-1">지리 백지도 (15점)</span>
                        <p className="text-xs text-white line-clamp-2">{isHint4Active ? `🧭 위치 포인터 가동` : "🔒 잠금"}</p>
                      </div>
                    </div>

                    {isHint4Active && (
                      <div className="bg-emerald-950 rounded-2xl p-4 border border-emerald-800/60 mb-6 flex flex-col md:flex-row gap-4 items-center">
                        <div className="flex-1 w-full">
                          <canvas ref={canvasRef} width={500} height={250} className="bg-emerald-900 border border-emerald-800/80 rounded-xl w-full h-[180px]" />
                        </div>
                        <div className="md:w-[220px] bg-emerald-900/40 p-4 rounded-xl border border-emerald-800/50 text-xs">
                          <span className="text-yellow-300 font-bold block mb-1">🎯 정밀 위경도 매칭</span>
                          <span className="font-mono text-white block bg-emerald-950 p-2 rounded border border-emerald-800">{quizQuestions[currentQuestionIndex].country.hint4Range}</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <h6 className="text-xs font-bold text-emerald-200 mb-2">선수단 개별 슛 제출 현황 ({students.filter(s => s.lastAnswerCorrect !== null).length}명 마감)</h6>
                      <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto">
                        {students.map((student) => {
                          const hasAnswered = student.lastAnswerCorrect !== null;
                          return (
                            <span key={student.id} className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1 border ${hasAnswered ? "bg-green-950/70 text-green-300 border-green-700/60" : "bg-emerald-900/20 text-emerald-400 border-emerald-800/40"}`}>
                              <span className={`w-2 h-2 rounded-full ${hasAnswered ? student.lastAnswerCorrect ? "bg-emerald-400" : "bg-red-400" : "bg-emerald-600 animate-pulse"}`}></span>
                              {student.name} {hasAnswered && `(${student.lastAnswerCorrect ? `+${getPointsForTime(student.lastAnsweredAt || 0)}점` : "0점"})`}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 border-t border-emerald-800/50 pt-4 flex justify-between items-center">
                    <span className="text-xs text-emerald-300">* 정답 상황을 전광판에 충분히 해설한 뒤 다음 퀴즈를 송출하세요.</span>
                    <button onClick={handleNextQuestion} className="bg-amber-500 hover:bg-amber-400 text-emerald-950 font-black px-6 py-3 rounded-xl flex items-center gap-1.5 shadow-md">
                      <span>다음 퀴즈 송출</span> <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {gameState === "FINISHED" && (
                <div className="bg-emerald-900/60 border border-emerald-800/80 rounded-2xl p-6 shadow-2xl text-center">
                  <div className="py-6">
                    <div className="inline-block bg-gradient-to-tr from-yellow-400 to-amber-500 text-emerald-950 p-4 rounded-3xl mb-4"><Trophy className="w-16 h-16 animate-bounce" /></div>
                    <h3 className="text-3xl font-black text-white">경기 종료! 월드컵 대 시상식</h3>
                    <p className="text-emerald-300 text-sm mt-1">지리 고지를 극복하고 황금 골든부트를 차지한 최강 명사수 명단!</p>

                    {/* 종합 포디움 연단 */}
                    <div className="mt-12 max-w-lg mx-auto flex items-end justify-center gap-4 h-[260px] pb-4">
                      {podiumStudents[1] && (
                        <div className="flex flex-col items-center w-1/3">
                          <span className="text-sm font-extrabold text-gray-300">{podiumStudents[1].name}</span>
                          <span className="text-xs text-emerald-200">{podiumStudents[1].score}점</span>
                          <div className="w-full bg-gradient-to-t from-gray-400 to-gray-200 text-emerald-950 font-black rounded-t-xl h-[120px] flex flex-col items-center justify-center shadow-lg border border-gray-300/60 mt-2">
                            <span className="text-4xl">🥈</span> <span className="text-sm uppercase">2nd</span>
                          </div>
                        </div>
                      )}
                      {podiumStudents[0] && (
                        <div className="flex flex-col items-center w-1/3">
                          <span className="text-base font-black text-yellow-300">{podiumStudents[0].name}</span>
                          <span className="text-xs text-emerald-100">{podiumStudents[0].score}점</span>
                          <div className="w-full bg-gradient-to-t from-amber-500 to-yellow-300 text-emerald-950 font-black rounded-t-xl h-[170px] flex flex-col items-center justify-center shadow-2xl mt-2 relative">
                            <span className="absolute -top-7 text-3xl animate-bounce">👑</span> <span className="text-5xl">🥇</span> <span className="text-lg uppercase tracking-wider">1st</span>
                          </div>
                        </div>
                      )}
                      {podiumStudents[2] && (
                        <div className="flex flex-col items-center w-1/3">
                          <span className="text-sm font-extrabold text-amber-700">{podiumStudents[2].name}</span>
                          <span className="text-xs text-emerald-200">{podiumStudents[2].score}점</span>
                          <div className="w-full bg-gradient-to-t from-amber-800 to-amber-600 text-emerald-950 font-black rounded-t-xl h-[90px] flex flex-col items-center justify-center shadow-lg border border-amber-700/60 mt-2">
                            <span className="text-4xl">🥉</span> <span className="text-sm uppercase">3rd</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 명예의 전당 Top 5 명단 */}
                    <div className="mt-8 max-w-xl mx-auto bg-emerald-950/80 border border-emerald-800/80 rounded-2xl p-5 shadow-inner">
                      <h4 className="text-sm font-black text-amber-300 mb-4 border-b border-emerald-800/60 pb-2">🎖️ 종합 명예의 전당 (Top 5 최종 순위)</h4>
                      <div className="space-y-2">
                        {topFiveStudents.map((s, idx) => (
                          <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-emerald-900/40 border border-emerald-800/30">
                            <span className="text-sm font-bold text-white">{idx + 1}위 - {s.name}</span>
                            <span className="font-mono text-yellow-300 font-extrabold">{s.score}점 ({s.solvedCount}번 완료)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-emerald-800/60 pt-5 mt-6"><button onClick={handleResetAll} className="bg-emerald-800 hover:bg-emerald-700 text-white font-bold px-8 py-3 rounded-2xl border border-emerald-700 shadow-md flex items-center gap-2 mx-auto"><RefreshCw className="w-4 h-4" /> 새 대기실 개설 (재경기)</button></div>
                </div>
              )}
            </div>

            {/* 우측 실시간 참여명단 레이아웃 */}
            {gameState !== "FINISHED" && (
              <div className="lg:col-span-4 flex flex-col">
                <div className="bg-emerald-900/50 border border-emerald-800/80 rounded-2xl p-5 shadow-2xl flex flex-col h-full justify-between">
                  <div>
                    <h4 className="text-base font-black text-yellow-300 mb-4 flex items-center justify-between"><span><Users className="w-5 h-5 text-amber-400 inline mr-2" />우리 반 소집 명단</span></h4>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                      {[...students].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((student) => (
                        <div key={student.id} className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/30">
                          <span className="text-sm font-bold text-emerald-100">⚽ {student.name}</span>
                          <span className="text-[10px] text-emerald-400 border border-emerald-800 bg-emerald-950/80 px-2 py-0.5 rounded-full font-bold">라인업 가입됨</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-emerald-800/50 text-xs text-amber-200">
                    ⚽ 20개 매치가 모두 종료되는 순간 오프라인 대형 전광판 시상대가 전면 활성화됩니다!
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 🏃 학생 UI */}
        {role === "STUDENT" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className={`${gameState === "FINISHED" ? "lg:col-span-12" : "lg:col-span-8"} flex flex-col justify-between flex-1`}>
              
              {!isRegistered && (
                <div className="max-w-md w-full mx-auto bg-emerald-900/60 border border-emerald-800/80 rounded-3xl p-6 md:p-8 shadow-2xl">
                  <div className="text-center mb-6">
                    <span className="text-5xl">⚽</span> <h3 className="text-2xl font-black text-white mt-2">월드컵 탐구 선수단 등록</h3>
                    <p className="text-xs text-emerald-300">선생님이 칠판에 적어주신 룸 코드와 이름(등번호)을 입력하세요.</p>
                  </div>
                  <form onSubmit={handleJoinRoom} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-emerald-200 mb-1">룸 코드 (숫자 또는 영어)</label>
                      <input 
                        type="text" 
                        maxLength={12}
                        value={roomCode} 
                        onChange={(e) => setRoomCode(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase())} 
                        placeholder="예: 2026 또는 대기실 코드"
                        required 
                        className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-4 py-3 text-white text-center text-lg font-mono font-bold uppercase placeholder:text-emerald-800" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-emerald-200 mb-1">학생 이름 (본명)</label>
                      <input type="text" maxLength={10} value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="예: 박서윤" required className="w-full bg-emerald-950 border border-emerald-700 rounded-xl px-4 py-3 text-white text-center font-bold" />
                    </div>
                    <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-emerald-950 font-black py-4 rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer"><UserCheck className="w-5 h-5" /> 그라운드 입장하기</button>
                  </form>
                </div>
              )}

              {isRegistered && gameState === "LOBBY" && (
                <div className="bg-emerald-900/60 border border-emerald-800/80 rounded-2xl p-8 shadow-2xl text-center flex flex-col items-center justify-center space-y-4 flex-1 font-sans">
                  <span className="text-6xl animate-bounce">🏃⚽</span>
                  <h4 className="text-2xl font-black text-white">{studentName} 선수, 소집 완료!</h4>
                  <p className="text-emerald-300 text-sm">선생님 전광판에 명단이 등록되었습니다. 전술 호각이 울릴 때까지 잠시 대기하세요.</p>
                  <div className="bg-emerald-950/80 px-6 py-3 rounded-xl border border-emerald-800 text-sm">
                    <span className="text-xs text-emerald-400 block font-bold">배정된 룸 채널</span>
                    <span className="text-lg font-mono text-yellow-300 font-black tracking-widest">{roomCode}</span>
                  </div>
                </div>
              )}

              {isRegistered && gameState === "PLAYING" && quizQuestions[currentQuestionIndex] && (
                <div className="bg-emerald-900/60 border border-emerald-800/80 rounded-2xl p-6 shadow-2xl flex-1 flex flex-col justify-between space-y-5">
                  <div>
                    <div className="flex justify-between items-center border-b border-emerald-800/50 pb-3 mb-4">
                      <div><span className="text-xs bg-emerald-800 text-yellow-300 border border-emerald-700 px-3 py-1 rounded-full font-bold">매치 No.{currentQuestionIndex + 1}</span></div>
                      <div className="flex items-center space-x-3">
                        <div className="text-right">
                          <span className="text-[10px] text-emerald-400 block font-bold">내 누적 스코어</span>
                          <span className="text-xs font-black text-yellow-300 font-mono">{myCurrentScore}점 ({myCurrentSolvedCount}회 제출)</span>
                        </div>
                        <div className="flex items-center space-x-1 font-mono text-white font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800 text-xs">
                          <Clock className="w-3.5 h-3.5 text-amber-400" /> <span>{timeLeft}s</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-2 bg-emerald-950 rounded-full overflow-hidden mb-5">
                      <div className={`h-full transition-all duration-1000 ${timeLeft < 10 ? "bg-red-500" : "bg-gradient-to-r from-amber-500 to-yellow-400"}`} style={{ width: `${(timeLeft / 60) * 100}%` }}></div>
                    </div>

                    <div className="bg-emerald-950/80 rounded-2xl p-5 border border-emerald-800/50 space-y-3">
                      <span className="text-yellow-400 font-extrabold text-xs flex items-center gap-1"><Compass className="w-3.5 h-3.5" /> 6학년 대륙 단서 브리핑</span>
                      <div className="space-y-2 text-sm text-white">
                        {isHint1Active && <div className="flex items-start gap-2"><span className="bg-amber-500/20 text-yellow-300 text-[10px] px-1.5 py-0.5 rounded font-bold">단서1</span><p>{quizQuestions[currentQuestionIndex].country.hint1}</p></div>}
                        {isHint2Active ? <div className="flex items-start gap-2 border-t border-emerald-900 pt-2"><span className="bg-amber-500/20 text-yellow-300 text-[10px] px-1.5 py-0.5 rounded font-bold">단서2</span><p>{quizQuestions[currentQuestionIndex].country.hint2}</p></div> : <p className="text-xs text-emerald-600 italic">🔒 잠시 후 (경과 10초) 2단계 문화·체육 단서가 추가 해금됩니다.</p>}
                        {isHint3Active ? <div className="flex items-start gap-2 border-t border-emerald-900 pt-2"><span className="bg-amber-500/20 text-yellow-300 text-[10px] px-1.5 py-0.5 rounded font-bold">단서3</span><p>{quizQuestions[currentQuestionIndex].country.hint3}</p></div> : isHint2Active && <p className="text-xs text-emerald-600 italic">🔒 잠시 후 (경과 20초) 3단계 세부 핵심 단서가 해금됩니다.</p>}
                        {isHint4Active ? (
                          <div className="flex flex-col space-y-2 pt-2 border-t border-emerald-900">
                            <div className="flex items-start gap-2"><span className="bg-red-500/20 text-red-300 text-[10px] px-1.5 py-0.5 rounded font-bold">백지도</span><p className="text-xs text-emerald-200">정답 국가 좌표스케일: {quizQuestions[currentQuestionIndex].country.hint4Range}</p></div>
                            <canvas ref={canvasRef} width={500} height={230} className="bg-emerald-900 border border-emerald-800/80 rounded-xl w-full h-[140px]" />
                          </div>
                        ) : isHint3Active && <p className="text-xs text-rose-400 italic font-bold animate-pulse">🔒 잠시 후 (경과 30초) 4단계 세계 백지도 정밀 타겟 범위가 최종 해금됩니다!</p>}
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-xl text-xs font-bold border bg-emerald-950/60 text-emerald-300 border-emerald-800/40">
                      <span>{feedbackMsg}</span>
                    </div>

                    <div className="mt-5 space-y-2">
                      <span className="text-xs text-emerald-300 font-bold block">슈팅 영역: 타겟 국가를 골라 슛을 날리세요! (단 1회)</span>
                      <div className="grid grid-cols-1 gap-2">
                        {quizQuestions[currentQuestionIndex].options.map((option, idx) => {
                          const isSelected = selectedOption === option;
                          const isBtnDisabled = hasSubmitted || timeLeft <= 0;
                          const isAnswer = option === quizQuestions[currentQuestionIndex].country.name;

                          let btnClass = "";
                          if (timeLeft <= 0) {
                            if (isAnswer) btnClass = "bg-green-900/80 border-green-500 text-white ring-2 ring-yellow-400 font-extrabold";
                            else if (isSelected) btnClass = "bg-red-900/80 border-red-500 text-white opacity-80";
                            else btnClass = "bg-emerald-950/30 border-emerald-900/50 text-emerald-600 opacity-50 cursor-not-allowed";
                          } else {
                            if (isSelected) btnClass = "bg-amber-900/80 border-amber-500 text-white ring-1 ring-amber-400";
                            else if (hasSubmitted) btnClass = "bg-emerald-950/30 border-emerald-900/50 text-emerald-600 opacity-80 cursor-not-allowed";
                            else btnClass = "bg-emerald-800/50 hover:bg-emerald-800 border-emerald-700 text-white";
                          }

                          return (
                            <button key={idx} disabled={isBtnDisabled} onClick={() => { if(!isBtnDisabled) handleSubmitAnswer(option); }} className={`w-full text-left p-3 rounded-xl font-bold transition flex items-center justify-between border ${btnClass}`}>
                              <span className="flex items-center space-x-3">
                                <span className={`text-xs w-6 h-6 rounded-full flex items-center justify-center border ${timeLeft <= 0 && isAnswer ? "bg-yellow-400 text-emerald-950 font-black" : "bg-emerald-950/60 text-emerald-300"}`}>{idx + 1}</span>
                                <span className="text-sm">{option}</span>
                              </span>
                              {timeLeft <= 0 ? isAnswer ? <span className="text-xs text-yellow-300 font-black">★ 정답 오픈 ★</span> : isSelected ? <span className="text-xs text-red-300">내 슈팅 오답</span> : null : isSelected && <span className="text-xs text-amber-300 font-black">제출 완료</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {isRegistered && gameState === "FINISHED" && (
                <div className="bg-emerald-900/60 border border-emerald-800/80 rounded-2xl p-6 shadow-2xl text-center flex flex-col justify-between">
                  <div>
                    <div className="inline-block bg-gradient-to-tr from-yellow-400 to-amber-500 text-emerald-950 p-4 rounded-3xl mb-4"><Trophy className="w-12 h-12" /></div>
                    <h3 className="text-2xl font-black text-white">모든 매치 종료! 종합 시상대</h3>
                    <p className="text-emerald-300 text-sm">20개 고지를 향해 멋진 레이스를 펼쳤습니다. 전방 전광판 시상식을 확인하세요!</p>
                    <div className="bg-emerald-950/80 p-4 rounded-xl border border-emerald-800/50 max-w-sm mx-auto mt-4 text-xs">
                      <p className="font-bold text-emerald-200">🏃 나의 종합 성적 레코드</p>
                      <p className="text-emerald-300 mt-1">최종 획득 스코어: <strong className="text-yellow-300 text-base font-mono">{(students.find(s => s.id === myId)?.score || 0)}점</strong></p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 학생 화면의 실시간 동료 라인업 명단 */}
            {gameState !== "FINISHED" && (
              <div className="lg:col-span-4 flex flex-col">
                <div className="bg-emerald-900/50 border border-emerald-800/80 rounded-2xl p-5 shadow-2xl flex flex-col h-full justify-between">
                  <div>
                    <h4 className="text-sm font-black text-yellow-300 mb-3"><span>🏃 나와 함께 뛰는 선수단 ({students.length}명)</span></h4>
                    <div className="space-y-1.5 max-h-[450px] overflow-y-auto">
                      {[...students].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((student) => {
                        const isMe = student.id === myId;
                        return (
                          <div key={student.id} className={`flex items-center justify-between p-2 rounded-lg border ${isMe ? "bg-yellow-400/10 border-yellow-500/50 text-white font-extrabold" : "bg-emerald-950/40 border-emerald-800/30"}`}>
                            <span className={`text-xs ${isMe ? "text-yellow-300 font-extrabold" : "text-emerald-100"}`}>{isMe ? "⭐" : "⚽"} {student.name} {isMe && "(나)"}</span>
                            <span className="text-[9px] bg-emerald-950 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-800">커넥션 정상</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-emerald-950/90 py-3 text-center text-[10px] text-emerald-600 border-t border-emerald-900/60 z-10">
        <p>© 2026 월드컵 본선 진출국 탐구 융합 플랫폼 - 실시간 동기화 완료</p>
      </footer>
    </div>
  );
}