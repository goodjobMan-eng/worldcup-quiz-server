/* NATIONLAB 수업 설정. Firebase 웹 설정값만 입력하세요. 비밀키는 넣지 마세요. */
globalThis.NATIONLAB_CONFIG = {
  title: "NATIONLAB",
  subtitle: "우리 교실의 작은 세계",
  firebase: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    appId: "",
  },
  emulator: {
    enabled: false,
    host: "127.0.0.1",
    authPort: 9099,
    databasePort: 9000,
  },
  // 교육지원청 명칭·관할 변경은 이 목록에서 수정하세요. 세종은 본청 직영입니다.
  educationRegions: [
  {
    "id": "seoul",
    "name": "서울특별시교육청",
    "short": "서울",
    "lat": 37.57,
    "lon": 126.98,
    "color": "#7ca6bd",
    "districts": [
      "동부",
      "서부",
      "남부",
      "북부",
      "중부",
      "강동송파",
      "강서양천",
      "강남서초",
      "동작관악",
      "성동광진",
      "성북강북"
    ]
  },
  {
    "id": "busan",
    "name": "부산광역시교육청",
    "short": "부산",
    "lat": 35.18,
    "lon": 129.08,
    "color": "#79b7bd",
    "districts": [
      "서부",
      "남부",
      "북부",
      "동래",
      "해운대"
    ]
  },
  {
    "id": "daegu",
    "name": "대구광역시교육청",
    "short": "대구",
    "lat": 35.87,
    "lon": 128.6,
    "color": "#cf9b75",
    "districts": [
      "동부",
      "서부",
      "남부",
      "달성",
      "군위"
    ]
  },
  {
    "id": "incheon",
    "name": "인천광역시교육청",
    "short": "인천",
    "lat": 37.46,
    "lon": 126.71,
    "color": "#8b9bbd",
    "districts": [
      "남부",
      "북부",
      "동부",
      "서부",
      "강화"
    ]
  },
  {
    "id": "gwangju",
    "name": "광주광역시교육청",
    "short": "광주",
    "lat": 35.16,
    "lon": 126.85,
    "color": "#b99cbb",
    "districts": [
      "동부",
      "서부"
    ]
  },
  {
    "id": "daejeon",
    "name": "대전광역시교육청",
    "short": "대전",
    "lat": 36.35,
    "lon": 127.38,
    "color": "#caab6b",
    "districts": [
      "동부",
      "서부"
    ]
  },
  {
    "id": "ulsan",
    "name": "울산광역시교육청",
    "short": "울산",
    "lat": 35.54,
    "lon": 129.31,
    "color": "#91b4a6",
    "districts": [
      "강북",
      "강남"
    ]
  },
  {
    "id": "sejong",
    "name": "세종특별자치시교육청",
    "short": "세종",
    "lat": 36.48,
    "lon": 127.29,
    "color": "#b1b974",
    "districts": [
      "본청 직영"
    ]
  },
  {
    "id": "gyeonggi",
    "name": "경기도교육청",
    "short": "경기",
    "lat": 37.3,
    "lon": 127.25,
    "color": "#8cac70",
    "districts": [
      "수원",
      "성남",
      "의정부",
      "안양과천",
      "부천",
      "광명",
      "동두천양주",
      "안산",
      "평택",
      "군포의왕",
      "여주",
      "화성오산",
      "광주하남",
      "연천",
      "포천",
      "가평",
      "양평",
      "이천",
      "용인",
      "안성",
      "김포",
      "시흥",
      "고양",
      "구리남양주",
      "파주"
    ]
  },
  {
    "id": "gangwon",
    "name": "강원특별자치도교육청",
    "short": "강원",
    "lat": 37.82,
    "lon": 128.2,
    "color": "#6fa695",
    "districts": [
      "춘천",
      "원주",
      "강릉",
      "속초양양",
      "동해",
      "태백",
      "삼척",
      "홍천",
      "횡성",
      "영월",
      "평창",
      "정선",
      "철원",
      "화천",
      "양구",
      "인제",
      "고성"
    ]
  },
  {
    "id": "chungbuk",
    "name": "충청북도교육청",
    "short": "충북",
    "lat": 36.8,
    "lon": 127.7,
    "color": "#a9b67b",
    "districts": [
      "청주",
      "충주",
      "제천",
      "보은",
      "옥천",
      "영동",
      "진천",
      "괴산증평",
      "음성",
      "단양"
    ]
  },
  {
    "id": "chungnam",
    "name": "충청남도교육청",
    "short": "충남",
    "lat": 36.55,
    "lon": 126.8,
    "color": "#c6b779",
    "districts": [
      "천안",
      "공주",
      "보령",
      "아산",
      "서산",
      "논산계룡",
      "당진",
      "금산",
      "부여",
      "서천",
      "청양",
      "홍성",
      "예산",
      "태안"
    ]
  },
  {
    "id": "jeonbuk",
    "name": "전북특별자치도교육청",
    "short": "전북",
    "lat": 35.8,
    "lon": 127.13,
    "color": "#b5bc84",
    "districts": [
      "전주",
      "군산",
      "익산",
      "정읍",
      "남원",
      "김제",
      "완주",
      "진안",
      "무주",
      "장수",
      "임실",
      "순창",
      "고창",
      "부안"
    ]
  },
  {
    "id": "jeonnam",
    "name": "전라남도교육청",
    "short": "전남",
    "lat": 34.85,
    "lon": 126.95,
    "color": "#81b59d",
    "districts": [
      "목포",
      "여수",
      "순천",
      "나주",
      "광양",
      "담양",
      "곡성",
      "구례",
      "고흥",
      "보성",
      "화순",
      "장흥",
      "강진",
      "해남",
      "영암",
      "무안",
      "함평",
      "영광",
      "장성",
      "완도",
      "진도",
      "신안"
    ]
  },
  {
    "id": "gyeongbuk",
    "name": "경상북도교육청",
    "short": "경북",
    "lat": 36.3,
    "lon": 128.8,
    "color": "#9fb57e",
    "districts": [
      "포항",
      "경주",
      "김천",
      "안동",
      "구미",
      "영주",
      "영천",
      "상주",
      "문경",
      "경산",
      "의성",
      "청송",
      "영양",
      "영덕",
      "청도",
      "고령",
      "성주",
      "칠곡",
      "예천",
      "봉화",
      "울진",
      "울릉"
    ]
  },
  {
    "id": "gyeongnam",
    "name": "경상남도교육청",
    "short": "경남",
    "lat": 35.35,
    "lon": 128.25,
    "color": "#9abd9e",
    "districts": [
      "창원",
      "진주",
      "통영",
      "사천",
      "김해",
      "밀양",
      "거제",
      "양산",
      "의령",
      "함안",
      "창녕",
      "고성",
      "남해",
      "하동",
      "산청",
      "함양",
      "거창",
      "합천"
    ]
  },
  {
    "id": "jeju",
    "name": "제주특별자치도교육청",
    "short": "제주",
    "lat": 33.38,
    "lon": 126.55,
    "color": "#90bfb4",
    "districts": [
      "제주시",
      "서귀포시"
    ]
  }
],
  rounds: 6,
  stamina: 15,
  maxStudents: 40,
  minStudents: 3,
  phaseSeconds: { meeting: 60, activity: 300, settlement: 120 },
  map: { width: 20, height: 14 },
  goods: {
    wood: { name: "나무", color: "#967043", raw: true },
    stone: { name: "돌", color: "#83939e", raw: true },
    cotton: { name: "목화", color: "#f0ddd4", raw: true },
    iron: { name: "철광석", color: "#ba8260", raw: true },
    oil: { name: "석유", color: "#51435e", raw: true },
    sand: { name: "모래", color: "#eccb80", raw: true },
    brick: { name: "벽돌", color: "#c5755b" },
    plank: { name: "판자", color: "#caa073" },
    cloth: { name: "천", color: "#a9c8dc" },
    glass: { name: "유리", color: "#8fd4d4" },
    plate: { name: "철판", color: "#b4bcc9" },
  },
  facilities: {
    bench: "작업대",
    loom: "직조기",
    kiln: "유리가마",
    furnace: "용광로",
  },
  recipes: {
    brick: { inputs: { stone: 2 }, facility: "bench", output: 1 },
    plank: { inputs: { wood: 1 }, facility: "bench", output: 2 },
    cloth: { inputs: { cotton: 2 }, facility: "loom", output: 1 },
    glass: { inputs: { sand: 2, oil: 1 }, facility: "kiln", output: 1 },
    plate: { inputs: { iron: 2, oil: 1 }, facility: "furnace", output: 1 },
  },
  countries: [
    {
      id: "hualian",
      name: "화련 연방",
      short: "화련",
      biome: "평원과 광산",
      color: "#ec9762",
      land: "#91b691",
      weight: 5,
      gold: 200,
      facilities: ["bench", "loom"],
      regen: { cotton: 4, iron: 6, stone: 6 },
      building: {
        name: "강 위의 다리",
        needs: { plate: 6, brick: 6, plank: 4 },
      },
    },
    {
      id: "sahar",
      name: "사하르 왕국",
      short: "사하르",
      biome: "사막과 유전",
      color: "#d4b258",
      land: "#d9ba79",
      weight: 3,
      gold: 300,
      facilities: ["bench", "kiln"],
      regen: { oil: 8, sand: 8 },
      building: {
        name: "모래 위의 학교",
        needs: { glass: 6, brick: 6, cloth: 4, plank: 4 },
      },
    },
    {
      id: "hinomi",
      name: "히노미 섬나라",
      short: "히노미",
      biome: "숲과 바닷가",
      color: "#8cbcaf",
      land: "#73a888",
      weight: 2,
      gold: 400,
      facilities: ["bench", "furnace", "kiln"],
      regen: { wood: 4, stone: 5 },
      building: {
        name: "바닷가 병원",
        needs: { plate: 4, glass: 4, brick: 4, cloth: 2 },
      },
    },
  ],
  events: [
    {
      id: "none",
      name: "평온한 하루",
      description: "자원과 항구가 평소처럼 운영돼요.",
    },
    {
      id: "storm",
      name: "폭풍",
      description: "선택한 나라의 항구가 이번 라운드 닫혀요.",
    },
    {
      id: "harvest",
      name: "풍년",
      description: "선택한 원료가 이번 라운드 두 배 생겨요.",
    },
    {
      id: "depletion",
      name: "광산 고갈",
      description: "선택한 원료가 이번 라운드 생기지 않아요.",
    },
    {
      id: "technology",
      name: "새 기술",
      description: "선택한 나라에 가공 시설이 추가돼요.",
    },
    {
      id: "border",
      name: "국경 닫힘",
      description: "모든 나라의 항구가 이번 라운드 닫혀요.",
    },
  ],
  reflections: {
    first: ["다른 나라와 교류할 수 없어서 어떤 점이 불편했나요?"],
    regular: [
      "우리 나라에 없어서 다른 나라에서 얻어 온 것은 무엇인가요?",
      "우리가 다른 나라에 준 것은 무엇이고, 그 나라에 도움이 되었나요?",
      "이번 거래는 두 나라 모두에게 이익이었나요? 그렇게 생각한 까닭은?",
    ],
  },
};


/* 샌드박스 수업: 아래 숫자와 나라·설계도를 교사가 조절할 수 있습니다. */
globalThis.NATIONLAB_CONFIG.experience = "sandbox";
globalThis.NATIONLAB_CONFIG.sandbox = {
  size: 64, height: 32, activeNations: ["hualian", "hinomi", "sahar", "lumina"],
  totalLessons: 8, lessonMinutes: 40, maxStudents: 40,
  stamina: {max: 24, intervalSeconds: 60, refill: 3}, resourceSeconds: 180,
  plot: {size: 5, height: 4}, freePlot: {size:16,height:16},
  materials: {kinds:5, importedKinds:3, processedKinds:1},
  bridge: {plank:12, masonry:6},
  harbor: {plank:20, masonry:10, plate:4, glass:4, cloth:4, brick:8},
  tools: {axe:{name:"도끼",cost:{wood:2,stone:2}},pickaxe:{name:"곡괭이",cost:{wood:2,stone:3}}},
  goods: {
    wood:{name:"나무",color:"#967043",raw:true},stone:{name:"돌",color:"#8898a1",raw:true},
    cotton:{name:"목화",color:"#eee3d4",raw:true},iron:{name:"철광석",color:"#ac7353",raw:true,tool:"pickaxe"},
    oil:{name:"석유",color:"#494352",raw:true},sand:{name:"모래",color:"#dec17f",raw:true},
    clay:{name:"점토",color:"#b77763",raw:true},copper:{name:"구리",color:"#be8d54",raw:true,tool:"pickaxe"},
    plank:{name:"판자",color:"#cda476"},masonry:{name:"석재",color:"#9baaad"},cloth:{name:"천",color:"#b3bedc"},
    brick:{name:"붉은 벽돌",color:"#bf6951"},plate:{name:"철판",color:"#b7c7cf"},glass:{name:"유리",color:"#85d9d2"},copperplate:{name:"구리판",color:"#dc9e68"}
  },
  technologies:{weaving:"직조",kiln:"가마",steel:"제철",glass:"유리",metal:"금속 세공"},
  recipes:{
    plank:{inputs:{wood:1},output:2},masonry:{inputs:{stone:1},output:1},
    cloth:{inputs:{cotton:2},output:1,technology:"weaving"},brick:{inputs:{clay:2},output:1,technology:"kiln"},
    plate:{inputs:{iron:2,oil:1},output:1,technology:"steel"},glass:{inputs:{sand:2,oil:1},output:1,technology:"glass"},
    copperplate:{inputs:{copper:2},output:1,technology:"metal"}
  },
  templates:[
    {id:"hualian",name:"화련 연방",short:"화련",color:"#db9568",biome:"평원",weight:5,specialties:{iron:12,cotton:14},technologies:["weaving"]},
    {id:"indra",name:"인드라 연합",short:"인드라",color:"#c58c86",biome:"습지",weight:5,specialties:{clay:14,cotton:12},technologies:["kiln"]},
    {id:"hinomi",name:"히노미 섬나라",short:"히노미",color:"#8ab7a8",biome:"숲",weight:2,specialties:{clay:8},technologies:["steel","glass"]},
    {id:"beloa",name:"벨로아 연합",short:"벨로아",color:"#ac9bbd",biome:"언덕",weight:3,specialties:{copper:8},technologies:["metal","weaving"]},
    {id:"sahar",name:"사하르 왕국",short:"사하르",color:"#d1b266",biome:"사막",weight:3,specialties:{oil:16,sand:18},technologies:[]},
    {id:"lumina",name:"루미나 연방",short:"루미나",color:"#90aacb",biome:"광산",weight:2,specialties:{iron:12,copper:12},technologies:[]}
  ],
  commonResources:{wood:32,stone:28},
  blueprints:[
    {id:"garden",name:"계단 정원",heights:[[0,0,0,0,0],[0,1,2,1,0],[0,2,3,2,0],[0,1,2,1,0],[0,0,0,0,0]]},
    {id:"gate",name:"언덕 전망대",heights:[[0,0,0,0,0],[0,3,1,3,0],[0,1,2,1,0],[0,1,1,1,0],[0,0,0,0,0]]},
    {id:"steps",name:"나눔 계단",heights:[[0,0,0,0,0],[0,1,1,1,0],[0,1,2,2,0],[0,1,2,3,0],[0,0,0,0,0]]}
  ],
  cheers:["멋져요","우리 나라 블록이 들어 있어요","다른 모습도 궁금해요"],
  signals:["판자가 필요해요","교역소로 와 주세요","기술자를 초청하고 싶어요","계획판을 함께 봐 주세요"],
  reflections:{
    1:["다리가 없을 때 우리 나라는 무엇이 불편했나요?","다리가 생긴 뒤 무엇이 달라졌나요?"],
    2:["우리 랜드마크에 들어간 다른 나라의 것은 무엇인가요?","그 거래는 두 나라 모두에게 이익이었나요?"],
    3:["다른 반과 교역하며 우리가 얻은 것과 준 것은 무엇인가요?","무역이 없다면 우리 섬은 어땠을까요?"]
  }
};
