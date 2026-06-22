export interface Country {
  id: number;
  name: string;
  continent: string;
  hint1: string;
  hint2: string;
  hint3: string;
  hint4Range: string;
  lat: number;
  lng: number;
}

export const COUNTRIES: Country[] = [
  {
    id: 1,
    name: "일본",
    continent: "아시아",
    hint1: "아시아 정상급 강호",
    hint2: "스시, 애니메이션, 게임 산업",
    hint3: "인구 약 1억 2300만, 기술 선진국",
    hint4Range: "북위 24°~46°, 동경 122°~146°",
    lat: 36.2,
    lng: 138.2
  },
  {
    id: 2,
    name: "아르헨티나",
    continent: "남미",
    hint1: "최정상급 우승후보",
    hint2: "탱고의 고장, 리오넬 메시",
    hint3: "이과수 폭포, 소고기 대국",
    hint4Range: "남위 21°~55°, 서경 53°~74°",
    lat: -38.4,
    lng: -63.6
  },
  {
    id: 3,
    name: "프랑스",
    continent: "유럽",
    hint1: "세계적 축구 초강대국",
    hint2: "에펠탑, 루브르 박물관, 시민혁명 역사",
    hint3: "패션·예술·미식 중심지, 서유럽 선진국",
    hint4Range: "북위 41°~51°, 서경 5°~동경 9°",
    lat: 46.2,
    lng: 2.2
  },
  {
    id: 4,
    name: "멕시코",
    continent: "북중미",
    hint1: "북중미 전통 강호이자 본선 개최국",
    hint2: "마야·아즈텍 문명 고대 유적, 타코",
    hint3: "인구 약 1억 2800만, 스페인어 최대 사용국",
    hint4Range: "북위 14°~32°, 서경 86°~118°",
    lat: 23.6,
    lng: -102.5
  },
  {
    id: 5,
    name: "남아공",
    continent: "아프리카",
    hint1: "아프리카의 복병",
    hint2: "넬슨 만델라 대통령, 무지개 나라",
    hint3: "아프리카 경제 대국, 11개 공식 언어 사용",
    hint4Range: "남위 22°~35°, 동경 16°~33°",
    lat: -30.5,
    lng: 22.9
  },
  {
    id: 6,
    name: "호주",
    continent: "오세아니아",
    hint1: "캥거루와 코알라, 쿼카",
    hint2: "오페라 하우스",
    hint3: "인구 약 2600만, 광물 자원 및 낙농업 대국",
    hint4Range: "남위 10°~39°, 동경 113°~153°",
    lat: -25.2,
    lng: 133.7
  },
  {
    id: 7,
    name: "이란",
    continent: "아시아",
    hint1: "통곡의 벽이라 불리는 아시아 정통 강호",
    hint2: "페르시아 제국의 후손, 양탄자 공예",
    hint3: "페르시아어 사용, 시아파 이슬람교 중심, 석유 자원 풍부",
    hint4Range: "북위 25°~40°, 동경 44°~63°",
    lat: 32.4,
    lng: 53.6
  },
  {
    id: 8,
    name: "콜롬비아",
    continent: "남미",
    hint1: "남미의 자존심이자 강력한 축구 스타일",
    hint2: "열정적인 살사 음악과 춤 문화",
    hint3: "안데스 산맥 고산 대도시 발달, 세계적인 커피 생산국",
    hint4Range: "남위 4°~북위 13°, 서경 66°~79°",
    lat: 4.5,
    lng: -72.9
  },
  {
    id: 9,
    name: "독일",
    continent: "유럽",
    hint1: "전차군단이라 불리는 전통의 축구 강호",
    hint2: "베토벤과 바흐의 고향, 분단과 통일의 역사",
    hint3: "인구 약 8400만, 명품 자동차 산업 강국",
    hint4Range: "북위 47°~55°, 동경 5°~15°",
    lat: 51.1,
    lng: 10.4
  },
  {
    id: 10,
    name: "미국",
    continent: "북중미",
    hint1: "북중미의 맹주이자 본선 공동 개최국",
    hint2: "자유의 여신상, 할리우드 영화 산업",
    hint3: "인구 약 3억 4천만, 세계 1위의 경제 대국",
    hint4Range: "북위 24°~49°, 서경 66°~125°",
    lat: 37.0,
    lng: -95.7
  },
  {
    id: 11,
    name: "모로코",
    continent: "아프리카",
    hint1: "아프리카 대륙 최강의 축구 전력",
    hint2: "이슬람과 유럽의 복합 문화, 사하라 사막 탐험",
    hint3: "아랍어 사용, 북아프리카 최고의 관광 대국",
    hint4Range: "북위 27°~36°, 서경 1°~13°",
    lat: 31.7,
    lng: -7.0
  },
  {
    id: 12,
    name: "뉴질랜드",
    continent: "오세아니아",
    hint1: "오세아니아 대륙을 대표하는 팀",
    hint2: "마오리족의 하카 춤, 영화 반지의 제왕 촬영지",
    hint3: "인구 약 510만, 청정 자연 기반 낙농업 발달",
    hint4Range: "남위 34°~47°, 동경 166°~178°",
    lat: -40.9,
    lng: 174.8
  },
  {
    id: 13,
    name: "우즈베키스탄",
    continent: "아시아",
    hint1: "역사상 최초로 본선 진출에 성공한 돌풍의 다크호스",
    hint2: "실크로드의 중심지, 사마르칸트의 푸른 도성",
    hint3: "중앙아시아 최대 인구 보유국, 전통 화덕 빵 '논'",
    hint4Range: "북위 37°~46°, 동경 56°~73°",
    lat: 41.3,
    lng: 64.5
  },
  {
    id: 14,
    name: "브라질",
    continent: "남미",
    hint1: "역대 최다 우승 기록을 가진 영원한 축구 왕국",
    hint2: "정열적인 삼바 축제와 리오 카니발",
    hint3: "인구 2억 명 초과, 포르투갈어 사용, 세계의 허파 아마존 열대우림",
    hint4Range: "남위 34°~북위 5°, 서경 34°~74°",
    lat: -14.2,
    lng: -51.9
  },
  {
    id: 15,
    name: "잉글랜드",
    continent: "유럽",
    hint1: "세계 최고 리그 EPL의 본고장이자 축구의 고향",
    hint2: "셰익스피어의 문학, 비틀즈의 음악, 산업혁명의 시작점",
    hint3: "인구 약 5700만, 전 세계 공용어인 영어의 발상지",
    hint4Range: "북위 49°~55°, 서경 6°~동경 1°",
    lat: 52.3,
    lng: -1.1
  },
  {
    id: 16,
    name: "캐나다",
    continent: "북중미",
    hint1: "탄탄한 스쿼드를 자랑하는 북중미 다크호스이자 본선 공동 개최국",
    hint2: "단풍나무 메이플 시럽, 동계스포츠 아이스하키",
    hint3: "세계 영토 면적 2위, 영어와 프랑스어 공동 공용어 지정",
    hint4Range: "북위 41°~83°, 서경 52°~141°",
    lat: 56.1,
    lng: -106.3
  },
  {
    id: 17,
    name: "세네갈",
    continent: "아프리카",
    hint1: "서아프리카를 대표하는 축구 전통 강호",
    hint2: "손님을 지극히 대접하는 테랑가 문화, 전통 드럼 음악",
    hint3: "프랑스어 공용어 사용, 전체 인구의 90% 이상이 이슬람교",
    hint4Range: "북위 12°~17°, 서경 11°~18°",
    lat: 14.4,
    lng: -14.4
  },
  {
    id: 18,
    name: "우루과이",
    continent: "남미",
    hint1: "탄탄한 수비와 역습을 자랑하는 남미의 복병",
    hint2: "국민 전통차 마테차 문화, 제1회 월드컵 개최 및 우승국",
    hint3: "인구 약 340만의 소국이지만 안정된 복지 시스템 구축",
    hint4Range: "남위 30°~35°, 서경 53°~58°",
    lat: -32.5,
    lng: -55.7
  },
  {
    id: 19,
    name: "체코",
    continent: "유럽",
    hint1: "유럽 축구의 숨은 복병",
    hint2: "아름다운 수도 프라하, 세계 1위의 1인당 맥주 소비량",
    hint3: "인구 약 1050만, 제조업 중심의 동유럽 신흥 경제 강소국",
    hint4Range: "북위 48°~51°, 동경 12°~19°",
    lat: 49.8,
    lng: 15.4
  },
  {
    id: 20,
    name: "스페인",
    continent: "유럽",
    hint1: "정교한 패스 축구 티키타카의 대명사 무적함대",
    hint2: "정열적인 플라멩코와 투우, 천재 건축가 가우디",
    hint3: "가톨릭 문화 중심, 남유럽의 주요 경제 선진국",
    hint4Range: "북위 36°~44°, 서경 9°~동경 4°",
    lat: 40.4,
    lng: -3.7
  }
];

export const WORLD_MAP_POLYGONS = [
  // 아시아 + 유럽 + 아프리카 (크게 연결된 유라시아프리카)
  [
    { lat: 70, lng: -10 }, { lat: 75, lng: 20 }, { lat: 75, lng: 60 }, { lat: 70, lng: 160 }, { lat: 60, lng: 175 },
    { lat: 40, lng: 145 }, { lat: 35, lng: 140 }, { lat: 20, lng: 120 }, { lat: 10, lng: 110 }, { lat: 1, lng: 103 },
    { lat: 5, lng: 95 }, { lat: 20, lng: 75 }, { lat: 10, lng: 75 }, { lat: 15, lng: 40 }, { lat: 5, lng: 45 }, 
    { lat: -34, lng: 19 }, { lat: -34, lng: 26 }, { lat: -15, lng: 40 }, { lat: 5, lng: 9 }, { lat: 15, lng: -17 }, 
    { lat: 25, lng: -15 }, { lat: 35, lng: -6 }, { lat: 45, lng: -10 }, { lat: 60, lng: -5 }, { lat: 70, lng: -10 }
  ],
  // 아프리카 디테일 추가독립선
  [
    { lat: 35, lng: -6 }, { lat: 32, lng: 32 }, { lat: 12, lng: 43 }, { lat: 11, lng: 51 }, { lat: -34, lng: 20 }, 
    { lat: -15, lng: 12 }, { lat: 5, lng: 9 }, { lat: 15, lng: -17 }, { lat: 35, lng: -6 }
  ],
  // 북미
  [
    { lat: 72, lng: -168 }, { lat: 70, lng: -60 }, { lat: 50, lng: -55 }, { lat: 25, lng: -80 }, { lat: 9, lng: -79 }, 
    { lat: 16, lng: -95 }, { lat: 20, lng: -105 }, { lat: 33, lng: -120 }, { lat: 48, lng: -125 }, { lat: 60, lng: -140 },
    { lat: 72, lng: -168 }
  ],
  // 남미
  [
    { lat: 12, lng: -72 }, { lat: 8, lng: -55 }, { lat: -5, lng: -35 }, { lat: -53, lng: -68 }, { lat: -53, lng: -74 },
    { lat: -18, lng: -70 }, { lat: -5, lng: -81 }, { lat: 5, lng: -77 }, { lat: 12, lng: -72 }
  ],
  // 호주
  [
    { lat: -11, lng: 131 }, { lat: -11, lng: 142 }, { lat: -24, lng: 153 }, { lat: -38, lng: 145 }, 
    { lat: -35, lng: 115 }, { lat: -21, lng: 114 }, { lat: -11, lng: 131 }
  ],
  // 그린란드
  [
    { lat: 80, lng: -65 }, { lat: 82, lng: -10 }, { lat: 70, lng: -20 }, { lat: 60, lng: -45 }, { lat: 60, lng: -60 }, { lat: 80, lng: -65 }
  ],
  // 영국 섬 (잉글랜드)
  [
    { lat: 58, lng: -6 }, { lat: 58, lng: -2 }, { lat: 55, lng: -1 }, { lat: 51, lng: 1 }, { lat: 50, lng: -5 }, { lat: 55, lng: -6 }, { lat: 58, lng: -6 }
  ]
];
