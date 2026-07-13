/**
 * 마지초 6학년 방학숙제 앱 — Cloud Functions
 *
 *  1) dailyMissionCheck  : 매일 저녁, 모든 활성 학급을 순회하며 4대 미션
 *                          미제출 학생에게 맞춤 알림을 자동 삽입하는 스케줄러
 *  2) joinClass          : 학급 참여 코드로 학생을 자기 반에 등록하는 callable
 *  3) gradeMathDay       : 수학 답안(전개도 포함)을 서버에서 검증하고
 *                          isCompleted를 확정하는 callable (조작 방지)
 *  4) submitWriting      : 글쓰기 제출을 서버 타임스탬프로 확정하는 callable
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

setGlobalOptions({ region: "asia-northeast3" }); // 서울 리전

/** KST 기준 오늘 날짜 키 (예: "2026-07-20") */
function todayKeyKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 방학 시작일 기준 오늘이 미션 며칠차인지 계산 → "day07" 형태 반환 */
function missionDayId(missionStartDate, maxDay) {
  const start = new Date(`${missionStartDate}T00:00:00+09:00`);
  const now = new Date();
  const diff = Math.floor((now - start) / (24 * 60 * 60 * 1000)) + 1;
  if (diff < 1 || diff > maxDay) return null; // 미션 기간 밖
  return `day${String(diff).padStart(2, "0")}`;
}

// =====================================================================
// 1) 동적 타겟팅 스케줄러 — 매일 20:00 KST, 모든 활성 학급 순회
// =====================================================================
exports.dailyMissionCheck = onSchedule(
  { schedule: "0 20 * * *", timeZone: "Asia/Seoul" },
  async () => {
    const dateKey = todayKeyKST();

    // DB에 등록된 "모든 활성 6학년 학급"을 동적으로 조회 (하드코딩 없음)
    const classesSnap = await db
      .collection("classes")
      .where("isActive", "==", true)
      .where("grade", "==", 6)
      .get();

    console.log(`[dailyMissionCheck] ${dateKey} — 활성 학급 ${classesSnap.size}개 순회 시작`);

    for (const classDoc of classesSnap.docs) {
      const cls = classDoc.data();
      const mathDayId = missionDayId(cls.missionStartDate, 28);
      const writingDayId = missionDayId(cls.missionStartDate, 30);

      const studentsSnap = await classDoc.ref
        .collection("students")
        .where("approved", "==", true)
        .get();

      const batch = db.batch();
      let notified = 0;

      // 학급 내 학생별 미션 검사는 병렬 처리
      await Promise.all(
        studentsSnap.docs.map(async (studentDoc) => {
          const missing = await findMissingMissions(
            studentDoc.ref, dateKey, mathDayId, writingDayId
          );
          if (missing.length === 0) return;

          const notifications = missing.map((m) => ({
            id: crypto.randomUUID(),
            type: m.type,
            message: m.message,
            date: dateKey,
            read: false,
          }));
          batch.update(studentDoc.ref, {
            notifications: admin.firestore.FieldValue.arrayUnion(...notifications),
          });
          notified += 1;
        })
      );

      await batch.commit();
      console.log(
        `[dailyMissionCheck] ${cls.name}: 학생 ${studentsSnap.size}명 중 ${notified}명에게 알림 발송`
      );
    }
  }
);

/** 한 학생의 당일 4대 미션 수행 여부를 확인하고 미완료 목록을 반환 */
async function findMissingMissions(studentRef, dateKey, mathDayId, writingDayId) {
  const [mathSnap, writingSnap, selfCheckSnap, emotionSnap] = await Promise.all([
    mathDayId ? studentRef.collection("mathProgress").doc(mathDayId).get() : null,
    writingDayId ? studentRef.collection("writingSubmissions").doc(writingDayId).get() : null,
    studentRef.collection("selfChecks").doc(dateKey).get(),
    studentRef.collection("emotions").doc(dateKey).get(),
  ]);

  const missing = [];
  if (mathDayId && !(mathSnap.exists && mathSnap.data().isCompleted === true)) {
    missing.push({
      type: "math",
      message: "오늘의 수학 미션이 아직 완료되지 않았어요! 📐",
    });
  }
  if (writingDayId && !(writingSnap.exists && writingSnap.data().isSubmitted === true)) {
    missing.push({
      type: "writing",
      message: "오늘의 글쓰기 주제가 기다리고 있어요! ✍️",
    });
  }
  if (!(selfCheckSnap.exists && selfCheckSnap.data().allDone === true)) {
    missing.push({
      type: "selfCheck",
      message: "오늘의 자기 점검 체크리스트를 완료해 주세요! ✅",
    });
  }
  if (!emotionSnap.exists) {
    missing.push({
      type: "emotion",
      message: "오늘 기분은 어땠나요? 감정 체크인을 잊지 마세요! 😊",
    });
  }
  return missing;
}

// =====================================================================
// 2) 학급 가입 callable — 참여 코드 검증 후 학생을 자기 반에 등록
// =====================================================================
exports.joinClass = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { code, name } = request.data ?? {};
  if (typeof code !== "string" || !code.trim() || typeof name !== "string" || !name.trim()) {
    throw new HttpsError("invalid-argument", "참여 코드와 이름을 입력해 주세요.");
  }

  const codeSnap = await db.collection("joinCodes").doc(code.trim().toUpperCase()).get();
  if (!codeSnap.exists || codeSnap.data().isActive !== true) {
    throw new HttpsError("not-found", "유효하지 않은 학급 참여 코드입니다.");
  }
  const { classId } = codeSnap.data();

  const userRef = db.collection("users").doc(uid);
  const existing = await userRef.get();
  if (existing.exists && existing.data().classId) {
    throw new HttpsError("already-exists", "이미 학급에 소속되어 있습니다.");
  }

  // 역할/학급 배정은 서버만 수행 (Rules에서 클라이언트 차단됨)
  const batch = db.batch();
  batch.set(userRef, {
    role: "student",
    name: name.trim(),
    classId,
    approved: true, // 정책상 교사 수동 승인을 원하면 false로 변경
  }, { merge: true });
  batch.set(db.doc(`classes/${classId}/students/${uid}`), {
    name: name.trim(),
    approved: true,
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    notifications: [],
  });
  await batch.commit();

  return { ok: true, classId };
});

// =====================================================================
// 3) 수학 채점 callable — 서버 검증 후에만 isCompleted 확정
// =====================================================================
exports.gradeMathDay = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { dayId, answers, netLines } = request.data ?? {};
  if (typeof dayId !== "string" || !/^day\d{2}$/.test(dayId)) {
    throw new HttpsError("invalid-argument", "dayId가 올바르지 않습니다.");
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.data();
  if (!user || user.role !== "student" || !user.classId || user.approved !== true) {
    throw new HttpsError("permission-denied", "승인된 학생만 제출할 수 있습니다.");
  }

  const bankSnap = await db.collection("mathBank").doc(dayId).get();
  if (!bankSnap.exists) throw new HttpsError("not-found", "해당 일차 문제가 없습니다.");
  const problems = bankSnap.data().problems ?? [];

  // ---- 서버 측 채점 ----
  let allCorrect = true;
  for (const p of problems) {
    if (p.kind === "netDrawing") {
      if (!linesMatch(netLines?.[p.id] ?? [], p.answerLines ?? [])) allCorrect = false;
    } else {
      const given = String(answers?.[p.id] ?? "").trim();
      if (given !== String(p.answer).trim()) allCorrect = false;
    }
    if (!allCorrect) break;
  }

  const progressRef = db.doc(
    `classes/${user.classId}/students/${uid}/mathProgress/${dayId}`
  );
  await progressRef.set(
    {
      answers: answers ?? {},
      userLines: netLines ?? {},
      isCompleted: allCorrect, // Admin SDK는 Rules를 우회 — 서버만 확정 가능
      gradedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { isCompleted: allCorrect };
});

/**
 * 전개도 선 비교 — 방향/순서 무관.
 * 각 선분을 "작은 끝점 우선"으로 정규화한 뒤 집합 동등성 검사.
 * (클라이언트 NetDrawingBoard와 동일한 알고리즘 — 이중 검증)
 */
function linesMatch(userLines, answerLines) {
  const normalize = (l) => {
    const [a, b] =
      l.x1 < l.x2 || (l.x1 === l.x2 && l.y1 <= l.y2)
        ? [[l.x1, l.y1], [l.x2, l.y2]]
        : [[l.x2, l.y2], [l.x1, l.y1]];
    return `${a[0]},${a[1]}-${b[0]},${b[1]}:${l.type}`;
  };
  const userSet = new Set(userLines.map(normalize));
  const answerSet = new Set(answerLines.map(normalize));
  if (userSet.size !== answerSet.size) return false;
  for (const key of answerSet) if (!userSet.has(key)) return false;
  return true;
}

// =====================================================================
// 4) 글쓰기 제출 callable — 서버 타임스탬프로 제출 확정
// =====================================================================
exports.submitWriting = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");

  const { dayId, content } = request.data ?? {};
  if (typeof dayId !== "string" || !/^day\d{2}$/.test(dayId)) {
    throw new HttpsError("invalid-argument", "dayId가 올바르지 않습니다.");
  }
  if (typeof content !== "string" || content.trim().length < 50) {
    throw new HttpsError("invalid-argument", "글은 최소 50자 이상 작성해 주세요.");
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.data();
  if (!user || user.role !== "student" || !user.classId || user.approved !== true) {
    throw new HttpsError("permission-denied", "승인된 학생만 제출할 수 있습니다.");
  }

  await db
    .doc(`classes/${user.classId}/students/${uid}/writingSubmissions/${dayId}`)
    .set(
      {
        content: content.trim(),
        isSubmitted: true,
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { ok: true };
});
