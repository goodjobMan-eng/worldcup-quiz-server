import type { Classroom } from "./servers";
export type Config = any;
export type Position = { x: number; y: number };
export type Unit = {
  id: string;
  good: string;
  sources: Record<string, Record<string, number>>;
  processor?: string;
};
export type Player = {
  id: string;
  nickname: string;
  country: string;
  stamina: number;
};
export type Node = Position & { id: string; good: string };
export type Site = Position & { id: string; good: string; unit?: Unit };
export type Country = {
  gold: number;
  stock: Record<string, Unit[]>;
  nodes: Record<string, Node>;
  sites: Record<string, Site>;
  facilities: Record<string, Position>;
};
export type Basket = { goods: Record<string, number>; gold: number };
export type Offer = {
  id: string;
  from: string;
  to: string;
  give: Basket;
  receive: Basket;
  round: number;
  status: string;
  votes: Record<string, boolean>;
  counterOf?: string;
};
export type Event = {
  id: string;
  country: string;
  good: string;
  facility: string;
};
export type World = {
  classroom?: Classroom;
  version: number;
  code: string;
  teacher: string;
  config: Config;
  round: number;
  phase: string;
  phaseEnd: number;
  players: Record<string, Player>;
  countries: Record<string, Country>;
  offers: Record<string, Offer>;
  reflections: Record<
    string,
    Record<string, { answers: string[]; country: string; nickname: string }>
  >;
  logs: { id: string; text: string; round: number; at: number }[];
  trades: {
    id: string;
    round: number;
    from: string;
    to: string;
    give: Basket;
    receive: Basket;
    at: number;
  }[];
  event: Event;
  pendingEvent: Event;
  revision: number;
  lastAction: { actor: string; type: string; at: number };
  undo?: any;
};
export type Command = { type: string; [key: string]: any };
export const config = () => (globalThis as any).NATIONLAB_CONFIG;
const copy = <T>(v: T): T => structuredClone(v);
export function normalize(raw: World): World {
  const w = copy(raw);
  w.players ||= {};
  w.offers ||= {};
  w.reflections ||= {};
  w.logs ||= [];
  w.trades ||= [];
  for (const c of Object.values(w.countries)) {
    c.stock ||= {};
    c.nodes ||= {};
    c.sites ||= {};
    c.facilities ||= {};
    for (const g of Object.keys(w.config.goods)) c.stock[g] ||= [];
  }
  for (const o of Object.values(w.offers)) {
    o.votes ||= {};
    o.give.goods ||= {};
    o.receive.goods ||= {};
  }
  return w;
}
export function createWorld(
  code: string,
  teacher: string,
  cfg = config(),
): World {
  validateConfig(cfg);
  const countries: World["countries"] = {};
  for (const c of cfg.countries) {
    const sites: Record<string, Site> = {};
    let k = 0;
    for (const [good, n] of Object.entries(c.building.needs))
      for (let i = 0; i < Number(n); i++) {
        const id = `site-${k}`;
        sites[id] = { id, good, x: 11 + (k % 4), y: 4 + Math.floor(k / 4) };
        k++;
      }
    const facilities: Country["facilities"] = {};
    c.facilities.forEach(
      (f: string, i: number) => (facilities[f] = { x: 4 + i * 2, y: 4 }),
    );
    countries[c.id] = {
      gold: c.gold,
      stock: Object.fromEntries(Object.keys(cfg.goods).map((g) => [g, []])),
      nodes: {},
      sites,
      facilities,
    };
  }
  const event = {
    id: "none",
    country: cfg.countries[0].id,
    good: Object.keys(cfg.goods)[0],
    facility: "furnace",
  };
  return {
    version: 2,
    code,
    teacher,
    config: copy(cfg),
    round: 0,
    phase: "lobby",
    phaseEnd: 0,
    players: {},
    countries,
    offers: {},
    reflections: {},
    logs: [],
    trades: [],
    event,
    pendingEvent: copy(event),
    revision: 0,
    lastAction: { actor: teacher, type: "create", at: Date.now() },
  };
}
export function validateConfig(c: Config) {
  if (c?.countries?.length !== 3)
    throw Error("1차 프로토타입은 3개 나라 설정이 필요해요.");
  if (c.map.width < 20 || c.map.height < 14)
    throw Error("지도는 최소 20×14로 설정해 주세요.");
  if (c.stamina < 1 || c.rounds < 1)
    throw Error("체력과 라운드는 1 이상이어야 해요.");
  for (const n of c.countries)
    if (
      Object.values(n.building.needs as Record<string, number>).reduce(
        (s: number, v: number) => s + v,
        0,
      ) > 24
    )
      throw Error("건축 목표는 현재 지도에서 24칸까지 가능해요.");
}
export function progress(w: World, id: string) {
  const sites = Object.values(w.countries[id].sites);
  return sites.length ? sites.filter((s) => s.unit).length / sites.length : 0;
}
export function worldProgress(w: World) {
  return (
    w.config.countries.reduce((s: number, c: any) => s + progress(w, c.id), 0) /
    w.config.countries.length
  );
}
export function port(w: World): Position {
  return { x: w.config.map.width - 3, y: 9 };
}
export function isLand(w: World, x: number, y: number) {
  return (
    x >= 2 &&
    x < w.config.map.width - 2 &&
    y >= 2 &&
    y < w.config.map.height - 2 &&
    !(x === 2 && y === 2) &&
    !(x === w.config.map.width - 3 && y === 2)
  );
}
export function spawn(w: World, id: string): Position {
  const p = w.players[id];
  const team = Object.values(w.players).filter(
    (other) => other.country === p?.country,
  );
  const i = Math.max(
    0,
    team.findIndex((other) => other.id === id),
  );
  return { x: 3 + (i % 12), y: 10 + (Math.floor(i / 12) % 2) };
}
export function adjacent(a: Position, b: Position) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) <= 1;
}
export function blockers(w: World, id: string) {
  const c = w.countries[id];
  return [...Object.values(c.nodes), ...Object.values(c.facilities)];
}
export function walkable(w: World, id: string, p: Position) {
  return (
    isLand(w, p.x, p.y) &&
    !blockers(w, id).some((t) => t.x === p.x && t.y === p.y)
  );
}
export function pathTo(
  w: World,
  id: string,
  start: Position,
  target: Position,
) {
  const queue = [start],
    parent = new Map<string, Position | null>([
      [`${start.x},${start.y}`, null],
    ]);
  let end: Position | undefined;
  const solid = !walkable(w, id, target);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (solid ? adjacent(p, target) : p.x === target.x && p.y === target.y) {
      end = p;
      break;
    }
    for (const d of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const n = { x: p.x + d[0], y: p.y + d[1] },
        key = `${n.x},${n.y}`;
      if (walkable(w, id, n) && !parent.has(key)) {
        queue.push(n);
        parent.set(key, p);
      }
    }
  }
  if (!end) return [];
  const route: Position[] = [];
  for (
    let p: Position | null = end;
    p && !(p.x === start.x && p.y === start.y);
    p = parent.get(`${p.x},${p.y}`) || null
  )
    route.unshift(p);
  return route;
}
export function tradeClosed(w: World, id: string) {
  if (w.round === 1)
    return "1라운드는 국경이 닫혀 있어요. 2라운드부터 교역할 수 있어요.";
  if (w.event.id === "border")
    return "국경 닫힘 이벤트로 모든 항구가 닫혔어요.";
  if (w.event.id === "storm" && w.event.country === id)
    return "폭풍 때문에 이 나라 항구가 이번 라운드 닫혔어요.";
  return "";
}
function regenerate(w: World) {
  for (const spec of w.config.countries) {
    const c = w.countries[spec.id];
    c.nodes = {};
    const reserved = [
      ...Object.values(c.facilities),
      ...Object.values(c.sites),
      port(w),
      { x: 4, y: 10 },
      { x: 5, y: 10 },
    ];
    const slots: Position[] = [];
    for (let y = 3; y < w.config.map.height - 3; y++)
      for (let x = 3; x < w.config.map.width - 3; x++)
        if (
          !reserved.some((p) => p.x === x && p.y === y) &&
          !(y === 5 || y === 9 || x === 9 || x === 10)
        )
          slots.push({ x, y });
    let cursor = 0;
    for (const [good, base] of Object.entries(spec.regen)) {
      let n = Number(base);
      if (w.event.good === good) {
        if (w.event.id === "harvest") n *= 2;
        if (w.event.id === "depletion") n = 0;
      }
      for (let k = 0; k < n; k++) {
        const pos = slots[cursor++];
        if (!pos)
          throw Error(
            "재생성량이 지도보다 많아요. config.js의 수량을 줄여주세요.",
          );
        const id = `r${w.round}-${good}-${k}`;
        c.nodes[id] = { id, good, ...pos };
      }
    }
  }
}
function log(w: World, text: string, id: string, now: number) {
  w.logs.unshift({ id, text, round: w.round, at: now });
  w.logs = w.logs.slice(0, 100);
}
function basket(w: World, b: Basket) {
  if (!b || !Number.isInteger(b.gold) || b.gold < 0 || b.gold > 100000)
    throw Error("G는 0 이상의 정수로 적어주세요.");
  for (const [g, n] of Object.entries(b.goods || {}))
    if (!w.config.goods[g] || !Number.isInteger(n) || n < 0 || n > 1000)
      throw Error("물품 수량을 확인해 주세요.");
}
function enough(c: Country, b: Basket) {
  return (
    c.gold >= b.gold &&
    Object.entries(b.goods || {}).every(([g, n]) => c.stock[g].length >= n)
  );
}
function transfer(from: Country, to: Country, b: Basket) {
  if (!enough(from, b)) throw Error("나라 창고의 물품이나 G가 부족해요.");
  from.gold -= b.gold;
  to.gold += b.gold;
  for (const [g, n] of Object.entries(b.goods || {}))
    to.stock[g].push(...from.stock[g].splice(0, n));
}
function majority(w: World, o: Offer) {
  return [o.from, o.to].every((country) => {
    const team = Object.values(w.players).filter((p) => p.country === country);
    return (
      team.length > 0 &&
      team.filter((p) => o.votes[p.id] === true).length >=
        Math.floor(team.length / 2) + 1
    );
  });
}
function economics(w: World) {
  return copy({
    countries: w.countries,
    offers: w.offers,
    trades: w.trades,
    event: w.event,
  });
}
export function apply(
  raw: World,
  actor: string,
  cmd: Command,
  positions: Record<string, Position> = {},
  now = Date.now(),
): World {
  const w = normalize(raw);
  const uid = cmd.id || `${actor}-${now}-${w.revision}`;
  if (w.logs.some((l) => l.id === uid)) return w;
  const host = actor === w.teacher,
    player = w.players[actor],
    previous = economics(w);
  let text = "",
    undoable = false;
  const requireHost = () => {
    if (!host) throw Error("이 기능은 교사만 사용할 수 있어요.");
  };
  const requireActivity = () => {
    if (w.phase !== "activity" || now >= w.phaseEnd)
      throw Error(
        "활동 시간에만 할 수 있어요. 선생님이 단계를 바꿀 때까지 기다려주세요.",
      );
    if (!player?.country) throw Error("나라에 배정된 뒤 참여해 주세요.");
  };
  const near = (p: Position) => {
    if (
      !positions[actor] ||
      !walkable(w, player.country, positions[actor]) ||
      !adjacent(positions[actor], p)
    )
      throw Error("해당 칸 바로 옆으로 먼저 이동해 주세요.");
  };
  if (cmd.type === "join") {
    if (host || w.players[actor]) return w;
    if (w.phase !== "lobby")
      throw Error("이미 시작한 방에는 새로 입장할 수 없어요.");
    const nickname = String(cmd.nickname || "").trim();
    if (!nickname || nickname.length > 16)
      throw Error("별명은 1~16자로 입력해 주세요.");
    if (Object.values(w.players).some((p) => p.nickname === nickname))
      throw Error(
        "이미 있는 별명이에요. 같은 태블릿에서 다시 접속하거나 다른 별명을 사용해 주세요.",
      );
    if (Object.keys(w.players).length >= w.config.maxStudents)
      throw Error("학생 정원이 찼어요.");
    w.players[actor] = {
      id: actor,
      nickname,
      country: "",
      stamina: w.config.stamina,
    };
    text = `${nickname} 학생이 대기실에 들어왔어요.`;
  } else if (cmd.type === "assign") {
    requireHost();
    if (w.phase !== "lobby")
      throw Error("나라 배정은 시작 전에 바꿀 수 있어요.");
    if (!w.players[cmd.player] || !w.countries[cmd.country])
      throw Error("학생과 나라를 확인해 주세요.");
    w.players[cmd.player].country = cmd.country;
    text = `${w.players[cmd.player].nickname} 학생을 배정했어요.`;
  } else if (cmd.type === "autoAssign") {
    requireHost();
    if (w.phase !== "lobby") throw Error("자동 배정은 시작 전에 할 수 있어요.");
    const students = Object.values(w.players),
      specs = w.config.countries;
    if (students.length < w.config.minStudents)
      throw Error(`최소 ${w.config.minStudents}명이 필요해요.`);
    const n = students.length - specs.length,
      total = specs.reduce((s: number, c: any) => s + c.weight, 0),
      raw = specs.map((c: any) => (n * c.weight) / total),
      counts = raw.map((v: number) => 1 + Math.floor(v));
    let left =
      students.length - counts.reduce((s: number, v: number) => s + v, 0);
    [...raw.keys()]
      .sort((a, b) => (raw[b] % 1) - (raw[a] % 1))
      .forEach((i) => {
        if (left > 0) {
          counts[i]++;
          left--;
        }
      });
    let k = 0;
    specs.forEach((c: any, i: number) => {
      for (let j = 0; j < counts[i]; j++) students[k++].country = c.id;
    });
    text = "나라별 인원 비중에 맞춰 배정했어요.";
  } else if (cmd.type === "event") {
    requireHost();
    if (!["lobby", "settlement"].includes(w.phase))
      throw Error("이벤트는 다음 라운드 시작 전에 골라주세요.");
    if (
      !w.config.events.some((e: any) => e.id === cmd.event.id) ||
      !w.countries[cmd.event.country] ||
      !w.config.goods[cmd.event.good] ||
      !w.config.facilities[cmd.event.facility]
    )
      throw Error("이벤트 대상을 확인해 주세요.");
    w.pendingEvent = copy(cmd.event);
    text = "다음 라운드 이벤트를 골랐어요.";
  } else if (cmd.type === "next") {
    requireHost();
    if (w.phase === "ended") throw Error("이미 끝난 게임이에요.");
    if (w.phase === "lobby" || w.phase === "settlement") {
      if (w.phase === "settlement" && w.round >= w.config.rounds) {
        w.phase = "ended";
        w.phaseEnd = 0;
        text = "모든 라운드가 끝났어요. 건물의 원산지를 함께 살펴보세요.";
      } else {
        if (
          Object.keys(w.players).length < w.config.minStudents ||
          Object.values(w.players).some((p) => !p.country) ||
          w.config.countries.some(
            (c: any) =>
              !Object.values(w.players).some((p) => p.country === c.id),
          )
        )
          throw Error(
            "모든 학생을 배정하고 각 나라에 한 명 이상 배정해 주세요.",
          );
        w.round++;
        w.phase = "meeting";
        w.event = copy(w.pendingEvent);
        if (w.event.id === "technology") {
          const c = w.countries[w.event.country];
          if (!c.facilities[w.event.facility])
            c.facilities[w.event.facility] = {
              x: 4 + Object.keys(c.facilities).length * 2,
              y: 4,
            };
        }
        regenerate(w);
        for (const p of Object.values(w.players))
          p.stamina =
            w.round === 1 || w.reflections[String(w.round - 1)]?.[p.id]
              ? w.config.stamina
              : 0;
        for (const o of Object.values(w.offers))
          if (o.status === "open") o.status = "expired";
        w.phaseEnd = now + w.config.phaseSeconds.meeting * 1000;
        text = `${w.round}라운드 회의 시작! ${w.round === 1 ? "국경은 닫혀 있어요." : "자원이 다시 생겼어요."}`;
      }
    } else {
      w.phase = w.phase === "meeting" ? "activity" : "settlement";
      w.phaseEnd = now + w.config.phaseSeconds[w.phase] * 1000;
      text =
        w.phase === "activity"
          ? "활동 시작! 함께 캐고, 만들고, 교역해요."
          : "정산 시간! 이번 라운드를 돌아보고 기록해 주세요.";
    }
    delete w.undo;
  } else if (cmd.type === "end") {
    requireHost();
    w.phase = "ended";
    w.phaseEnd = 0;
    delete w.undo;
    text = "선생님이 게임을 마쳤어요.";
  } else if (cmd.type === "reflect") {
    if (!player || !["settlement", "meeting"].includes(w.phase))
      throw Error("정산 시간에 성찰을 작성해 주세요.");
    const r = w.phase === "meeting" ? w.round - 1 : w.round;
    if (r < 1) throw Error("아직 성찰할 라운드가 없어요.");
    const questions =
      r === 1 ? w.config.reflections.first : w.config.reflections.regular;
    if (
      !Array.isArray(cmd.answers) ||
      cmd.answers.length !== questions.length ||
      cmd.answers.some(
        (a: any) => typeof a !== "string" || !a.trim() || a.length > 500,
      )
    )
      throw Error("모든 문항에 1~500자로 답해 주세요.");
    w.reflections[String(r)] ||= {};
    w.reflections[String(r)][actor] = {
      answers: cmd.answers.map((a: string) => a.trim()),
      country: player.country,
      nickname: player.nickname,
    };
    if (w.phase === "meeting") player.stamina = w.config.stamina;
    text = `${player.nickname} 학생이 ${r}라운드 성찰을 기록했어요.`;
  } else if (cmd.type === "undo") {
    requireHost();
    if (!w.undo) throw Error("되돌릴 최근 행동이 없어요.");
    const before = w.undo.before;
    w.countries = copy(before.countries);
    w.offers = copy(before.offers);
    w.trades = copy(before.trades || []);
    w.event = copy(before.event);
    if (w.undo.player && w.players[w.undo.player.id])
      w.players[w.undo.player.id].stamina = w.undo.player.stamina;
    text = `최근 행동 취소: ${w.undo.label}`;
    delete w.undo;
  } else {
    requireActivity();
    const c = w.countries[player.country];
    if (cmd.type === "mine") {
      const node = c.nodes[cmd.node];
      if (!node) throw Error("이미 다른 친구가 캔 블록이에요.");
      near(node);
      if (player.stamina <= 0)
        throw Error("체력을 모두 썼어요. 회의와 교역을 도와주세요.");
      delete c.nodes[cmd.node];
      player.stamina--;
      c.stock[node.good].push({
        id: uid,
        good: node.good,
        sources: { [player.country]: { [node.good]: 1 } },
      });
      text = `+1 ${w.config.goods[node.good].name} (${player.nickname})`;
      undoable = true;
    } else if (cmd.type === "craft") {
      const recipe = w.config.recipes[cmd.good];
      if (!recipe) throw Error("조합법을 확인해 주세요.");
      const facility = c.facilities[recipe.facility];
      if (!facility)
        throw Error(
          `${w.config.facilities[recipe.facility]}가 없어요. 다른 나라에 가공을 부탁해 보세요.`,
        );
      near(facility);
      const sources: Unit["sources"] = {};
      for (const [g, n] of Object.entries(recipe.inputs))
        if (c.stock[g].length < Number(n))
          throw Error("나라 창고에 재료가 부족해요.");
      for (const [g, n] of Object.entries(recipe.inputs))
        for (const u of c.stock[g].splice(0, Number(n)))
          for (const [country, items] of Object.entries(u.sources)) {
            sources[country] ||= {};
            for (const [raw, qty] of Object.entries(items))
              sources[country][raw] =
                (sources[country][raw] || 0) + qty / recipe.output;
          }
      for (let k = 0; k < recipe.output; k++)
        c.stock[cmd.good].push({
          id: `${uid}-${k}`,
          good: cmd.good,
          sources: copy(sources),
          processor: player.country,
        });
      text = `${player.nickname}: ${w.config.goods[cmd.good].name} ${recipe.output}개를 만들었어요.`;
      undoable = true;
    } else if (cmd.type === "build") {
      const site = c.sites[cmd.site];
      if (!site || site.unit) throw Error("이미 놓았거나 건축 칸이 아니에요.");
      near(site);
      if (!c.stock[site.good].length)
        throw Error(
          `${w.config.goods[site.good].name}이 없어요. 다른 나라에 교역을 제안해 보세요.`,
        );
      site.unit = c.stock[site.good].shift();
      text = `${player.nickname}: ${w.config.goods[site.good].name}을 건축에 놓았어요.`;
      undoable = true;
    } else if (cmd.type === "offer") {
      near(port(w));
      const closed = tradeClosed(w, player.country) || tradeClosed(w, cmd.to);
      if (closed) throw Error(closed);
      if (!w.countries[cmd.to] || cmd.to === player.country)
        throw Error("다른 나라를 골라주세요.");
      basket(w, cmd.give);
      basket(w, cmd.receive);
      if (!enough(c, cmd.give)) throw Error("줄 물품이나 G가 부족해요.");
      if (
        Object.values(w.offers).filter(
          (o) => o.from === player.country && o.status === "open",
        ).length >= 10
      )
        throw Error("대기 중 제안은 나라별 10개까지예요.");
      if (
        !Object.values(cmd.give.goods || {}).some((n) => Number(n) > 0) &&
        !cmd.give.gold &&
        !Object.values(cmd.receive.goods || {}).some((n) => Number(n) > 0) &&
        !cmd.receive.gold
      )
        throw Error("줄 것 또는 받을 것을 담아주세요.");
      if (cmd.counterOf) {
        const previous = w.offers[cmd.counterOf];
        if (
          !previous ||
          previous.status !== "open" ||
          ![previous.from, previous.to].includes(player.country) ||
          ![previous.from, previous.to].includes(cmd.to)
        )
          throw Error("이미 끝났거나 다른 나라의 제안이에요.");
        previous.status = "countered";
      }
      w.offers[uid] = {
        id: uid,
        from: player.country,
        to: cmd.to,
        give: copy(cmd.give),
        receive: copy(cmd.receive),
        round: w.round,
        status: "open",
        votes: {},
        ...(cmd.counterOf ? { counterOf: cmd.counterOf } : {}),
      };
      text = `${player.nickname} 학생이 교역을 제안했어요.`;
      undoable = true;
    } else if (cmd.type === "vote") {
      const o = w.offers[cmd.offer];
      if (!o || o.status !== "open" || o.round !== w.round)
        throw Error("이미 끝난 제안이에요.");
      if (![o.from, o.to].includes(player.country))
        throw Error("제안에 참여한 나라만 투표할 수 있어요.");
      const closed = tradeClosed(w, o.from) || tradeClosed(w, o.to);
      if (closed) throw Error(closed);
      o.votes[actor] = cmd.agree === true;
      const team = Object.values(w.players).filter(
        (p) => p.country === player.country,
      );
      if (
        team.filter((p) => o.votes[p.id] === false).length >=
        Math.ceil(team.length / 2)
      ) {
        o.status = "rejected";
        text = "나라 회의에서 제안을 거절했어요.";
      } else if (majority(w, o)) {
        const from = w.countries[o.from],
          to = w.countries[o.to];
        if (!enough(from, o.give) || !enough(to, o.receive))
          throw Error(
            "재고가 바뀌어서 체결할 수 없어요. 새 제안을 만들어 주세요.",
          );
        transfer(from, to, o.give);
        transfer(to, from, o.receive);
        o.status = "accepted";
        w.trades.push({
          id: o.id,
          round: w.round,
          from: o.from,
          to: o.to,
          give: copy(o.give),
          receive: copy(o.receive),
          at: now,
        });
        text = "두 나라의 과반이 동의해서 교역이 체결됐어요!";
      } else
        text = `${player.nickname}: ${cmd.agree ? "동의" : "반대"}를 기록했어요.`;
      undoable = true;
    } else if (cmd.type === "cancelOffer") {
      const o = w.offers[cmd.offer];
      if (!o || o.status !== "open" || o.from !== player.country)
        throw Error("우리 나라의 대기 중 제안만 취소할 수 있어요.");
      o.status = "cancelled";
      text = "교역 제안을 취소했어요.";
      undoable = true;
    } else throw Error("알 수 없는 행동이에요.");
  }
  if (undoable)
    w.undo = {
      before: previous,
      label: text,
      player: player
        ? { id: actor, stamina: raw.players[actor].stamina }
        : null,
    };
  w.revision++;
  w.lastAction = { actor, type: cmd.type, at: now };
  log(w, text, uid, now);
  return w;
}
export function tradePotential(
  w: World,
  id: string,
  give: Basket,
  receive: Basket,
) {
  const c = w.countries[id];
  function estimate(change: boolean) {
    const counts = Object.fromEntries(
      Object.keys(w.config.goods).map((g) => [
        g,
        Math.max(
          0,
          c.stock[g].length -
            (change ? give.goods[g] || 0 : 0) +
            (change ? receive.goods[g] || 0 : 0),
        ),
      ]),
    );
    let available = 0;
    for (const [g, total] of Object.entries(
      w.config.countries.find((spec: any) => spec.id === id).building.needs,
    )) {
      const need = Object.values(c.sites).filter(
        (s) => s.good === g && !s.unit,
      ).length;
      const direct = Math.min(need, counts[g]);
      available += direct;
      counts[g] -= direct;
      const recipe = w.config.recipes[g];
      if (recipe && c.facilities[recipe.facility]) {
        const batches = Math.min(
          Math.ceil((need - direct) / recipe.output),
          ...Object.entries(recipe.inputs).map(([raw, n]) =>
            Math.floor(counts[raw] / Number(n)),
          ),
        );
        available += Math.min(need - direct, batches * recipe.output);
        for (const [raw, n] of Object.entries(recipe.inputs))
          counts[raw] -= batches * Number(n);
      }
    }
    return available;
  }
  const before = estimate(false),
    after = estimate(true),
    sites = Object.values(c.sites),
    placed = sites.filter((s) => s.unit).length;
  return {
    before,
    after,
    delta: after - before,
    percentBefore: (placed + before) / sites.length,
    percentAfter: (placed + after) / sites.length,
  };
}
export function origins(w: World, u: Unit) {
  const parts = Object.entries(u.sources).flatMap(([country, gs]) =>
    Object.keys(gs).map(
      (g) =>
        `${w.config.goods[g].name}: ${w.config.countries.find((c: any) => c.id === country)?.short || country}`,
    ),
  );
  if (u.processor)
    parts.push(
      `가공: ${w.config.countries.find((c: any) => c.id === u.processor)?.short}`,
    );
  return [...new Set(parts)].join(" / ");
}
export function reflectionCSV(w: World) {
  const q = (v: any) => '"' + String(v ?? "").replace(/"/g, '""') + '"',
    rows = [["라운드", "나라", "별명", "문항", "답변"]];
  for (const [r, answers] of Object.entries(w.reflections))
    for (const a of Object.values(answers)) {
      const questions =
        Number(r) === 1
          ? w.config.reflections.first
          : w.config.reflections.regular;
      a.answers.forEach((text, i) =>
        rows.push([
          r,
          w.config.countries.find((c: any) => c.id === a.country)?.name,
          a.nickname,
          questions[i],
          /^[=+\-@]/.test(text) ? "'" + text : text,
        ]),
      );
    }
  return "\uFEFF" + rows.map((row) => row.map(q).join(",")).join("\r\n");
}
