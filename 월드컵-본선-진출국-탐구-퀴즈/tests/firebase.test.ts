import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import "../public/config.js";
import { createWorld, apply } from "../src/nationlab/engine";
test("RTDB rules: membership, teacher authority, immutable inbox, positions and deletion", async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-nationlab",
    database: {
      host: "127.0.0.1",
      port: 9000,
      rules: readFileSync("database.rules.json", "utf8"),
    },
  });
  try {
    await env.clearDatabase();
    const teacher = env.authenticatedContext("teacher").database(),
      a = env.authenticatedContext("a").database(),
      b = env.authenticatedContext("b").database(),
      outsider = env.authenticatedContext("outsider").database();
    let w = createWorld("1234", "teacher");
    await assertSucceeds(
      teacher
        .ref("rooms/1234")
        .set({ state: w, members: { teacher: { nickname: "교사" } } }),
    );
    await assertFails(outsider.ref("rooms/1234/state").get());
    await assertSucceeds(
      a
        .ref("rooms/1234/members/a")
        .set({ nickname: "별이", joinedAt: Date.now() }),
    );
    await assertSucceeds(a.ref("rooms/1234/state").get());
    await assertFails(
      a.ref("rooms/1234/state/countries/hualian/gold").set(9999),
    );
    await assertFails(a.ref("rooms/1234/state/teacher").set("a"));
    await assertFails(
      a.ref("rooms/1234/members/b").set({ nickname: "다른친구" }),
    );
    await assertFails(a.ref("rooms/1234").remove());
    await assertSucceeds(
      a
        .ref("rooms/1234/inbox/a/one")
        .set({ at: Date.now(), command: { type: "join", nickname: "별이" } }),
    );
    await assertFails(
      a
        .ref("rooms/1234/inbox/a/one")
        .set({ at: Date.now(), command: { type: "join", nickname: "위조" } }),
    );
    await assertFails(
      a
        .ref("rooms/1234/inbox/a/two")
        .set({ at: Date.now(), command: { type: "next" } }),
    );
    await assertSucceeds(teacher.ref("rooms/1234/inbox/a/one").remove());
    for (const [id, nickname] of [
      ["a", "별이"],
      ["b", "모래"],
      ["c", "바다"],
    ])
      w = apply(w, id, { type: "join", nickname });
    w = apply(w, "teacher", { type: "autoAssign" });
    w = apply(w, "teacher", { type: "next" });
    w = apply(w, "teacher", { type: "next" });
    await assertSucceeds(teacher.ref("rooms/1234/state").set(w));
    await assertSucceeds(
      a.ref("rooms/1234/positions/a").set({ x: 3, y: 10, at: Date.now() }),
    );
    await assertFails(
      a.ref("rooms/1234/positions/b").set({ x: 3, y: 10, at: Date.now() }),
    );
    await assertFails(
      a.ref("rooms/1234/positions/a").set({ x: -1, y: 10, at: Date.now() }),
    );
    await assertFails(
      teacher.ref("rooms/1234/state/countries/hualian/gold").set(-1),
    );
    await assertFails(
      b
        .ref("rooms/1234/members/b")
        .set({ nickname: "늦은친구", joinedAt: Date.now() }),
    );
    await assertSucceeds(teacher.ref("rooms/1234").remove());
  } finally {
    await env.cleanup();
  }
});

test("RTDB server isolation and teacher-owned class building directory", async () => {
  const { serverId, campusBuilding } = await import('../src/nationlab/servers');
  const env = await initializeTestEnvironment({projectId:'demo-nationlab-servers',database:{host:'127.0.0.1',port:9000,rules:readFileSync('database.rules.json','utf8')}});
  try {
    await env.clearDatabase();
    const teacher=env.authenticatedContext('teacher').database();
    const other=env.authenticatedContext('other').database();
    const student=env.authenticatedContext('student').database();
    const a=serverId('seoul','동부'), b=serverId('busan','동부');
    const one=createWorld('1234','teacher');
    one.classroom={regionId:'seoul',serverId:a,district:'동부',school:'테스트초',className:'6학년 1반',buildingCountry:'hualian'};
    const two=createWorld('1234','other');
    two.classroom={regionId:'busan',serverId:b,district:'동부',school:'다른초',className:'6학년 2반',buildingCountry:'hinomi'};
    await assertSucceeds(teacher.ref(`servers/${a}/rooms/1234`).set({state:one,members:{teacher:{nickname:'교사'}}}));
    await assertSucceeds(other.ref(`servers/${b}/rooms/1234`).set({state:two,members:{other:{nickname:'교사'}}}));
    await assertFails(other.ref(`servers/${a}/rooms/1234/state`).get());
    await assertSucceeds(student.ref(`servers/${a}/rooms/1234/members/student`).set({nickname:'학생'}));
    await assertSucceeds(student.ref(`servers/${a}/rooms/1234/state`).get());
    await assertFails(student.ref(`servers/${b}/rooms/1234/state`).get());
    const building=campusBuilding(one)!;
    await assertSucceeds(teacher.ref(`campuses/${a}/1234`).set(building));
    await assertSucceeds(student.ref('campuses').get());
    await assertFails(student.ref(`campuses/${a}/1234/progress`).set(1));
    await assertFails(other.ref(`campuses/${a}/1234`).set({...building,owner:'other'}));
    await assertFails(teacher.ref(`campuses/${b}/1234`).set({...building,serverId:b}));
    await assertFails(teacher.ref(`campuses/${a}/1234`).set({...building,progress:2}));
    await assertFails(teacher.ref(`servers/${a}/rooms/1234/state/classroom/serverId`).set(b));
    await assertSucceeds(teacher.ref(`campuses/${a}/1234`).remove());
    await assertSucceeds(teacher.ref(`servers/${a}/rooms/1234`).remove());
  } finally {await env.cleanup();}
});
