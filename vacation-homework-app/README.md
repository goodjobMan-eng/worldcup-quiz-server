# 마지초등학교 6학년 방학숙제 통합 앱

6학년 동학년 전체(다중 학급)가 함께 사용하는 교육 및 학급 운영 통합 앱입니다.

- **프론트엔드:** Flutter (`flutter_app/`)
- **백엔드:** Firebase (Firestore, Auth, Cloud Functions — `functions/`)
- **보안:** Firestore Security Rules (`firestore.rules`)

## 핵심 설계 원칙

1. **다중 학급(Multi-Class) 아키텍처** — 선생님마다 학급을 개설하고, 학생은 '학급 참여 코드'로 자기 반에 소속됩니다.
2. **공유 데이터와 독립 데이터의 분리**
   - 공유(동학년): 수학 문제 은행(28일), 글쓰기 주제(30일) → 최상위 공유 컬렉션
   - 독립(학급별): 제출/점검/감정/알림 데이터 → `classes/{classId}` 하위에 격리
3. **서버 검증 채점** — 채점 결과(`isCompleted`)는 클라이언트가 직접 쓸 수 없고, Cloud Functions(callable)만 기록합니다. 클라이언트의 실시간 비교는 UX용 즉시 피드백이며, 최종 확정은 서버가 합니다.

---

## 1. Firestore DB 스키마 설계안

```
firestore-root
│
├── users/{uid}                          # 전역 역할 조회용 (Security Rules의 기준점)
│     role: "teacher" | "student"
│     name: string
│     classId: string                    # 소속 학급 (교사는 담당 학급)
│     approved: bool                     # 학생: 교사 승인 여부
│
├── joinCodes/{code}                     # 학급 참여 코드 → 학급 매핑
│     classId: string
│     grade: 6
│     isActive: bool
│
├── mathBank/{dayId}                     # ★ 동학년 공유: 수학 28일 커리큘럼
│     day: 1..28                         #   dayId 예: "day01" ~ "day28"
│     unit: string                       #   단원명 (분수의 나눗셈, 전개도, ...)
│     type: "concept" | "review"        #   개념 18일 + 혼합 복습 10일
│     problems: [
│       { id, kind: "multipleChoice"|"shortAnswer"|"netDrawing",
│         question, choices?, answer?,          # 일반 문제
│         answerLines?: [                        # 전개도 문제 (netDrawing)
│           { x1, y1, x2, y2, type: 0|1 }        #   type 0=실선(자르기), 1=점선(접기)
│         ] }
│     ]
│     updatedBy: uid                     # 마지막 수정 교사
│
├── writingTopics/{dayId}                # ★ 동학년 공유: 30일 글쓰기 주제
│     day: 1..30
│     topic: string
│     guide: string                      # 글쓰기 안내문
│
└── classes/{classId}                    # ★ 학급별 독립 데이터의 루트
      name: "6학년 1반"
      grade: 6
      teacherId: uid
      joinCode: string
      isActive: bool                     # 스케줄러 순회 대상 여부
      missionStartDate: "2026-07-20"     # 방학 미션 1일차 기준일
      │
      ├── selfCheckTemplates/{dateKey}   # 교사가 부여한 당일 자기 점검 항목
      │     items: [ { id, label } ]     #   예: 알림장 확인, 준비물, 독서 30분
      │
      └── students/{uid}
            name, approved, joinedAt
            notifications: [             # 스케줄러가 arrayUnion으로 삽입
              { id, type, message, date, read }
            ]
            │
            ├── mathProgress/{dayId}         # 수학 제출 (dayId = day01..day28)
            │     answers: map               # 학생 답안 (클라이언트 기록 가능)
            │     userLines: [...]           # 전개도 그리기 결과
            │     isCompleted: bool          # ★ 서버(Cloud Function)만 쓰기 가능
            │     gradedAt: timestamp        # ★ 서버만 쓰기 가능
            │
            ├── writingSubmissions/{dayId}   # 글쓰기 제출 (day01..day30)
            │     content: string
            │     submittedAt: timestamp     # ★ 서버 타임스탬프 강제
            │     isSubmitted: bool          # ★ 서버만 확정
            │
            ├── selfChecks/{dateKey}         # 일일 자기 점검 (dateKey = 2026-07-20)
            │     checkedItemIds: [string]
            │     allDone: bool
            │
            └── emotions/{dateKey}           # 일일 감정 체크인
                  emoji: string              # 😀 😐 😢 😡 😴 ...
                  comment: string
                  createdAt: timestamp
```

### 설계 근거

| 요구사항 | 반영 방식 |
|---|---|
| 다중 학급 | 모든 학급 데이터가 `classes/{classId}` 아래에 격리. 스케줄러는 `isActive == true` 학급만 순회 |
| 공유 문제 은행 | `mathBank`, `writingTopics`를 최상위에 두어 모든 교사가 공동 편집, 모든 학급이 읽기 |
| 참여 코드 가입 | `joinCodes/{code}` 조회 → callable 함수가 검증 후 학급에 학생 등록 |
| 채점 조작 방지 | `isCompleted`/`gradedAt`은 Rules에서 클라이언트 쓰기 차단, Admin SDK(Functions)만 기록 |
| 교사 대시보드 | 학급 하위 컬렉션을 collectionGroup 없이 단순 쿼리로 당일 현황 집계 가능 |

---

## 2. 폴더 구성

```
vacation-homework-app/
├── README.md                ← 본 문서 (스키마 설계안)
├── firebase.json
├── firestore.rules          ← 보안 규칙
├── functions/               ← Node.js Cloud Functions
│   ├── package.json
│   └── index.js             ← 스케줄러 + 채점/가입 callable
└── flutter_app/
    ├── pubspec.yaml
    └── lib/
        ├── main.dart
        ├── models/models.dart
        ├── services/firestore_service.dart
        ├── data/math_curriculum.dart    ← 28일 커리큘럼 시드
        ├── data/writing_topics.dart     ← 30일 주제 시드
        ├── widgets/
        │   ├── net_drawing_board.dart   ← 전개도 그리기 + 실시간 자동 채점
        │   ├── self_check_list.dart     ← 일일 자기 점검 체크리스트
        │   └── streak_tracker.dart      ← 글쓰기 연속 제출 트래커
        └── screens/
            ├── auth/join_class_screen.dart
            ├── student/student_home_screen.dart
            ├── student/math_mission_screen.dart
            ├── student/writing_screen.dart
            ├── student/emotion_checkin_screen.dart
            └── teacher/teacher_dashboard_screen.dart
```

## 3. 배포 방법

```bash
# Functions 배포
cd functions && npm install
firebase deploy --only functions

# 보안 규칙 배포
firebase deploy --only firestore:rules

# Flutter 실행 (FlutterFire CLI로 firebase_options.dart 생성 후)
cd flutter_app
flutterfire configure
flutter run
```
