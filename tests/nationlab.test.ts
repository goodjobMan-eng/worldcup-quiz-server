import { test } from "node:test";
import assert from "node:assert/strict";
import "../월드컵-본선-진출국-탐구-퀴즈/public/config.js";
import {
  apply,
  createWorld,
  config,
  progress,
  origins,
  pathTo,
  walkable,
  reflectionCSV,
  tradeClosed,
  normalize,
  World,
  Position,
} from "../월드컵-본선-진출국-탐구-퀴즈/src/nationlab/engine";
import { simulate } from "../scripts/simulate";
function game(students = 3) {
  let w = createWorld("1234", "teacher"),
    now = Date.now(),
    serial = 0;
  const positions: Record<string, Position> = {};
  const act = (actor: string, c: any) => {
    w = apply(w, actor, { ...c, id: "t" + serial++ }, positions, ++now);
    return w;
  };
  for (let i = 0; i < students; i++)
    act("p" + i, { type: "join", nickname: "별명" + i });
  act("teacher", { type: "autoAssign" });
  return {
    get w() {
      return w;
    },
    act,
    positions,
    get now() {
      return now;
    },
    country: (id: string) =>
      Object.values(w.players).find((p) => p.country === id)!.id,
  };
}
function activity(g: ReturnType<typeof game>) {
  g.act("teacher", { type: "next" });
  g.act("teacher", { type: "next" });
}
function nextRound(g: ReturnType<typeof game>, skip = "") {
  g.act("teacher", { type: "next" });
  for (const p of Object.values(g.w.players))
    if (p.id !== skip)
      g.act(p.id, {
        type: "reflect",
        answers: (g.w.round === 1
          ? config().reflections.first
          : config().reflections.regular
        ).map(() => "교역이 필요했어요."),
      });
  activity(g);
}
function near(g: ReturnType<typeof game>, actor: string, t: Position) {
  const p = pathTo(g.w, g.w.players[actor].country, { x: 4, y: 10 }, t);
  g.positions[actor] = p.at(-1) || { x: 4, y: 10 };
}
test("resource race grants a unique block once; replay never duplicates it; undo restores stamina and resource", () => {
  const g = game(6);
  activity(g);
  const team = Object.values(g.w.players).filter(
    (p) => p.country === "hualian",
  );
  const node = Object.values(g.w.countries.hualian.nodes)[0];
  near(g, team[0].id, node);
  near(g, team[1].id, node);
  g.act(team[0].id, { type: "mine", node: node.id });
  assert.throws(
    () => g.act(team[1].id, { type: "mine", node: node.id }),
    /이미/,
  );
  assert.equal(g.w.countries.hualian.stock[node.good].length, 1);
  const again = apply(
    g.w,
    team[0].id,
    { type: "mine", node: node.id, id: g.w.logs[0].id },
    g.positions,
    g.now,
  );
  assert.equal(again.countries.hualian.stock[node.good].length, 1);
  g.act("teacher", { type: "undo" });
  assert.ok(g.w.countries.hualian.nodes[node.id]);
  assert.equal(g.w.players[team[0].id].stamina, 15);
});
test("finite stamina, stage locks, reflection-gated refill and CSV escaping", () => {
  const g = game();
  activity(g);
  const a = g.country("hualian");
  for (const node of Object.values(g.w.countries.hualian.nodes).slice(0, 15)) {
    near(g, a, node);
    g.act(a, { type: "mine", node: node.id });
  }
  assert.equal(g.w.players[a].stamina, 0);
  const remaining = Object.values(g.w.countries.hualian.nodes)[0];
  near(g, a, remaining);
  assert.throws(() => g.act(a, { type: "mine", node: remaining.id }), /체력/);
  nextRound(g, a);
  assert.equal(g.w.players[a].stamina, 0);
  g.act("teacher", { type: "next" });
  g.act("teacher", { type: "next" });
  assert.equal(g.w.phase, "meeting");
  g.act(a, {
    type: "reflect",
    answers: ["=위험 수식", "친구에게 도움", "함께 이익"],
  });
  assert.equal(g.w.players[a].stamina, 15);
  assert.match(reflectionCSV(g.w), /"'=위험 수식"/);
  assert.throws(() => g.act(a, { type: "mine", node: "none" }), /활동/);
});
test("both nations require a strict majority and a second offer cannot spend the same stock", () => {
  const g = game(6);
  activity(g);
  const from = "hualian",
    to = "sahar",
    a = g.country(from);
  const node = Object.values(g.w.countries[from].nodes)[0];
  near(g, a, node);
  g.act(a, { type: "mine", node: node.id });
  assert.throws(() => g.act(a, { type: "craft", good: "plate" }), /용광로/);
  nextRound(g);
  g.positions[a] = { x: 17, y: 9 };
  const create = () => {
    g.act(a, {
      type: "offer",
      to,
      give: { goods: { [node.good]: 1 }, gold: 0 },
      receive: { goods: {}, gold: 1 },
    });
    return g.w.offers[g.w.logs[0].id];
  };
  const one = create(),
    two = create();
  const team = Object.values(g.w.players).filter((p) =>
    [from, to].includes(p.country),
  );
  g.act(team[0].id, { type: "vote", offer: one.id, agree: true });
  assert.equal(g.w.offers[one.id].status, "open");
  for (const p of team.slice(1))
    if (g.w.offers[one.id].status === "open")
      g.act(p.id, { type: "vote", offer: one.id, agree: true });
  assert.equal(g.w.offers[one.id].status, "accepted");
  assert.equal(g.w.countries[to].stock[node.good].length, 1);
  assert.equal(g.w.countries[from].stock[node.good].length, 0);
  let failed = false;
  for (const p of team) {
    try {
      g.act(p.id, { type: "vote", offer: two.id, agree: true });
    } catch (e) {
      assert.match((e as Error).message, /재고/);
      failed = true;
      break;
    }
  }
  assert.ok(failed);
  assert.equal(g.w.trades.length, 1);
});
test("events close only the affected port and new technology changes facility access", () => {
  const g = game();
  activity(g);
  assert.match(tradeClosed(g.w, "sahar"), /1라운드/);
  g.act("teacher", { type: "next" });
  for (const p of Object.values(g.w.players))
    g.act(p.id, { type: "reflect", answers: ["교역을 할 수 없었어요."] });
  g.act("teacher", {
    type: "event",
    event: { id: "storm", country: "sahar", good: "sand", facility: "furnace" },
  });
  activity(g);
  assert.equal(tradeClosed(g.w, "hualian"), "");
  assert.match(tradeClosed(g.w, "sahar"), /폭풍/);
  g.act("teacher", { type: "next" });
  g.act("teacher", {
    type: "event",
    event: {
      id: "technology",
      country: "hualian",
      good: "iron",
      facility: "furnace",
    },
  });
  activity(g);
  assert.ok(g.w.countries.hualian.facilities.furnace);
});
test("all configured resources and sites are reachable, weighted teams support 7 through 40 students", () => {
  for (const count of [3, 7, 20, 40]) {
    const g = game(count);
    activity(g);
    const counts = config().countries.map(
      (c: any) =>
        Object.values(g.w.players).filter((p) => p.country === c.id).length,
    );
    assert.equal(
      counts.reduce((s: number, n: number) => s + n, 0),
      count,
    );
    assert.ok(counts.every((n: number) => n >= 1));
    for (const c of config().countries)
      for (const t of [
        ...Object.values(g.w.countries[c.id].nodes),
        ...Object.values(g.w.countries[c.id].sites),
        ...Object.values(g.w.countries[c.id].facilities),
      ])
        assert.ok(
          pathTo(g.w, c.id, { x: 4, y: 10 }, t).length,
          `${c.id}: ${JSON.stringify(t)}`,
        );
  }
});
test("six rounds: without trade every nation is incomplete, cooperation finishes all and preserves three origins", () => {
  const isolated = simulate(false),
    together = simulate(true);
  for (const c of config().countries) {
    assert.ok(progress(isolated.world, c.id) < 1);
    assert.equal(progress(together.world, c.id), 1);
  }
  const plate = Object.values(together.world.countries.hualian.sites).find(
    (s) => s.good === "plate",
  )!.unit!;
  const source = origins(together.world, plate);
  assert.match(source, /화련/);
  assert.match(source, /사하르/);
  assert.match(source, /가공: 히노미/);
  assert.equal(together.world.phase, "ended");
});
test("only teacher can advance, assign and undo; malformed and overlarge baskets are rejected", () => {
  const g = game();
  assert.throws(() => g.act("p0", { type: "next" }), /교사/);
  assert.throws(() => g.act("p0", { type: "autoAssign" }), /교사/);
  activity(g);
  nextRound(g);
  const a = g.country("hualian");
  g.positions[a] = { x: 17, y: 9 };
  assert.throws(
    () =>
      g.act(a, {
        type: "offer",
        to: "sahar",
        give: { goods: { stone: -1 }, gold: 0 },
        receive: { goods: {}, gold: 0 },
      }),
    /수량/,
  );
  assert.throws(() => g.act(a, { type: "undo" }), /교사/);
});
test("harvest doubles supply, depletion removes supply, and border closes every port for the selected round", () => {
  const g = game();
  g.act("teacher", {
    type: "event",
    event: {
      id: "harvest",
      country: "sahar",
      good: "sand",
      facility: "furnace",
    },
  });
  activity(g);
  assert.equal(
    Object.values(g.w.countries.sahar.nodes).filter((n) => n.good === "sand")
      .length,
    config().countries[1].regen.sand * 2,
  );
  g.act("teacher", { type: "next" });
  g.act("teacher", {
    type: "event",
    event: {
      id: "depletion",
      country: "hualian",
      good: "iron",
      facility: "furnace",
    },
  });
  activity(g);
  assert.equal(
    Object.values(g.w.countries.hualian.nodes).filter((n) => n.good === "iron")
      .length,
    0,
  );
  g.act("teacher", { type: "next" });
  g.act("teacher", {
    type: "event",
    event: {
      id: "border",
      country: "sahar",
      good: "sand",
      facility: "furnace",
    },
  });
  activity(g);
  for (const c of config().countries)
    assert.match(tradeClosed(g.w, c.id), /모든 항구/);
});

test("education servers have stable distinct keys and one classroom building preserves metadata", async () => {
  const { regions, serverId, validateClassroom, campusBuilding } = await import('../월드컵-본선-진출국-탐구-퀴즈/src/nationlab/servers');
  assert.equal(regions().length, 17);
  const keys = regions().flatMap(r => r.districts.map(d => serverId(r.id, d)));
  assert.equal(new Set(keys).size, keys.length);
  assert.notEqual(serverId('seoul', '동부'), serverId('busan', '동부'));
  const c = validateClassroom({regionId:'seoul',serverId:serverId('seoul','동부'),district:'동부',school:'테스트초',className:'6학년 1반',buildingCountry:'hualian'});
  assert.throws(() => validateClassroom({...c,serverId:serverId('busan','동부')}));
  const g = game(); g.w.classroom = c;
  activity(g);
  assert.deepEqual(g.w.classroom, c);
  const b = campusBuilding(g.w)!;
  assert.equal(b.school, '테스트초');
  assert.equal(b.kind, 'bridge');
  assert.equal(b.progress, 0);
  assert.equal('players' in b, false);
  assert.equal('reflections' in b, false);
});
