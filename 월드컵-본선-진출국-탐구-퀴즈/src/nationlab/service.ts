import { campusBuilding, validateClassroom, type Classroom, type CampusBuilding } from "./servers";
import {
  apply,
  config,
  createWorld,
  normalize,
  World,
  Position,
  Command,
} from "./engine";
export type Session = {
  code: string;
  uid: string;
  mode: "local" | "firebase";
  demo?: boolean;
  serverId?: string;
};
export type Receipt = { uid: string; ok: boolean; message: string; at: number };
export type Envelope = {
  state: World & { receipts?: Record<string, Receipt> };
  positions: Record<string, Position>;
  members: Record<string, { nickname: string }>;
  inbox?: Record<string, Record<string, { command: Command; at: number }>>;
};
export const roomId = (s: Pick<Session, "code" | "serverId">) => s.serverId ? s.serverId + "--" + s.code : s.code;
const roomPath = (s: Pick<Session, "code" | "serverId">) => s.serverId ? `servers/${s.serverId}/rooms/${s.code}` : `rooms/${s.code}`;
const key = (code: string) => "nationlab-room-" + code,
  listeners = new Set<() => void>();
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("nationlab-local")
    : null;
channel?.addEventListener("message", () => listeners.forEach((fn) => fn()));
window.addEventListener("storage", () => listeners.forEach((fn) => fn()));
const localRead = (code: string): Envelope | null => {
  const raw = localStorage.getItem(key(code));
  return raw ? JSON.parse(raw) : null;
};
function localWrite(code: string, e: Envelope) {
  localStorage.setItem(key(code), JSON.stringify(e));
  channel?.postMessage(code);
  listeners.forEach((fn) => fn());
}
async function lock<T>(code: string, task: () => T): Promise<T> {
  if (!navigator.locks)
    throw Error("공유 연습에는 최신 크롬 또는 삼성 인터넷을 사용해 주세요.");
  return navigator.locks.request("nationlab-" + code, task);
}
function uid() {
  let id = localStorage.getItem("nationlab-local-uid");
  if (!id) {
    id = "local-" + crypto.randomUUID();
    localStorage.setItem("nationlab-local-uid", id);
  }
  return id;
}
let firebasePromise: Promise<any> | undefined;
let clockOffset = 0;
export const serverNow = () => Date.now() + clockOffset;
async function firebase() {
  if (!firebasePromise)
    firebasePromise = (async () => {
      const [apps, auths, dbs] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
        import("firebase/database"),
      ]);
      const cfg = config(),
        app = apps.getApps()[0] || apps.initializeApp(cfg.firebase),
        auth = auths.getAuth(app),
        db = dbs.getDatabase(app);
      if (cfg.emulator.enabled) {
        auths.connectAuthEmulator(
          auth,
          `http://${cfg.emulator.host}:${cfg.emulator.authPort}`,
          { disableWarnings: true },
        );
        dbs.connectDatabaseEmulator(
          db,
          cfg.emulator.host,
          cfg.emulator.databasePort,
        );
      }
      await auths.setPersistence(auth, auths.browserLocalPersistence);
      await auth.authStateReady();
      if (!auth.currentUser) await auths.signInAnonymously(auth);
      let offset = 0;
      dbs.onValue(
        dbs.ref(db, ".info/serverTimeOffset"),
        (s) => {
          offset = Number(s.val() || 0);
          clockOffset = offset;
        },
      );
      return { ...dbs, auth, db, now: () => Date.now() + offset };
    })();
  return firebasePromise;
}
export const configured = () =>
  Boolean(config()?.firebase?.apiKey && config()?.firebase?.databaseURL);
export function saveSession(s: Session) {
  localStorage.setItem("nationlab-session", JSON.stringify(s));
}
export function restoreSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem("nationlab-session") || "null");
  } catch {
    return null;
  }
}
export function forgetSession() {
  localStorage.removeItem("nationlab-session");
}
export async function createRoom(
  mode: Session["mode"],
  demo = false,
  classroom?: Classroom,
): Promise<Session> {
  if (classroom) classroom = validateClassroom(classroom);
  const f = mode === "firebase" ? await firebase() : null,
    user = f?.auth.currentUser.uid || uid();
  for (let i = 0; i < 10; i++) {
    const code = String(
      1000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9000),
    );
    const scope = {code, serverId: classroom?.serverId};
    const localId = roomId(scope);
    let w = createWorld(code, user);
    if (classroom) w.classroom = classroom;
    if (demo) {
      for (const [j, c] of w.config.countries.entries())
        w = apply(w, "demo-" + c.id, {
          type: "join",
          nickname: ["별이", "모래", "바다"][j],
        });
      w = apply(w, user, { type: "autoAssign" });
    }
    const e: Envelope = {
      state: w,
      positions: {},
      members: { [user]: { nickname: "교사" } },
    };
    if (mode === "local") {
      const ok = await lock(localId, () => {
        if (localRead(localId)) return false;
        localWrite(localId, e);
        return true;
      });
      if (!ok) continue;
    } else {
      try {
        const r = await f.runTransaction(
          f.ref(f.db, roomPath(scope)),
          (old: any) => (old === null ? e : undefined),
          { applyLocally: false },
        );
        if (!r.committed) continue;
      } catch (error: any) {
        if (error.code === "PERMISSION_DENIED") continue;
        throw error;
      }
    }
    const session: Session = {
      code,
      uid: user,
      mode,
      ...(demo ? { demo: true } : {}),
      ...(classroom ? {serverId: classroom.serverId} : {}),
    };
    saveSession(session);
    return session;
  }
  throw Error(
    "방 생성 권한을 확인해 주세요. Firebase 규칙과 익명 인증 설정이 필요해요.",
  );
}
export async function joinRoom(
  code: string,
  nickname: string,
  mode: Session["mode"],
  selectedServer?: string,
): Promise<Session> {
  if (!/^\d{4}$/.test(code)) throw Error("숫자 4자리 코드를 입력해 주세요.");
  nickname = nickname.trim();
  if (!nickname || nickname.length > 16)
    throw Error("별명은 1~16자로 적어주세요.");
  const f = mode === "firebase" ? await firebase() : null,
    user = f?.auth.currentUser.uid || uid(),
    s: Session = { code, uid: user, mode, ...(selectedServer ? { serverId: selectedServer } : {}) };
  if (mode === "local") {
    await lock(roomId(s), () => {
      const e = localRead(roomId(s));
      if (!e)
        throw Error(
          "방이 없어요. 연습은 같은 브라우저의 탭끼리만 공유돼요. 다른 태블릿은 Firebase 모드로 접속하세요.",
        );
      if (e.state.teacher !== user) {
        e.state = apply(e.state, user, { type: "join", nickname });
        e.members[user] = { nickname };
        localWrite(roomId(s), e);
      }
    });
  } else {
    const r = f.ref(f.db, `${roomPath(s)}/members/${user}`);
    const previous = await f.get(r);
    if (!previous.exists()) {
      try {
        await f.set(r, { nickname, joinedAt: f.now() });
      } catch {
        throw Error(
          "방이 없거나 이미 시작했어요. 코드와 Firebase 규칙을 확인해 주세요.",
        );
      }
    }
    const existing = (await f.get(f.ref(f.db, `${roomPath(s)}/state`))).val();
    if (existing?.teacher !== user && !existing?.players?.[user]) {
      try {
        await transact(s, { type: "join", nickname });
      } catch (e) {
        if (!previous.exists()) await f.remove(r);
        throw e;
      }
    }
  }
  saveSession(s);
  return s;
}
const positions: Record<string, Record<string, Position>> = {};
export function rememberPositions(s: Session, p: Record<string, Position>) {
  positions[roomId(s)] = p;
}
/** Only the authenticated teacher commits shared economic state. Students submit
 * immutable commands. Teacher batches them in an RTDB transaction, then acknowledges
 * them in that same state, preventing duplicated work after reconnect/retry. */
export function subscribe(
  s: Session,
  receive: (e: Envelope | null) => void,
  error: (e: Error) => void,
): () => void {
  let disposed = false,
    stop = () => {},
    timer: ReturnType<typeof setTimeout> | undefined,
    running = false,
    latest: Envelope | null = null;
  let publicationTimer: ReturnType<typeof setTimeout> | undefined;
  let published = "";
  function publish(f: any, world: World) {
    if (world.teacher !== s.uid || !world.classroom) return;
    const building = campusBuilding(world, f.now())!;
    const signature = JSON.stringify({...building, updatedAt: 0});
    if (signature === published) return;
    clearTimeout(publicationTimer);
    publicationTimer = setTimeout(async () => {
      if (disposed) return;
      try {
        await f.set(f.ref(f.db, `campuses/${building.serverId}/${world.code}`), building);
        published = signature;
      } catch (e) { error(Error("학급 건물 공유 연결을 확인해 주세요: " + (e as Error).message)); }
    }, 250);
  }
  async function drain(f: any) {
    if (disposed || running || !latest || latest.state.teacher !== s.uid)
      return;
    const requests = Object.entries(latest.inbox || {})
      .flatMap(([user, entries]) =>
        Object.entries(entries).map(([id, r]) => ({ user, id, ...r })),
      )
      .slice(0, 60);
    if (!requests.length) return;
    running = true;
    try {
      const r = await f.runTransaction(
        f.ref(f.db, `${roomPath(s)}/state`),
        (raw: any) => {
          if (!raw) return raw;
          let w = normalize(raw) as Envelope["state"];
          w.receipts ||= {};
          for (const request of requests) {
            if (w.receipts[request.id]) continue;
            try {
              if (!latest?.members[request.user])
                throw Error("방 참가자가 아니에요. 다시 입장해 주세요.");
              w = apply(
                w,
                request.user,
                { ...request.command, id: request.id },
                positions[roomId(s)] || {},
                f.now(),
              ) as Envelope["state"];
              w.receipts ||= {};
              w.receipts[request.id] = {
                uid: request.user,
                ok: true,
                message: "완료",
                at: f.now(),
              };
            } catch (e) {
              w.receipts ||= {};
              w.receipts[request.id] = {
                uid: request.user,
                ok: false,
                message: (e as Error).message,
                at: f.now(),
              };
            }
          }
          const entries = Object.entries(w.receipts || {}).sort(
            (a, b) => a[1].at - b[1].at,
          );
          while (entries.length > 250) {
            const [id] = entries.shift()!;
            delete w.receipts![id];
          }
          return w;
        },
        { applyLocally: false },
      );
      if (r.committed) {
        const updates: Record<string, null> = {};
        for (const q of requests) updates[`inbox/${q.user}/${q.id}`] = null;
        await f.update(f.ref(f.db, roomPath(s)), updates);
      }
    } catch (e) {
      error(e as Error);
    } finally {
      running = false;
      if (!disposed)
        timer = setTimeout(() => {
          timer = undefined;
          drain(f);
        }, 50);
    }
  }
  if (s.mode === "local") {
    const update = () => {
      try {
        const e = localRead(roomId(s));
        receive(e ? { ...e, state: normalize(e.state) } : null);
      } catch (e) {
        error(e as Error);
      }
    };
    listeners.add(update);
    update();
    stop = () => listeners.delete(update);
  } else {
    firebase()
      .then((f) => {
        if (disposed) return;
        stop = f.onValue(
          f.ref(f.db, roomPath(s)),
          (snap: any) => {
            const e = snap.val();
            latest = e
              ? {
                  state: normalize(e.state),
                  positions: e.positions || {},
                  members: e.members || {},
                  inbox: e.inbox || {},
                }
              : null;
            rememberPositions(s, latest?.positions || {});
            receive(latest);
            if (latest) publish(f, latest.state);
            if (latest?.state.teacher === s.uid && !running && !timer) {
              timer = setTimeout(() => {
                timer = undefined;
                drain(f);
              }, 40);
            }
          },
          error,
        );
      })
      .catch(error);
  }
  return () => {
    disposed = true;
    clearTimeout(timer);
    clearTimeout(publicationTimer);
    stop();
  };
}
export async function transact(
  s: Session,
  command: Command,
  actor = s.uid,
): Promise<void> {
  if (s.mode === "firebase" && actor !== s.uid)
    throw Error("다른 사람의 행동을 대신할 수 없어요.");
  const cmd = { ...command, id: crypto.randomUUID() };
  if (s.mode === "local") {
    await lock(roomId(s), () => {
      const e = localRead(roomId(s));
      if (!e) throw Error("삭제된 방이에요.");
      e.state = apply(e.state, actor, cmd, e.positions);
      localWrite(roomId(s), e);
    });
    return;
  }
  const f = await firebase(),
    stateRef = f.ref(f.db, `${roomPath(s)}/state`),
    snapshot = await f.get(stateRef),
    seed = snapshot.val();
  if (!seed) throw Error("삭제된 방이에요.");
  if (seed.teacher === s.uid) {
    let failure: Error | undefined;
    const result = await f.runTransaction(
      stateRef,
      (raw: any) => {
        try {
          failure = undefined;
          return apply(
            raw || seed,
            actor,
            cmd,
            positions[roomId(s)] || {},
            f.now(),
          );
        } catch (e) {
          failure = e as Error;
          return undefined;
        }
      },
      { applyLocally: false },
    );
    if (!result.committed)
      throw failure || Error("동기화 중이에요. 다시 시도해 주세요.");
    return;
  }
  const receipt = f.ref(f.db, `${roomPath(s)}/state/receipts/${cmd.id}`);
  await f.set(f.ref(f.db, `${roomPath(s)}/inbox/${s.uid}/${cmd.id}`), {
    command: cmd,
    at: f.now(),
  });
  return new Promise<void>((resolve, reject) => {
    let stop = () => {};
    const timeout = setTimeout(() => {
      stop();
      reject(
        Error(
          "교사 화면이 연결되어 있는지 확인해 주세요. 요청은 대기 중이므로 다시 누르기 전에 결과를 확인해 주세요.",
        ),
      );
    }, 25000);
    stop = f.onValue(
      receipt,
      (r: any) => {
        const v = r.val();
        if (v) {
          clearTimeout(timeout);
          queueMicrotask(() => stop());
          v.ok ? resolve() : reject(Error(v.message));
        }
      },
      (e: Error) => {
        clearTimeout(timeout);
        queueMicrotask(() => stop());
        reject(e);
      },
    );
  });
}
export async function move(s: Session, p: Position, actor = s.uid) {
  if (s.mode === "firebase" && actor !== s.uid) return;
  if (s.mode === "local") {
    await lock(roomId(s), () => {
      const e = localRead(roomId(s));
      if (!e) return;
      e.positions[actor] = p;
      localWrite(roomId(s), e);
    });
  } else {
    const f = await firebase();
    await f.set(f.ref(f.db, `${roomPath(s)}/positions/${actor}`), {
      ...p,
      at: f.now(),
    });
  }
}
export async function deleteRoom(s: Session) {
  if (s.mode === "local") {
    await lock(roomId(s), () => {
      const e = localRead(roomId(s));
      if (e?.state.teacher !== s.uid) throw Error("교사만 삭제할 수 있어요.");
      localStorage.removeItem(key(roomId(s)));
      channel?.postMessage(s.code);
      listeners.forEach((fn) => fn());
    });
  } else {
    const f = await firebase();
    if (s.serverId) {
      await f.remove(f.ref(f.db, `campuses/${s.serverId}/${s.code}`));
    }
    await f.remove(f.ref(f.db, roomPath(s)));
  }
  forgetSession();
}

/** Shared world publishes only a class's representative building, never students or reflections. */
export function subscribeCampuses(mode: Session["mode"], receive: (buildings: CampusBuilding[]) => void, error: (e: Error) => void): () => void {
  let disposed = false;
  let stop = () => {};
  if (mode === "local") {
    const update = () => {
      const buildings: CampusBuilding[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (!k.startsWith("nationlab-room-")) continue;
        try { const e = JSON.parse(localStorage.getItem(k)!); const b = campusBuilding(e.state, e.state.revision || 0); if (b) buildings.push(b); } catch {}
      }
      receive(buildings);
    };
    listeners.add(update); update(); stop = () => { listeners.delete(update); };
  } else {
    firebase().then(f => {
      if (disposed) return;
      stop = f.onValue(f.ref(f.db, "campuses"), (snap: any) => {
        const records = snap.val() || {};
        receive(Object.values(records).flatMap((server: any) => Object.values(server)) as CampusBuilding[]);
      }, error);
    }).catch(error);
  }
  return () => { disposed = true; stop(); };
}
