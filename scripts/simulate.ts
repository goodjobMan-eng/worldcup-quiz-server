import "../월드컵-본선-진출국-탐구-퀴즈/public/config.js";
import {
  apply,
  createWorld,
  World,
  Position,
  progress,
  config,
  walkable,
  port,
} from "../월드컵-본선-진출국-탐구-퀴즈/src/nationlab/engine";
export function simulate(trade: boolean, students = 3) {
  let w = createWorld("1234", "teacher"),
    now = Date.now(),
    serial = 0;
  const positions: Record<string, Position> = {};
  const act = (actor: string, command: any) => {
    w = apply(
      w,
      actor,
      { ...command, id: `sim-${serial++}` },
      positions,
      ++now,
    );
  };
  for (let i = 0; i < students; i++)
    act("p" + i, { type: "join", nickname: "학생" + i });
  act("teacher", { type: "autoAssign" });
  const member = (country: string) =>
    Object.values(w.players).find((p) => p.country === country)!;
  function near(actor: string, target: Position) {
    const id = w.players[actor].country;
    const candidate = [
      { x: target.x - 1, y: target.y },
      { x: target.x + 1, y: target.y },
      { x: target.x, y: target.y - 1 },
      { x: target.x, y: target.y + 1 },
      target,
    ].find((p) => walkable(w, id, p));
    if (!candidate) throw Error("접근할 수 없는 시설이나 자원입니다.");
    positions[actor] = candidate;
  }
  function exchange(
    from: string,
    to: string,
    good: string,
    qty: number,
    unitPrice = 1,
  ) {
    if (qty <= 0) return;
    const a = member(from),
      b = member(to);
    near(a.id, port(w));
    const give = { goods: { [good]: qty }, gold: 0 },
      receive = { goods: {}, gold: qty * unitPrice };
    act(a.id, { type: "offer", to, give, receive });
    const offer = Object.values(w.offers).find((o) => o.status === "open")!;
    for (const p of Object.values(w.players).filter((p) =>
      [from, to].includes(p.country),
    )) {
      if (w.offers[offer.id].status !== "open") break;
      act(p.id, { type: "vote", offer: offer.id, agree: true });
    }
  }
  const totals: Record<string, number> = {};
  for (const c of config().countries)
    for (const [g, n] of Object.entries(c.building.needs))
      totals[g] = (totals[g] || 0) + Number(n);
  const rawNeeds: Record<string, number> = {};
  for (const [g, n] of Object.entries(totals)) {
    const r = config().recipes[g];
    for (const [raw, qty] of Object.entries(r.inputs))
      rawNeeds[raw] =
        (rawNeeds[raw] || 0) + Math.ceil(n / r.output) * Number(qty);
  }
  const collected: Record<string, number> = {};
  const produced: Record<string, number> = {};
  const producers: Record<string, string> = {
    brick: "hualian",
    cloth: "hualian",
    plank: "hinomi",
    glass: "sahar",
    plate: "hinomi",
  };
  const rounds: any[] = [];
  for (let round = 1; round <= config().rounds; round++) {
    act("teacher", { type: "next" });
    act("teacher", { type: "next" });
    for (const spec of config().countries) {
      const team = Object.values(w.players).filter(
        (p) => p.country === spec.id,
      );
      for (const node of Object.values(w.countries[spec.id].nodes)) {
        if ((collected[node.good] || 0) >= (rawNeeds[node.good] || 0)) continue;
        const p = team.find((p) => w.players[p.id].stamina > 0);
        if (!p) break;
        near(p.id, node);
        act(p.id, { type: "mine", node: node.id });
        collected[node.good] = (collected[node.good] || 0) + 1;
      }
    }
    if (trade && round >= 2) {
      for (const [g, total] of Object.entries(totals)) {
        const r = config().recipes[g],
          producer = producers[g];
        for (const raw of Object.keys(r.inputs))
          for (const spec of config().countries) {
            if (spec.id === producer) continue;
            exchange(
              spec.id,
              producer,
              raw,
              w.countries[spec.id].stock[raw].length,
            );
          }
        const p = member(producer);
        while (
          (produced[g] || 0) < total &&
          Object.entries(r.inputs).every(
            ([raw, n]) => w.countries[producer].stock[raw].length >= Number(n),
          )
        ) {
          near(p.id, w.countries[producer].facilities[r.facility]);
          act(p.id, { type: "craft", good: g });
          produced[g] = (produced[g] || 0) + r.output;
        }
        for (const spec of config().countries) {
          const need =
            Object.values(w.countries[spec.id].sites).filter(
              (s) => s.good === g && !s.unit,
            ).length - w.countries[spec.id].stock[g].length;
          if (spec.id !== producer)
            exchange(
              producer,
              spec.id,
              g,
              Math.min(
                Math.max(0, need),
                w.countries[producer].stock[g].length,
              ),
              3,
            );
        }
      }
    } else {
      for (const spec of config().countries) {
        const p = member(spec.id),
          c = w.countries[spec.id];
        for (const [g, n] of Object.entries(spec.building.needs)) {
          const r = config().recipes[g];
          if (!c.facilities[r.facility]) continue;
          let need =
            Object.values(c.sites).filter((s) => s.good === g && !s.unit)
              .length - c.stock[g].length;
          while (
            need > 0 &&
            Object.entries(r.inputs).every(
              ([raw, n]) => w.countries[spec.id].stock[raw].length >= Number(n),
            )
          ) {
            near(p.id, c.facilities[r.facility]);
            act(p.id, { type: "craft", good: g });
            need -= r.output;
          }
        }
      }
    }
    for (const spec of config().countries) {
      const p = member(spec.id);
      for (const site of Object.values(w.countries[spec.id].sites))
        if (!site.unit && w.countries[spec.id].stock[site.good].length) {
          near(p.id, site);
          act(p.id, { type: "build", site: site.id });
        }
    }
    rounds.push({
      round,
      ...Object.fromEntries(
        config().countries.map((c: any) => [
          c.name,
          Math.round(progress(w, c.id) * 100),
        ]),
      ),
    });
    act("teacher", { type: "next" });
    for (const p of Object.values(w.players)) {
      const qs =
        round === 1 ? config().reflections.first : config().reflections.regular;
      act(p.id, {
        type: "reflect",
        answers: qs.map(() =>
          trade
            ? "다른 나라의 자원과 가공 기술이 있어 건축을 진행할 수 있었어요."
            : "우리에게 없는 자원과 기술 때문에 완성할 수 없었어요.",
        ),
      });
    }
  }
  act("teacher", { type: "next" });
  return { world: w, rounds, rawNeeds, collected };
}
if (process.argv[1]?.endsWith("simulate.ts")) {
  for (const trade of [false, true]) {
    const result = simulate(trade);
    console.log(
      "\n" +
        (trade ? "교역 있음" : "교역 없음") +
        " · 학생 3명 · 국가마다 1명 · 각자 라운드당 체력 15",
    );
    console.table(result.rounds);
    if (
      trade &&
      !config().countries.every((c: any) => progress(result.world, c.id) === 1)
    )
      throw Error("교역을 해도 목표를 완성하지 못했습니다.");
    if (
      !trade &&
      config().countries.some((c: any) => progress(result.world, c.id) === 1)
    )
      throw Error("혼자서 목표를 완성하는 나라가 있습니다.");
  }
  console.log(
    "검증 통과: 원료 채굴, 시설 가공, 과반 동의 거래, 원산지 보존, 건축을 실제 게임 규칙으로 실행했습니다.",
  );
}
