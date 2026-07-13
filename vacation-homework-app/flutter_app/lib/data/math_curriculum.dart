/// 6학년 1학기 수학 커리큘럼 시드 데이터 (총 28일)
///
/// 개념 학습 18일 (6개 단원 × 3일) + 혼합 복습 10일 = 28일
/// 교사 대시보드의 "문제 은행 초기화" 버튼으로 mathBank 컬렉션에 업로드한다.
/// 각 일차의 problems는 대표 예시이며, 교사가 문제 은행에서 추가/수정할 수 있다.
library math_curriculum;

const List<Map<String, dynamic>> kMathCurriculumSeed = [
  // ===== 1단원. 분수의 나눗셈 (1~3일차) =====
  {
    'day': 1,
    'unit': '분수의 나눗셈',
    'type': 'concept',
    'problems': [
      {
        'id': 'd01p1',
        'kind': 'shortAnswer',
        'question': '4 ÷ 5 를 분수로 나타내면? (예: 4/5)',
        'answer': '4/5',
      },
      {
        'id': 'd01p2',
        'kind': 'multipleChoice',
        'question': '3 ÷ 7 과 같은 것은?',
        'choices': ['7/3', '3/7', '3×7', '7-3'],
        'answer': '3/7',
      },
    ],
  },
  {
    'day': 2,
    'unit': '분수의 나눗셈',
    'type': 'concept',
    'problems': [
      {
        'id': 'd02p1',
        'kind': 'shortAnswer',
        'question': '6/7 ÷ 2 를 기약분수로 나타내면?',
        'answer': '3/7',
      },
      {
        'id': 'd02p2',
        'kind': 'shortAnswer',
        'question': '8/9 ÷ 4 를 기약분수로 나타내면?',
        'answer': '2/9',
      },
    ],
  },
  {
    'day': 3,
    'unit': '분수의 나눗셈',
    'type': 'concept',
    'problems': [
      {
        'id': 'd03p1',
        'kind': 'shortAnswer',
        'question': '리본 5/6 m를 3명이 똑같이 나누면 한 명이 갖는 길이는? (m, 기약분수)',
        'answer': '5/18',
      },
    ],
  },

  // ===== 2단원. 직육면체의 전개도 (4~6일차) — NetDrawingBoard 사용 =====
  {
    'day': 4,
    'unit': '직육면체의 전개도',
    'type': 'concept',
    'problems': [
      {
        'id': 'd04p1',
        'kind': 'netDrawing',
        'question':
            '한 모서리가 모눈 2칸(60px)인 정육면체의 십자(+) 모양 전개도를 그려 보세요.\n'
            '실선은 자르는 선, 점선은 접는 선입니다.',
        // 30px 모눈 기준 십자형 전개도 (가운데 세로 4면 + 좌우 날개)
        'answerLines': [
          // 세로 기둥 외곽 (실선)
          {'x1': 120, 'y1': 30, 'x2': 180, 'y2': 30, 'type': 0},
          {'x1': 120, 'y1': 30, 'x2': 120, 'y2': 90, 'type': 0},
          {'x1': 180, 'y1': 30, 'x2': 180, 'y2': 90, 'type': 0},
          {'x1': 120, 'y1': 210, 'x2': 120, 'y2': 270, 'type': 0},
          {'x1': 180, 'y1': 210, 'x2': 180, 'y2': 270, 'type': 0},
          {'x1': 120, 'y1': 270, 'x2': 180, 'y2': 270, 'type': 0},
          // 좌우 날개 외곽 (실선)
          {'x1': 60, 'y1': 90, 'x2': 120, 'y2': 90, 'type': 0},
          {'x1': 60, 'y1': 90, 'x2': 60, 'y2': 150, 'type': 0},
          {'x1': 60, 'y1': 150, 'x2': 120, 'y2': 150, 'type': 0},
          {'x1': 180, 'y1': 90, 'x2': 240, 'y2': 90, 'type': 0},
          {'x1': 240, 'y1': 90, 'x2': 240, 'y2': 150, 'type': 0},
          {'x1': 180, 'y1': 150, 'x2': 240, 'y2': 150, 'type': 0},
          {'x1': 120, 'y1': 150, 'x2': 120, 'y2': 210, 'type': 0},
          {'x1': 180, 'y1': 150, 'x2': 180, 'y2': 210, 'type': 0},
          // 접는 선 (점선)
          {'x1': 120, 'y1': 90, 'x2': 180, 'y2': 90, 'type': 1},
          {'x1': 120, 'y1': 150, 'x2': 180, 'y2': 150, 'type': 1},
          {'x1': 120, 'y1': 210, 'x2': 180, 'y2': 210, 'type': 1},
          {'x1': 120, 'y1': 90, 'x2': 120, 'y2': 150, 'type': 1},
          {'x1': 180, 'y1': 90, 'x2': 180, 'y2': 150, 'type': 1},
        ],
      },
    ],
  },
  {
    'day': 5,
    'unit': '직육면체의 전개도',
    'type': 'concept',
    'problems': [
      {
        'id': 'd05p1',
        'kind': 'multipleChoice',
        'question': '직육면체의 전개도에서 서로 마주 보는 면은 몇 쌍인가요?',
        'choices': ['2쌍', '3쌍', '4쌍', '6쌍'],
        'answer': '3쌍',
      },
      {
        'id': 'd05p2',
        'kind': 'netDrawing',
        'question': '가로 3칸(90px) × 세로 2칸(60px) × 높이 1칸(30px) 직육면체의\n'
            'T자형 전개도를 그려 보세요. (교사가 정답 선을 문제 은행에서 편집)',
        'answerLines': [],
      },
    ],
  },
  {
    'day': 6,
    'unit': '직육면체의 전개도',
    'type': 'concept',
    'problems': [
      {
        'id': 'd06p1',
        'kind': 'multipleChoice',
        'question': '전개도를 접었을 때 정육면체가 될 수 없는 것은 모두 몇 개의 면이 겹치기 때문일까요?',
        'choices': ['1개', '2개 이상', '0개', '알 수 없다'],
        'answer': '2개 이상',
      },
    ],
  },

  // ===== 3단원. 소수의 나눗셈 (7~9일차) =====
  {
    'day': 7,
    'unit': '소수의 나눗셈',
    'type': 'concept',
    'problems': [
      {'id': 'd07p1', 'kind': 'shortAnswer', 'question': '6.4 ÷ 2 = ?', 'answer': '3.2'},
      {'id': 'd07p2', 'kind': 'shortAnswer', 'question': '9.6 ÷ 3 = ?', 'answer': '3.2'},
    ],
  },
  {
    'day': 8,
    'unit': '소수의 나눗셈',
    'type': 'concept',
    'problems': [
      {'id': 'd08p1', 'kind': 'shortAnswer', 'question': '7.5 ÷ 5 = ?', 'answer': '1.5'},
      {'id': 'd08p2', 'kind': 'shortAnswer', 'question': '1.28 ÷ 4 = ?', 'answer': '0.32'},
    ],
  },
  {
    'day': 9,
    'unit': '소수의 나눗셈',
    'type': 'concept',
    'problems': [
      {
        'id': 'd09p1',
        'kind': 'shortAnswer',
        'question': '주스 4.8L를 6명이 똑같이 나누어 마시면 한 명이 마시는 양은? (L)',
        'answer': '0.8',
      },
    ],
  },

  // ===== 4단원. 비와 비율 (10~12일차) =====
  {
    'day': 10,
    'unit': '비와 비율',
    'type': 'concept',
    'problems': [
      {
        'id': 'd10p1',
        'kind': 'shortAnswer',
        'question': '남학생 3명과 여학생 5명의 비를 나타내면? (예: 3:5)',
        'answer': '3:5',
      },
    ],
  },
  {
    'day': 11,
    'unit': '비와 비율',
    'type': 'concept',
    'problems': [
      {'id': 'd11p1', 'kind': 'shortAnswer', 'question': '비 3:4 의 비율을 분수로 나타내면?', 'answer': '3/4'},
      {'id': 'd11p2', 'kind': 'shortAnswer', 'question': '비율 0.25를 백분율로 나타내면? (숫자만)', 'answer': '25'},
    ],
  },
  {
    'day': 12,
    'unit': '비와 비율',
    'type': 'concept',
    'problems': [
      {
        'id': 'd12p1',
        'kind': 'shortAnswer',
        'question': '20문제 중 17문제를 맞혔다면 정답률은 몇 %인가요? (숫자만)',
        'answer': '85',
      },
    ],
  },

  // ===== 5단원. 여러 가지 그래프 (13~15일차) =====
  {
    'day': 13,
    'unit': '여러 가지 그래프',
    'type': 'concept',
    'problems': [
      {
        'id': 'd13p1',
        'kind': 'multipleChoice',
        'question': '전체에 대한 각 부분의 비율을 띠 모양으로 나타낸 그래프는?',
        'choices': ['막대그래프', '띠그래프', '꺾은선그래프', '그림그래프'],
        'answer': '띠그래프',
      },
    ],
  },
  {
    'day': 14,
    'unit': '여러 가지 그래프',
    'type': 'concept',
    'problems': [
      {
        'id': 'd14p1',
        'kind': 'multipleChoice',
        'question': '전체에 대한 각 부분의 비율을 원 모양으로 나타낸 그래프는?',
        'choices': ['원그래프', '막대그래프', '꺾은선그래프', '점그래프'],
        'answer': '원그래프',
      },
      {
        'id': 'd14p2',
        'kind': 'shortAnswer',
        'question': '원그래프에서 비율 30%가 차지하는 중심각은 몇 도인가요? (숫자만)',
        'answer': '108',
      },
    ],
  },
  {
    'day': 15,
    'unit': '여러 가지 그래프',
    'type': 'concept',
    'problems': [
      {
        'id': 'd15p1',
        'kind': 'shortAnswer',
        'question': '띠그래프에서 취미가 독서인 학생이 40%일 때, 전체 25명 중 독서를 좋아하는 학생 수는? (명, 숫자만)',
        'answer': '10',
      },
    ],
  },

  // ===== 6단원. 직육면체의 부피와 겉넓이 (16~18일차) =====
  {
    'day': 16,
    'unit': '직육면체의 부피와 겉넓이',
    'type': 'concept',
    'problems': [
      {
        'id': 'd16p1',
        'kind': 'shortAnswer',
        'question': '가로 4cm, 세로 3cm, 높이 2cm 직육면체의 부피는? (cm³, 숫자만)',
        'answer': '24',
      },
    ],
  },
  {
    'day': 17,
    'unit': '직육면체의 부피와 겉넓이',
    'type': 'concept',
    'problems': [
      {
        'id': 'd17p1',
        'kind': 'shortAnswer',
        'question': '한 모서리가 5cm인 정육면체의 겉넓이는? (cm², 숫자만)',
        'answer': '150',
      },
    ],
  },
  {
    'day': 18,
    'unit': '직육면체의 부피와 겉넓이',
    'type': 'concept',
    'problems': [
      {
        'id': 'd18p1',
        'kind': 'shortAnswer',
        'question': '가로 6cm, 세로 4cm, 높이 3cm 직육면체의 겉넓이는? (cm², 숫자만)',
        'answer': '108',
      },
    ],
  },

  // ===== 혼합 복습 (19~28일차, 10일) =====
  {
    'day': 19,
    'unit': '혼합 복습',
    'type': 'review',
    'problems': [
      {'id': 'd19p1', 'kind': 'shortAnswer', 'question': '5 ÷ 8 을 분수로 나타내면?', 'answer': '5/8'},
      {'id': 'd19p2', 'kind': 'shortAnswer', 'question': '8.4 ÷ 7 = ?', 'answer': '1.2'},
    ],
  },
  {
    'day': 20,
    'unit': '혼합 복습',
    'type': 'review',
    'problems': [
      {'id': 'd20p1', 'kind': 'shortAnswer', 'question': '비율 3/5 을 백분율로 나타내면? (숫자만)', 'answer': '60'},
      {'id': 'd20p2', 'kind': 'shortAnswer', 'question': '한 모서리 4cm 정육면체의 부피는? (cm³, 숫자만)', 'answer': '64'},
    ],
  },
  {
    'day': 21,
    'unit': '혼합 복습',
    'type': 'review',
    'problems': [
      {'id': 'd21p1', 'kind': 'shortAnswer', 'question': '9/10 ÷ 3 을 기약분수로?', 'answer': '3/10'},
    ],
  },
  {
    'day': 22,
    'unit': '혼합 복습',
    'type': 'review',
    'problems': [
      {'id': 'd22p1', 'kind': 'shortAnswer', 'question': '12.6 ÷ 6 = ?', 'answer': '2.1'},
      {'id': 'd22p2', 'kind': 'multipleChoice', 'question': '직육면체의 면은 모두 몇 개?', 'choices': ['4개', '6개', '8개', '12개'], 'answer': '6개'},
    ],
  },
  {
    'day': 23,
    'unit': '혼합 복습',
    'type': 'review',
    'problems': [
      {'id': 'd23p1', 'kind': 'shortAnswer', 'question': '전체 50명 중 여학생이 20명일 때 여학생의 비율을 백분율로? (숫자만)', 'answer': '40'},
    ],
  },
  {
    'day': 24,
    'unit': '혼합 복습',
    'type': 'review',
    'problems': [
      {'id': 'd24p1', 'kind': 'shortAnswer', 'question': '가로 5cm, 세로 5cm, 높이 4cm 직육면체의 부피는? (cm³, 숫자만)', 'answer': '100'},
    ],
  },
  {
    'day': 25,
    'unit': '혼합 복습',
    'type': 'review',
    'problems': [
      {'id': 'd25p1', 'kind': 'shortAnswer', 'question': '7/8 ÷ 7 을 기약분수로?', 'answer': '1/8'},
      {'id': 'd25p2', 'kind': 'shortAnswer', 'question': '0.72 ÷ 9 = ?', 'answer': '0.08'},
    ],
  },
  {
    'day': 26,
    'unit': '혼합 복습',
    'type': 'review',
    'problems': [
      {'id': 'd26p1', 'kind': 'shortAnswer', 'question': '원그래프에서 25%가 차지하는 중심각은? (도, 숫자만)', 'answer': '90'},
    ],
  },
  {
    'day': 27,
    'unit': '혼합 복습',
    'type': 'review',
    'problems': [
      {'id': 'd27p1', 'kind': 'shortAnswer', 'question': '비 2:5 의 비율을 소수로 나타내면?', 'answer': '0.4'},
      {'id': 'd27p2', 'kind': 'shortAnswer', 'question': '한 모서리 3cm 정육면체의 겉넓이는? (cm², 숫자만)', 'answer': '54'},
    ],
  },
  {
    'day': 28,
    'unit': '혼합 복습',
    'type': 'review',
    'problems': [
      {'id': 'd28p1', 'kind': 'shortAnswer', 'question': '10.5 ÷ 5 = ?', 'answer': '2.1'},
      {'id': 'd28p2', 'kind': 'shortAnswer', 'question': '4/5 ÷ 2 를 기약분수로?', 'answer': '2/5'},
      {'id': 'd28p3', 'kind': 'shortAnswer', 'question': '가로 8cm, 세로 2cm, 높이 3cm 직육면체의 부피는? (cm³, 숫자만)', 'answer': '48'},
    ],
  },
];
