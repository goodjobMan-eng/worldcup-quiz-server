import SandboxApp from './sandbox/SandboxApp';
import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps } from "react";
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Box,
  Check,
  ChevronRight,
  Compass,
  Download,
  Flag,
  Globe2,
  Hammer,
  Heart,
  Layers,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  Ship,
  Sparkles,
  Trash2,
  Users,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import QRCode from "qrcode";
import ServerPicker from "./nationlab/ServerPicker";
import FirstPersonControls, { requestGameFullscreen } from "./nationlab/FirstPersonControls";
import { regions, serverId, type CampusBuilding } from "./nationlab/servers";
const KoreaWorld = lazy(() => import("./nationlab/KoreaWorld"));
const IslandView = lazy(() => import("./nationlab/Island"));
function Island(props: ComponentProps<typeof IslandView>) {
  return <Suspense fallback={<div className="island-loading" role="status">작은 섬을 만들고 있어요…</div>}><IslandView {...props} /></Suspense>;
}
import {
  World,
  Position,
  Basket,
  Command,
  config,
  spawn,
  progress,
  worldProgress,
  pathTo,
  walkable,
  adjacent,
  port,
  tradeClosed,
  tradePotential,
  origins,
  reflectionCSV,
} from "./nationlab/engine";
import {
  Session,
  Envelope,
  createRoom,
  joinRoom,
  restoreSession,
  forgetSession,
  subscribe,
  transact,
  move,
  deleteRoom,
  configured,
  rememberPositions,
  subscribeCampuses,
  serverNow,
} from "./nationlab/service";
const pct = (n: number) => Math.round(n * 100) + "%";
const phaseNames: Record<string, string> = {
  lobby: "대기실",
  meeting: "회의",
  activity: "활동",
  settlement: "정산",
  ended: "수업 마침",
};
const emptyBasket = (): Basket => ({ goods: {}, gold: 0 });
function download(name: string, text: string, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function LegacyApp() {
  const cfg = config();
  const params = new URLSearchParams(location.search);
  const [session, setSession] = useState<Session | null>(restoreSession);
  const [env, setEnv] = useState<Envelope | null>(null);
  const [role, setRole] = useState(params.has("room") ? "student" : "teacher");
  const [mode, setMode] = useState<Session["mode"]>(
    params.get("mode") === "local" ? "local" : "firebase",
  );
  const [code, setCode] = useState(params.get("room") || "");
  const [nickname, setNickname] = useState("");
  const initialRegion = regions().find(r => r.id === params.get("region")) || regions()[0];
  const [regionId, setRegionId] = useState(initialRegion.id);
  const [district, setDistrict] = useState(initialRegion.districts.includes(params.get("district") || "") ? params.get("district")! : initialRegion.districts[0]);
  const [school, setSchool] = useState("");
  const [className, setClassName] = useState("");
  const [buildingCountry, setBuildingCountry] = useState("hualian");
  const [campuses, setCampuses] = useState<CampusBuilding[]>([]);
  const [directoryError, setDirectoryError] = useState("");
  const [atlasOpen, setAtlasOpen] = useState(false);
  function chooseServer(region: string, area: string) { setRegionId(region); setDistrict(area); }

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("island");
  const [panel, setPanel] = useState("warehouse");
  const [selected, setSelected] = useState<Position | null>(null);
  const [origin, setOrigin] = useState(false);
  const [viewCountry, setViewCountry] = useState(cfg.countries[0].id);
  const [pilot, setPilot] = useState("teacher");
  const [clock, setClock] = useState(Date.now());
  const [guide, setGuide] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [moving, setMoving] = useState(false);
  const walking = useRef(0);
  const miningLock = useRef(false);
  const [studentView, setStudentView] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [look, setLook] = useState({yaw: 0, pitch: -0.22});
  const [aim, setAim] = useState<Position | null>(null);
  const [rendererType, setRendererType] = useState("webgl");
  const directMoveBusy = useRef(false);
  const [mining, setMining] = useState<{ node: string; actor: string } | null>(null);
  const [qr, setQr] = useState("");
  const [confirm, setConfirm] = useState("");
  const [to, setTo] = useState(cfg.countries[1].id);
  const [give, setGive] = useState<Basket>(emptyBasket);
  const [receive, setReceive] = useState<Basket>(emptyBasket);
  const [counterOf, setCounterOf] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [filterRound, setFilterRound] = useState("all");
  const [event, setEvent] = useState({
    id: "none",
    country: cfg.countries[0].id,
    good: "wood",
    facility: "furnace",
  });
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const tick = setInterval(() => setClock(serverNow()), 500);
    const connect = () => setOnline(navigator.onLine);
    window.addEventListener("online", connect);
    window.addEventListener("offline", connect);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", connect);
      window.removeEventListener("offline", connect);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    setDeleted(false);
    return subscribe(
      session,
      (e) => {
        if (!e) {
          setDeleted(true);
          return;
        }
        rememberPositions(session, e.positions);
        setEnv(e);
      },
      (e) => setError("연결을 확인해 주세요: " + e.message),
    );
  }, [session]);
  const w = env?.state;
  const host = !!w && w.teacher === session?.uid;
  const selectedServer = serverId(regionId, district);
  useEffect(() => {
    if (w?.classroom) { setRegionId(w.classroom.regionId); setDistrict(w.classroom.district); }
  }, [session?.code, w?.classroom?.serverId]);
  useEffect(() => {
    setDirectoryError("");
    const accessMode = session?.mode || (configured() ? mode : "local");
    return subscribeCampuses(accessMode, setCampuses, e => setDirectoryError(e.message));
  }, [session?.mode, mode]);

  const actor =
    session?.demo && pilot !== "teacher" ? pilot : session?.uid || "";
  const p = w?.players[actor];
  const cid = p?.country || viewCountry;
  const country = w?.countries[cid];
  const spec = w?.config.countries.find((c: any) => c.id === cid);
  const pos = env?.positions[actor] || (w ? spawn(w, actor) : { x: 4, y: 10 });
  const time = w ? Math.max(0, Math.ceil((w.phaseEnd - clock) / 1000)) : 0;
  const active = w?.phase === "activity" && time > 0 && online;
  const editable = !!p && active && !busy;
  const ownHost = host && pilot === "teacher";
  const immersive = !!p?.country && studentView && tab === "island" && w?.phase !== "lobby";
  useEffect(() => {
    if (!immersive) return;
    const before = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, [immersive]);
  const closeReason = w ? tradeClosed(w, cid) : "";
  const atPort = !!w && adjacent(pos, port(w));
  const reflectedRound =
    w?.phase === "meeting" ? Math.max(0, w.round - 1) : w?.round || 0;
  const questions = w
    ? reflectedRound === 1
      ? w.config.reflections.first
      : w.config.reflections.regular
    : [];
  useEffect(() => {
    walking.current++;
    setMoving(false);
    setSelected(null);
    setAim(null);
    setDrawer(w?.phase === "settlement");
    if (w?.phase === "settlement") setPanel("reflect");
  }, [actor, w?.phase, cid]);
  useEffect(() => {
    if (!w || !actor) return;
    const r = w.reflections[String(reflectedRound)]?.[actor];
    setAnswers(r?.answers || questions.map(() => ""));
  }, [reflectedRound, actor]);
  useEffect(() => {
    if (!session) return;
    const url =
      location.origin +
      location.pathname +
      "?room=" +
      session.code +
      "&mode=" +
      session.mode + (w?.classroom ? "&region=" + encodeURIComponent(w.classroom.regionId) + "&district=" + encodeURIComponent(w.classroom.district) : "");
    QRCode.toDataURL(url, {
      width: 180,
      margin: 1,
      color: { dark: "#28443e", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => {});
  }, [session, w?.classroom?.serverId]);
  async function enter(demo = false) {
    if (!demo && role === "student") requestGameFullscreen();
    setStudentView(true);
    setBusy(true);
    setError("");
    try {
      if (!demo && mode === "firebase" && !configured())
        throw Error(
          "아직 Firebase 웹 설정값이 없어요. 먼저 혼자 체험하거나 README를 따라 config.js를 연결해 주세요.",
        );
      const classroom = {regionId, district, serverId: selectedServer, school: demo ? "체험초등학교" : school, className: demo ? "6학년 체험반" : className, buildingCountry};
      const s = demo
        ? await createRoom("local", true, classroom)
        : role === "teacher"
          ? await createRoom(mode, false, classroom)
          : await joinRoom(code.trim(), nickname, mode, selectedServer);
      setEnv(null);
      setSession(s);
      setTab(demo ? "teacher" : "island");
      setPilot("teacher");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function act(command: Command, asTeacher = false) {
    if (!session || miningLock.current) return;
    const miningTicket = walking.current;
    if (command.type === "mine") {
      miningLock.current = true;
      setMining({ node: command.node, actor });
    }
    setBusy(true);
    setError("");
    try {
      if (command.type === "mine") {
        await new Promise((r) => setTimeout(r, 650));
        if (miningTicket !== walking.current) return;
      }
      await transact(session, command, asTeacher ? session.uid : actor);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (command.type === "mine") {
        miningLock.current = false;
        setMining(null);
      }
      setBusy(false);
    }
  }
  function exit() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    walking.current++;
    forgetSession();
    setSession(null);
    setEnv(null);
    setDeleted(false);
    setError("");
  }
  async function travel(target: Position, harvestNode?: string) {
    if (!w || !p?.country || !active || !session) return;
    const route = pathTo(w, p.country, pos, target);
    const ticket = ++walking.current;
    setMoving(route.length > 0);
    try {
      if (!env?.positions[actor]) await move(session, pos, actor);
      for (const step of route) {
        if (ticket !== walking.current) break;
        await move(session, step, actor);
        await new Promise((r) => setTimeout(r, 110));
      }
      const destination = route.length ? route[route.length - 1] : pos;
      if (harvestNode && ticket === walking.current && adjacent(destination, target)) {
        await act({ type: "mine", node: harvestNode });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (ticket === walking.current) setMoving(false);
    }
  }
  function tap(tile: Position) {
    if (!w || miningLock.current) return;
    setSelected(tile);
    const node = Object.values(country!.nodes).find(
        (n) => n.x === tile.x && n.y === tile.y,
      ),
      site = Object.values(country!.sites).find(
        (n) => n.x === tile.x && n.y === tile.y,
      ),
      facility = Object.entries(country!.facilities).find(
        ([, n]) => n.x === tile.x && n.y === tile.y,
      );
    if (facility) setPanel("craft");
    else if (tile.x === port(w).x && tile.y === port(w).y) setPanel("trade");
    else if (site) setPanel("build");
    else if (node) setPanel("warehouse");
    if (p && active) travel(tile, node && p.stamina > 0 ? node.id : undefined);
  }
  async function step(dx: number, dy: number) {
    if (!w || !p || !session || !active || moving || miningLock.current) return;
    const next = { x: pos.x + dx, y: pos.y + dy };
    if (walkable(w, cid, next)) {
      walking.current++;
      try {
        await move(session, next, actor);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }
  const selectedNode =
    country && selected
      ? Object.values(country.nodes).find(
          (n) => n.x === selected.x && n.y === selected.y,
        )
      : null;
  const selectedSite =
    country && selected
      ? Object.values(country.sites).find(
          (n) => n.x === selected.x && n.y === selected.y,
        )
      : null;
  function counter(o: any) {
    setTo(o.from === cid ? o.to : o.from);
    setGive(o.from === cid ? o.give : o.receive);
    setReceive(o.from === cid ? o.receive : o.give);
    setCounterOf(o.id);
    setPanel("trade");
    setTab("island");
  }
  const aimNode = aim && country && Object.values(country.nodes).find(n => n.x === aim.x && n.y === aim.y);
  const aimSite = aim && country && Object.values(country.sites).find(n => n.x === aim.x && n.y === aim.y);
  const aimFacility = aim && country && Object.entries(country.facilities).find(([, n]) => n.x === aim.x && n.y === aim.y);
  const aimPort = aim && w && aim.x === port(w).x && aim.y === port(w).y;
  const targetReachable = aim && adjacent(pos, aim) && !!(aimNode || aimSite || aimFacility || aimPort);
  const targetLabel = aimNode ? w!.config.goods[aimNode.good].name : aimFacility ? w!.config.facilities[aimFacility[0]] : aimPort ? "항구" : aimSite ? w!.config.goods[aimSite.good].name + " 건축 부지" : "";
  async function directMove(forward: number, right: number) {
    if (!active || !session || !p || !w || drawer || miningLock.current || directMoveBusy.current) return;
    const yaw = rendererType === "2d" ? 0 : look.yaw;
    const x = -Math.sin(yaw) * forward + Math.cos(yaw) * right;
    const y = -Math.cos(yaw) * forward - Math.sin(yaw) * right;
    const next = {x:pos.x + (Math.abs(x) > Math.abs(y) ? Math.sign(x) : 0), y:pos.y + (Math.abs(x) > Math.abs(y) ? 0 : Math.sign(y))};
    if (!walkable(w, cid, next)) return;
    walking.current++; directMoveBusy.current = true;
    try {await move(session,next,actor);} catch(e){setError((e as Error).message);} finally {directMoveBusy.current = false;}
  }
  function useAim() {
    if (!editable || !aim || !targetReachable) return;
    setSelected(aim);
    if (aimNode) { if (p!.stamina <= 0) {setError("체력을 모두 썼어요. 친구들과 가공·교역을 해 보세요.");return;} void act({type:"mine",node:aimNode.id}); }
    else if (aimFacility) {setPanel("craft");setDrawer(true);}
    else if (aimPort) {setPanel("trade");setDrawer(true);}
    else if (aimSite && !aimSite.unit) {void act({type:"build",site:aimSite.id});}
    else {setPanel("build");setDrawer(true);}
  }
  const offerText = (b: Basket) =>
    [
      ...Object.entries(b.goods || {})
        .filter(([, n]) => n > 0)
        .map(([g, n]) => `${w?.config.goods[g].name} ${n}개`),
      ...(b.gold ? [`${b.gold} G`] : []),
    ].join(" + ") || "없음";
  return (
    <div className={"nl-app" + (immersive ? " immersive" + (drawer ? " drawer-open" + (panel === "reflect" ? " reflection-open" : "") : "") : "")}>
      {immersive && <FirstPersonControls nickname={p!.nickname} country={spec.name} stamina={p!.stamina} progress={worldProgress(w!)} phase={phaseNames[w!.phase]} time={time} active={!!active} mining={!!mining} aimLabel={targetLabel} canUse={!!targetReachable} onMove={directMove} onUse={useAim} onPanel={id => {if(id === "reflect" && w?.phase !== "settlement" && !(w?.phase === "meeting" && w.round > 1)){setError("성찰은 정산 시간에 적어요.");return;}setPanel(id);setDrawer(true);}} onOverview={() => {setStudentView(false); if(document.fullscreenElement) void document.exitFullscreen().catch(()=>{});}} onFullscreen={requestGameFullscreen} drawer={drawer} closeDrawer={() => setDrawer(false)} notice={error || (rendererType === "2d" ? "이 기기는 2D 지도로 플레이해요." : "")} />}
      <header className="nl-header">
        <div className="nl-logo">
          <span className="logo-cube">
            <Box size={25} />
          </span>
          <div>
            NATION<span>LAB</span>
            <small>우리 교실의 작은 세계</small>
          </div>
        </div>
        <div className="header-middle">
          <span className="tiny-dot" /> 함께 만들어 가는 세계
        </div>
        <div className="header-actions">
          {session && (
            <span className={"connection " + (!online ? "offline" : "")}>
              {session.mode === "firebase" ? "실시간 수업" : "같은 기기 연습"}
            </span>
          )}
          <button
            className="icon-button"
            onClick={() => setGuide(true)}
            aria-label="게임 안내"
          >
            <BookOpen size={20} />
          </button>
          {session && (
            <button
              className="icon-button"
              onClick={() => setConfirm("exit")}
              aria-label="접속 화면으로"
            >
              <ArrowLeft size={20} />
            </button>
          )}
        </div>
      </header>
      {!session ? (
        <main className="landing">
          <section className="landing-copy">
            <div className="overline">캐고 · 만들고 · 나누며 배우는 무역</div>
            <h1>대한민국에 세우는,<br />우리 학급의 건물.</h1>
            <p>
              교육청과 교육지원청 서버를 고르고 시작해요.
              <br />자원을 캐고, 가공하고, 친구들과 건물을 지어요.
              <br />같은 세계에서 다른 학교의 건물도 구경할 수 있어요.
            </p>
            <button className="secondary wide atlas-entry" onClick={() => setAtlasOpen(!atlasOpen)}><Globe2 size={20}/>{atlasOpen ? "대한민국 지도 닫기" : "대한민국 월드 둘러보기"}</button>
            <div className="landing-islands">
              {cfg.countries.map((c: any, i: number) => (
                <div className={"pixel-island island-" + i} key={c.id}>
                  <span className="pixel-building">{["▦", "▤", "▥"][i]}</span>
                  <b>{c.short}</b>
                  <small>{c.biome}</small>
                </div>
              ))}
            </div>
            <div className="learning-tags">
              <span>
                <Heart size={15} /> 순위 대신 함께 성장
              </span>
              <span>
                <Ship size={15} /> 교역으로 연결되는 섬
              </span>
            </div>
          </section>
          <section className="entry-card">
            <span className="card-kicker">새로운 세계로, 입장</span>
            <h2>어느 서버에서 만날까요?</h2>
            <ServerPicker regionId={regionId} district={district} onChange={chooseServer} disabled={busy} />
            <div className="segmented">
              <button
                className={role === "teacher" ? "selected" : ""}
                onClick={() => setRole("teacher")}
              >
                <Flag size={17} /> 선생님
              </button>
              <button
                className={role === "student" ? "selected" : ""}
                onClick={() => setRole("student")}
              >
                <Users size={17} /> 학생
              </button>
            </div>
            <label>
              접속 방식
              <select
                aria-label="접속 방식"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
              >
                <option value="firebase">실시간 수업 · Firebase</option>
                <option value="local">같은 기기에서 연습</option>
              </select>
            </label>
            {role === "teacher" && <div className="classroom-fields">
              <label>학교 이름<input aria-label="학교 이름" value={school} maxLength={40} placeholder="예: 한빛초등학교" onChange={e => setSchool(e.target.value)}/></label>
              <label>학급<input aria-label="학급" value={className} maxLength={24} placeholder="예: 6학년 2반" onChange={e => setClassName(e.target.value)}/></label>
              <label>학급 대표 건물<select aria-label="학급 대표 건물" value={buildingCountry} onChange={e => setBuildingCountry(e.target.value)}>{cfg.countries.map((c: any) => <option key={c.id} value={c.id}>{c.building.name}</option>)}</select></label>
              <small>학교·학급 이름과 대표 건축 진행률이 대한민국 월드에 표시돼요.</small>
            </div>}
            {role === "student" ? (
              <>
                <label>
                  방 코드
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="숫자 4자리"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
                <label>
                  나의 별명
                  <input
                    maxLength={16}
                    placeholder="실명 대신 별명을 적어요"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <div className="entry-info">
                <Compass size={24} />
                <div>
                  <b>3개 나라 · {cfg.rounds}라운드</b>
                  <p>
                    방을 만든 뒤 코드나 QR을 공유해요.
                    <br />
                    인원은 7~40명, 첫 체험은 3명도 가능해요.
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="notice" role="alert">
                {error}
              </div>
            )}
            <button
              className="primary wide"
              disabled={
                busy ||
                (role === "student" && (code.length !== 4 || !nickname.trim())) ||
                (role === "teacher" && (!school.trim() || !className.trim()))
              }
              onClick={() => enter()}
            >
              {busy
                ? "연결하는 중…"
                : role === "teacher"
                  ? "우리 교실 방 만들기"
                  : "함께 시작하기"}
              <ArrowRight size={18} />
            </button>
            <div className="entry-divider">
              <span>설정 없이 먼저 둘러보고 싶다면</span>
            </div>
            <button
              className="secondary wide"
              disabled={busy}
              onClick={() => enter(true)}
            >
              <Play size={16} /> 혼자 체험하기
            </button>
            <p className="micro">
              {configured()
                ? "Firebase 연결 설정이 준비되어 있어요."
                : "Firebase 설정 전이에요. 혼자 체험하기는 바로 가능해요."}
            </p>
          </section>
          {atlasOpen && <section className="landing-atlas"><Suspense fallback={<div className="island-loading">대한민국을 펼치고 있어요…</div>}><KoreaWorld regions={regions()} buildings={campuses} selectedRegion={regionId} selectedServer={selectedServer} onSelectRegion={id => chooseServer(id, regions().find(r => r.id === id)!.districts[0])}/></Suspense>{directoryError && <p role="alert">공동 월드 연결을 확인해 주세요: {directoryError}</p>}<p className="micro">{mode === "local" || !configured() ? "연습 지도에는 이 브라우저에서 만든 학급만 표시돼요." : "대한민국 지도에 공유된 학급 건물이에요."}</p></section>}
        </main>
      ) : deleted ? (
        <main className="empty-room">
          <Trash2 size={40} />
          <h1>선생님이 이 방을 삭제했어요.</h1>
          <p>새 수업 코드를 받아 다시 입장해 주세요.</p>
          <button className="primary" onClick={exit}>
            접속 화면으로
          </button>
        </main>
      ) : !w ? (
        <main className="empty-room">
          <RefreshCw className="spin" />
          <h2>우리 세계를 불러오고 있어요…</h2>
          {error && (
            <div role="alert" className="notice">
              {error}
              <button onClick={exit}>다시 입장</button>
            </div>
          )}
        </main>
      ) : (
        <>
          {w.classroom && <div className="server-banner"><span><b>{regions().find(r => r.id === w.classroom!.regionId)?.short} · {w.classroom.district} 서버</b> / {w.classroom.school} · {w.classroom.className}</span><button onClick={() => setTab("korea")}><Globe2 size={16}/>대한민국 월드</button><button onClick={exit}>서버 바꾸기</button></div>}
          <div className="world-strip">
            <div className="world-title">
              <Globe2 size={22} />
              <div>
                <small>함께 만드는 세계</small>
                <b>세계 건축 진행률</b>
              </div>
            </div>
            <div className="world-meter">
              <div style={{ width: pct(worldProgress(w)) }} />
            </div>
            <strong>{pct(worldProgress(w))}</strong>
            <div className="world-phase">
              <span>
                {w.round || "준비"}
                {w.round ? ` / ${w.config.rounds}라운드` : ""}
              </span>
              <b>{phaseNames[w.phase]}</b>
              <span className="time-display">
                {w.phaseEnd
                  ? `${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`
                  : "—"}
              </span>
            </div>
            <div className="room-chip">
              방 코드 <b>{w.code}</b>
            </div>
          </div>
          <div className="workspace">
            <aside className="rail">
              <button
                aria-label="우리 섬"
                className={tab === "island" ? "active" : ""}
                onClick={() => setTab("island")}
              >
                <Compass />
                <span>우리 섬</span>
              </button>
              <button
                aria-label="세계 지도"
                className={tab === "world" ? "active" : ""}
                onClick={() => setTab("world")}
              >
                <Globe2 />
                <span>세계 지도</span>
              </button>
              <button aria-label="대한민국 월드" className={tab === "korea" ? "active" : ""} onClick={() => setTab("korea")}><Globe2/><span>대한민국</span></button>
              <button
                aria-label="교역 기록"
                className={tab === "records" ? "active" : ""}
                onClick={() => setTab("records")}
              >
                <BookOpen />
                <span>기록</span>
              </button>
              {host && (
                <button
                  aria-label="교사 화면"
                  className={tab === "teacher" ? "active" : ""}
                  onClick={() => setTab("teacher")}
                >
                  <Settings2 />
                  <span>선생님</span>
                </button>
              )}
              <div className="rail-bottom">
                <span className="dot" />
                <small>{session.demo ? "체험 세계" : "공유 세계"}</small>
              </div>
            </aside>
            <main className="game-main">
              {error && (
                <div className="notice" role="alert">
                  {error}
                  <button aria-label="알림 닫기" onClick={() => setError("")}>
                    <X size={17} />
                  </button>
                </div>
              )}
              {session.demo && (
                <div className="demo-bar">
                  <span>
                    <Sparkles size={16} /> 혼자 체험 · 세 나라 학생을 번갈아
                    조작할 수 있어요.
                  </span>
                  <select
                    aria-label="체험 역할"
                    value={pilot}
                    onChange={(e) => {
                      setPilot(e.target.value);
                      setStudentView(true);
                      if (e.target.value !== "teacher") requestGameFullscreen();
                      if (e.target.value !== "teacher")
                        setViewCountry(w.players[e.target.value].country);
                    }}
                  >
                    <option value="teacher">선생님 체험</option>
                    {Object.values(w.players).map((p) => (
                      <option key={p.id} value={p.id}>
                        {
                          w.config.countries.find(
                            (c: any) => c.id === p.country,
                          )?.short
                        }{" "}
                        학생 · {p.nickname}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {tab === "korea" && <section className="korea-page">
                <div className="page-title"><div className="overline">학교와 학교가 만나는 곳</div><h1>대한민국 공동 월드</h1><p>학급마다 대표 건물 하나를 세워요. 지도에서 다른 학교의 건축 진행률도 볼 수 있어요.</p></div>
                <ServerPicker regionId={regionId} district={district} onChange={chooseServer}/>
                <p className="micro">지도 서버 선택은 구경할 지역을 바꿔요. 입장 서버를 바꾸려면 위의 ‘서버 바꾸기’를 눌러 주세요.</p>
                <Suspense fallback={<div className="island-loading">대한민국을 펼치고 있어요…</div>}><KoreaWorld regions={regions()} buildings={campuses} selectedRegion={regionId} selectedServer={selectedServer} onSelectRegion={id => chooseServer(id, regions().find(r => r.id === id)!.districts[0])}/></Suspense>
                {directoryError && <p className="notice" role="alert">공동 월드 연결을 확인해 주세요: {directoryError}</p>}
                <p className="micro">{session.mode === "local" ? "같은 기기 연습 · 이 브라우저에서 만든 학급만 표시돼요." : "실시간 공동 월드 · 교사 화면에서 건축 진행률을 공유해요."} 현재 수업에서는 선택한 나라의 건축 목표를 학급 대표 건물로 표시합니다.</p>
              </section>}
              {tab === "island" && (
                <>
                  {w.phase === "lobby" && !host ? (
                    <div className="waiting-card">
                      <Users size={34} />
                      <h2>{p?.nickname || nickname}, 반가워요!</h2>
                      <p>
                        {p?.country
                          ? `${w.config.countries.find((c: any) => c.id === p.country)?.name}에 배정되었어요.`
                          : "선생님이 나라를 배정하고 있어요."}
                      </p>
                      <p>
                        같은 나라 친구와 어떤 역할을 맡을지 이야기해 보세요.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="island-heading">
                        <div>
                          <div className="overline">
                            {spec?.biome} ·{" "}
                            {p ? `${p.nickname}의 나라` : "섬 둘러보기"}
                          </div>
                          <h1>
                            {spec?.name}{" "}
                            <span
                              className="nation-dot"
                              style={{ background: spec?.color }}
                            />
                          </h1>
                        </div>
                        <div className="island-heading-right">
                          {!p && (
                            <select
                              aria-label="보는 섬"
                              value={viewCountry}
                              onChange={(e) => setViewCountry(e.target.value)}
                            >
                              {w.config.countries.map((c: any) => (
                                <option value={c.id} key={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {p && (
                            <div className="stamina">
                              <Heart size={17} />
                              <b>{p.stamina}</b>
                              <small>/ {w.config.stamina} 체력</small>
                            </div>
                          )}
                          <button
                            className={
                              origin ? "origin-button on" : "origin-button"
                            }
                            onClick={() => setOrigin(!origin)}
                          >
                            <Layers size={16} /> 원산지{" "}
                            {origin ? "켜짐" : "보기"}
                          </button>
                        </div>
                      </div>
                      <div className="phase-banner">
                        <span>
                          {w.phase === "activity"
                            ? time > 0
                              ? "자원을 탭하면 다가가서 채집해요. 시설에서는 만들기를 눌러요."
                              : "활동 시간이 끝났어요. 선생님의 단계 전환을 기다려요."
                            : w.phase === "meeting"
                              ? "회의 시간 · 이동은 잠시 쉬고, 필요한 자원과 교역 계획을 이야기해요."
                              : w.phase === "settlement"
                                ? "정산 시간 · 이번 교역이 서로에게 어떤 도움이 되었는지 기록해요."
                                : w.phase === "ended"
                                  ? "함께 만든 건물의 원산지를 살펴보며 우리 세계를 돌아봐요."
                                  : "선생님 화면에서 학생을 배정하고 1라운드를 시작해 주세요."}
                        </span>
                        <span className="event-tag">
                          {w.round === 1
                            ? "국경 닫힘"
                            : w.config.events.find(
                                (e: any) => e.id === w.event.id,
                              )?.name}
                        </span>
                      </div>
                      {p &&
                        Object.values(w.offers).some(
                          (o) => o.to === cid && o.status === "open",
                        ) && (
                          <div className="incoming-trade">
                            <Ship size={20} />
                            <span>
                              다른 나라에서 교역 제안이 왔어요. 나라 친구들과
                              함께 살펴보세요.
                            </span>
                            <button
                              className="secondary"
                              onClick={() => setPanel("trade")}
                            >
                              제안 보기
                            </button>
                          </div>
                        )}
                      <div className="island-layout">
                        <section
                          className="map-card"
                          style={
                            {
                              "--map-aspect":
                                w.config.map.width / w.config.map.height,
                            } as any
                          }
                        >
                          <div className="map-top">
                            <span>
                              <Flag size={15} /> {spec?.building.name}
                            </span>
                            <b>{pct(progress(w, cid))} 완성</b>
                          </div>
                          <Island
                            world={w}
                            country={cid}
                            positions={env!.positions}
                            uid={actor}
                            origin={origin}
                            selected={selected}
                            mining={mining}
                            firstPerson={immersive && rendererType !== "2d" ? look : undefined}
                            onLook={(dx: number, dy: number) => setLook(l => ({yaw: l.yaw - dx * .005, pitch: Math.max(-1.15, Math.min(1.05, l.pitch - dy * .005))}))}
                            onAim={setAim}
                            onRenderer={setRendererType}
                            onSelect={tap}
                          />
                          {w.trades.some((t) => clock - t.at < 2500) && (
                            <div className="boat-flight">
                              <Ship size={24} />
                              <span>교역이 이루어졌어요!</span>
                            </div>
                          )}
                          <div className="map-bottom">
                            <span>
                              <span className="avatar-marker" />{" "}
                              {p
                                ? "파란 아바타가 나예요"
                                : "선생님은 모든 섬을 볼 수 있어요"}
                            </span>
                            <span>
                              {mining
                                ? "자원을 채집하고 있어요…"
                                : moving
                                  ? "이동 중…"
                                  : "자원을 탭하면 이동해서 채집해요"}
                            </span>
                          </div>
                          {p && (
                            <div className="joystick" aria-label="이동 버튼">
                              <button
                                aria-label="위로 이동"
                                disabled={!active || moving || !!mining}
                                onClick={() => step(0, -1)}
                              >
                                <ArrowUp />
                              </button>
                              <div>
                                <button
                                  aria-label="왼쪽으로 이동"
                                  disabled={!active || moving || !!mining}
                                  onClick={() => step(-1, 0)}
                                >
                                  <ArrowLeft />
                                </button>
                                <span />
                                <button
                                  aria-label="오른쪽으로 이동"
                                  disabled={!active || moving || !!mining}
                                  onClick={() => step(1, 0)}
                                >
                                  <ArrowRight />
                                </button>
                              </div>
                              <button
                                aria-label="아래로 이동"
                                disabled={!active || moving || !!mining}
                                onClick={() => step(0, 1)}
                              >
                                <ArrowDown />
                              </button>
                            </div>
                          )}
                          {selectedNode && (
                            <div className="tile-action">
                              <div>
                                <b>
                                  {w.config.goods[selectedNode.good].name} 블록
                                </b>
                                <small>
                                  {adjacent(pos, selectedNode)
                                    ? p?.stamina === 0 ? "체력을 모두 썼어요" : mining ? "조금만 기다리면 창고에 들어가요" : "바로 옆에 도착했어요"
                                    : "가까이 이동하고 있어요"}
                                </small>
                              </div>
                              <button
                                className="primary"
                                disabled={
                                  !editable ||
                                  moving ||
                                  !adjacent(pos, selectedNode) ||
                                  !p?.stamina
                                }
                                onClick={() =>
                                  act({ type: "mine", node: selectedNode.id })
                                }
                              >
                                <Hammer size={17} />{" "}
                                {busy ? "캐는 중…" : "캐기 · 체력 1"}
                              </button>
                            </div>
                          )}
                          {selectedSite?.unit && (
                            <div className="origin-detail">
                              <Layers size={18} />
                              <div>
                                <b>
                                  {w.config.goods[selectedSite.good].name}의
                                  여행
                                </b>
                                <p>{origins(w, selectedSite.unit)}</p>
                              </div>
                            </div>
                          )}
                          <div className="map-legend">
                            <span>▧ 자원</span>
                            <span>▨ 가공 시설</span>
                            <span>▱ 건축 부지</span>
                            <span>⚑ 항구</span>
                          </div>
                        </section>
                        <aside className="side-panel">
                          <div className="panel-tabs">
                            {[
                              ["warehouse", "창고", Box],
                              ["craft", "조합", Hammer],
                              ["trade", "교역", Ship],
                              ["build", "건축", Layers],
                            ].map(([id, label, I]) => (
                              <button
                                key={id as string}
                                className={panel === id ? "active" : ""}
                                onClick={() => setPanel(id as string)}
                              >
                                <I size={18} />
                                {label as string}
                              </button>
                            ))}
                          </div>
                          {panel === "warehouse" && (
                            <>
                              <div className="side-title">
                                <h2>우리 나라 공동 창고</h2>
                                <span className="gold-chip">
                                  {country?.gold} G
                                </span>
                              </div>
                              <p className="side-help">
                                친구들이 모은 블록을 함께 사용해요.
                              </p>
                              <Inventory w={w} country={cid} />
                              <div className="teaching-note">
                                <Compass size={18} />
                                <p>
                                  우리 섬에는{" "}
                                  <b>
                                    {Object.keys(spec?.regen || {})
                                      .map((g) => w.config.goods[g].name)
                                      .join(", ")}
                                  </b>
                                  이 있어요. 없는 블록은 어디서 구할까요?
                                </p>
                              </div>
                              <h3>같은 나라 친구들</h3>
                              <div className="team-list">
                                {Object.values(w.players)
                                  .filter((p) => p.country === cid)
                                  .map((p) => (
                                    <span key={p.id}>
                                      {p.nickname}
                                      <small>♥ {p.stamina}</small>
                                    </span>
                                  ))}
                              </div>
                            </>
                          )}
                          {panel === "craft" && (
                            <>
                              <div className="side-title">
                                <h2>블록 조합하기</h2>
                                <Hammer size={20} />
                              </div>
                              <p className="side-help">
                                시설 옆에 서서 창고의 재료를 가공해요.
                              </p>
                              {Object.entries(w.config.recipes).map(
                                ([good, r]: [string, any]) => {
                                  const facility =
                                    country?.facilities[r.facility];
                                  const enough = Object.entries(r.inputs).every(
                                    ([g, n]) =>
                                      country.stock[g].length >= Number(n),
                                  );
                                  return (
                                    <div
                                      className={
                                        "recipe-card " +
                                        (!facility ? "locked" : "")
                                      }
                                      key={good}
                                    >
                                      <div className="recipe-heading">
                                        <BlockIcon w={w} good={good} />
                                        <b>
                                          {w.config.goods[good].name} {r.output}
                                          개
                                        </b>
                                        <span>
                                          {facility ? (
                                            <Hammer size={15} />
                                          ) : (
                                            <Lock size={15} />
                                          )}
                                        </span>
                                      </div>
                                      <p>
                                        {Object.entries(r.inputs)
                                          .map(
                                            ([g, n]) =>
                                              `${w.config.goods[g].name} ${n}`,
                                          )
                                          .join(" + ")}
                                      </p>
                                      {!facility ? (
                                        <small>
                                          🔒 {w.config.facilities[r.facility]}가
                                          있는 나라:{" "}
                                          {w.config.countries
                                            .filter(
                                              (c: any) =>
                                                w.countries[c.id].facilities[
                                                  r.facility
                                                ],
                                            )
                                            .map((c: any) => c.short)
                                            .join(", ")}
                                        </small>
                                      ) : (
                                        <button
                                          className="secondary wide"
                                          disabled={
                                            !editable ||
                                            !enough ||
                                            !adjacent(pos, facility)
                                          }
                                          onClick={() =>
                                            act({ type: "craft", good })
                                          }
                                        >
                                          {adjacent(pos, facility)
                                            ? "만들기"
                                            : `${w.config.facilities[r.facility]} 옆으로 이동`}
                                        </button>
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </>
                          )}
                          {panel === "build" && (
                            <>
                              <div className="side-title">
                                <h2>{spec?.building.name}</h2>
                                <span>{pct(progress(w, cid))}</span>
                              </div>
                              <p className="side-help">
                                청사진 칸 옆에서 필요한 블록을 놓아요.
                              </p>
                              {Object.entries(spec?.building.needs || {}).map(
                                ([g, n]) => (
                                  <div className="goal-row" key={g}>
                                    <BlockIcon w={w} good={g} />
                                    <span>{w.config.goods[g].name}</span>
                                    <b>
                                      {
                                        Object.values(country.sites).filter(
                                          (s) => s.good === g && s.unit,
                                        ).length
                                      }{" "}
                                      / {Number(n)}
                                    </b>
                                  </div>
                                ),
                              )}
                              {selectedSite && !selectedSite.unit && (
                                <button
                                  className="primary wide"
                                  disabled={
                                    !editable ||
                                    moving ||
                                    !adjacent(pos, selectedSite) ||
                                    !country.stock[selectedSite.good].length
                                  }
                                  onClick={() =>
                                    act({
                                      type: "build",
                                      site: selectedSite.id,
                                    })
                                  }
                                >
                                  <Plus size={18} />
                                  {w.config.goods[selectedSite.good].name} 놓기
                                </button>
                              )}
                              <div className="teaching-note">
                                <Ship size={19} />
                                <p>
                                  우리 나라만으로는 완성할 수 없어요. 다른 섬의
                                  자원과 기술을 빌려 함께 지어요.
                                </p>
                              </div>
                            </>
                          )}
                          {panel === "trade" && (
                            <>
                              <div className="side-title">
                                <h2>항구 교역</h2>
                                <Anchor size={20} />
                              </div>
                              {closeReason ? (
                                <div className="locked-port">
                                  <Lock size={27} />
                                  <h3>잠시 닫힌 항구</h3>
                                  <p>{closeReason}</p>
                                </div>
                              ) : (
                                <>
                                  <p className="side-help">
                                    서로에게 필요한 것을 나눠요. 두 나라 모두
                                    팀원 과반의 동의가 필요해요.
                                  </p>
                                  <label>
                                    상대 나라
                                    <select
                                      value={
                                        to === cid
                                          ? w.config.countries.find(
                                              (c: any) => c.id !== cid,
                                            ).id
                                          : to
                                      }
                                      onChange={(e) => setTo(e.target.value)}
                                    >
                                      {w.config.countries
                                        .filter((c: any) => c.id !== cid)
                                        .map((c: any) => (
                                          <option value={c.id} key={c.id}>
                                            {c.name}
                                          </option>
                                        ))}
                                    </select>
                                  </label>
                                  <BasketForm
                                    w={w}
                                    title="우리가 줄 것"
                                    value={give}
                                    onChange={setGive}
                                  />
                                  <BasketForm
                                    w={w}
                                    title="받고 싶은 것"
                                    value={receive}
                                    onChange={setReceive}
                                  />
                                  <div className="trade-preview">
                                    우리 시설에서 가공하면 예상 진행률
                                    <br />
                                    <b>
                                      {pct(
                                        tradePotential(w, cid, give, receive)
                                          .percentBefore,
                                      )}{" "}
                                      →{" "}
                                      {pct(
                                        tradePotential(w, cid, give, receive)
                                          .percentAfter,
                                      )}
                                    </b>
                                    <small>
                                      보유 블록과 우리 시설로 만들 수 있는 블록
                                      기준이에요.
                                    </small>
                                  </div>
                                  <button
                                    className="primary wide"
                                    disabled={!editable || !atPort}
                                    onClick={() =>
                                      act({
                                        type: "offer",
                                        to:
                                          to === cid
                                            ? w.config.countries.find(
                                                (c: any) => c.id !== cid,
                                              ).id
                                            : to,
                                        give,
                                        receive,
                                        ...(counterOf ? { counterOf } : {}),
                                      })
                                    }
                                  >
                                    {atPort
                                      ? "교역 제안 보내기"
                                      : "항구로 먼저 이동해 주세요"}
                                    <ArrowRight size={17} />
                                  </button>
                                  {counterOf && (
                                    <p className="micro">
                                      이전 제안의 역제안을 작성 중이에요.{" "}
                                      <button onClick={() => setCounterOf("")}>
                                        새 제안으로 전환
                                      </button>
                                    </p>
                                  )}
                                </>
                              )}
                              <h3 className="offers-title">우리 나라의 제안</h3>
                              {Object.values(w.offers)
                                .filter((o) => o.from === cid || o.to === cid)
                                .reverse()
                                .map((o) => (
                                  <div className="offer-card" key={o.id}>
                                    <div>
                                      <b>
                                        {
                                          w.config.countries.find(
                                            (c: any) => c.id === o.from,
                                          ).short
                                        }{" "}
                                        ↔{" "}
                                        {
                                          w.config.countries.find(
                                            (c: any) => c.id === o.to,
                                          ).short
                                        }
                                      </b>
                                      <span
                                        className={"offer-status " + o.status}
                                      >
                                        {
                                          (
                                            {
                                              open: "회의 중",
                                              accepted: "체결",
                                              rejected: "거절",
                                              expired: "지난 라운드",
                                              cancelled: "취소",
                                              countered: "역제안됨",
                                            } as any
                                          )[o.status]
                                        }
                                      </span>
                                    </div>
                                    <p>
                                      {offerText(o.give)}
                                      <br />⇄ {offerText(o.receive)}
                                    </p>
                                    <small>
                                      {[o.from, o.to]
                                        .map((id) => {
                                          const team = Object.values(
                                            w.players,
                                          ).filter((p) => p.country === id);
                                          return `${w.config.countries.find((c: any) => c.id === id).short}: 동의 ${team.filter((p) => o.votes[p.id] === true).length}/${Math.floor(team.length / 2) + 1}`;
                                        })
                                        .join(" · ")}
                                    </small>
                                    {o.status === "open" && (
                                      <>
                                        <div className="offer-votes">
                                          <button
                                            className={
                                              "secondary " +
                                              (o.votes[actor] === true
                                                ? "chosen"
                                                : "")
                                            }
                                            disabled={
                                              !editable || !!closeReason
                                            }
                                            onClick={() =>
                                              act({
                                                type: "vote",
                                                offer: o.id,
                                                agree: true,
                                              })
                                            }
                                          >
                                            <Check size={16} /> 동의
                                          </button>
                                          <button
                                            className="quiet"
                                            disabled={
                                              !editable || !!closeReason
                                            }
                                            onClick={() =>
                                              act({
                                                type: "vote",
                                                offer: o.id,
                                                agree: false,
                                              })
                                            }
                                          >
                                            반대
                                          </button>
                                          <button
                                            className="quiet"
                                            disabled={
                                              !editable || !!closeReason
                                            }
                                            onClick={() => counter(o)}
                                          >
                                            역제안
                                          </button>
                                        </div>
                                        {o.from === cid && (
                                          <button
                                            className="cancel-offer"
                                            disabled={!editable}
                                            onClick={() =>
                                              act({
                                                type: "cancelOffer",
                                                offer: o.id,
                                              })
                                            }
                                          >
                                            제안 취소
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                ))}
                              {!Object.values(w.offers).some(
                                (o) => o.from === cid || o.to === cid,
                              ) && (
                                <p className="micro">
                                  아직 제안이 없어요. 다른 나라에 필요한 것을
                                  물어보세요.
                                </p>
                              )}
                            </>
                          )}
                        </aside>
                      </div>
                      {["settlement", "meeting"].includes(w.phase) &&
                        p &&
                        reflectedRound > 0 && (
                          <section className="reflection-card">
                            <div>
                              <div className="overline">
                                우리의 교역을 돌아보기
                              </div>
                              <h2>{reflectedRound}라운드 성찰 기록</h2>
                              <p>답을 제출해야 다음 라운드 체력이 채워져요.</p>
                            </div>
                            <div className="reflection-fields">
                              {questions.map((q: string, i: number) => (
                                <label key={q}>
                                  {q}
                                  <textarea
                                    maxLength={500}
                                    value={answers[i] || ""}
                                    onChange={(e) =>
                                      setAnswers((prev) =>
                                        questions.map((_: string, k: number) =>
                                          k === i
                                            ? e.target.value
                                            : prev[k] || "",
                                        ),
                                      )
                                    }
                                  />
                                </label>
                              ))}
                              <button
                                className="primary"
                                disabled={
                                  busy ||
                                  answers.length !== questions.length ||
                                  answers.some((a) => !a.trim())
                                }
                                onClick={() =>
                                  act({ type: "reflect", answers })
                                }
                              >
                                {w.reflections[String(reflectedRound)]?.[actor]
                                  ? "답 수정하기"
                                  : "성찰 제출"}
                                <Check size={18} />
                              </button>
                            </div>
                          </section>
                        )}
                      <Activity w={w} />
                    </>
                  )}
                </>
              )}
              {tab === "world" && (
                <>
                  <div className="page-title">
                    <div className="overline">세 나라, 하나의 세계</div>
                    <h1>서로의 섬을 들여다봐요.</h1>
                    <p>어느 나라에 필요한 자원과 가공 기술이 있을까요?</p>
                  </div>
                  <div className="world-grid">
                    {w.config.countries.map((c: any) => (
                      <section className="world-island-card" key={c.id}>
                        <div className="panel-heading">
                          <h2>
                            <span
                              className="nation-dot"
                              style={{ background: c.color }}
                            />
                            {c.name}
                          </h2>
                          <b>{pct(progress(w, c.id))}</b>
                        </div>
                        <Island
                          world={w}
                          country={c.id}
                          positions={env!.positions}
                          origin={origin}
                          mini
                        />
                        <div className="world-island-info">
                          <b>{c.building.name}</b>
                          <p>
                            시설:{" "}
                            {Object.keys(w.countries[c.id].facilities)
                              .map((f) => w.config.facilities[f])
                              .join(", ")}
                          </p>
                          <p>
                            자원:{" "}
                            {Object.keys(c.regen)
                              .map((g) => w.config.goods[g].name)
                              .join(", ")}
                          </p>
                          <span>
                            함께하는 친구{" "}
                            {
                              Object.values(w.players).filter(
                                (p) => p.country === c.id,
                              ).length
                            }
                            명
                          </span>
                        </div>
                        <div className="mini-progress">
                          <div
                            style={{
                              width: pct(progress(w, c.id)),
                              background: c.color,
                            }}
                          />
                        </div>
                      </section>
                    ))}
                  </div>
                  <div className="cooperation-callout">
                    <Heart size={25} />
                    <div>
                      <h2>우리 건물 안에는 다른 나라가 들어 있어요.</h2>
                      <p>
                        원산지 보기를 켜고 완성된 블록을 살펴보세요. 자원과
                        기술이 함께 여행했어요.
                      </p>
                    </div>
                    <button
                      className="secondary"
                      onClick={() => setOrigin(!origin)}
                    >
                      <Layers size={18} />
                      원산지 {origin ? "끄기" : "보기"}
                    </button>
                  </div>
                </>
              )}
              {tab === "teacher" && host && (
                <>
                  <div className="page-title">
                    <div className="overline">선생님의 수업 도구</div>
                    <h1>오늘의 작은 세계를 운영해요.</h1>
                    <p>
                      학생의 회의와 협상에 시간을 주세요. 활동 판정 중에는 이
                      화면을 계속 열어 두세요.
                    </p>
                  </div>
                  <div className="teacher-top">
                    <section className="card join-card">
                      <div>
                        <h2>학생 초대하기</h2>
                        <p>같은 링크에서 방 코드와 별명을 입력해요.</p>
                        <strong className="big-code">{w.code}</strong>
                        <p>
                          {session.mode === "local"
                            ? "연습 모드는 같은 브라우저 탭에서만 연결돼요."
                            : "QR로 링크를 열고, 실명 대신 별명을 사용해요."}
                        </p>
                      </div>
                      {qr && <img src={qr} alt="학생 접속 QR 코드" />}
                    </section>
                    <section className="card phase-control">
                      <div className="panel-heading">
                        <h2>{phaseNames[w.phase]} 단계</h2>
                        <span>{Object.keys(w.players).length}명 참여</span>
                      </div>
                      <div className="phase-steps">
                        {["meeting", "activity", "settlement"].map((s) => (
                          <div
                            className={w.phase === s ? "current" : ""}
                            key={s}
                          >
                            <span>{phaseNames[s]}</span>
                            <small>{w.config.phaseSeconds[s] / 60}분</small>
                          </div>
                        ))}
                      </div>
                      <button
                        className="primary wide"
                        disabled={busy || w.phase === "ended"}
                        onClick={() => act({ type: "next" }, true)}
                      >
                        <Play size={18} />
                        {w.phase === "lobby"
                          ? "1라운드 회의 시작"
                          : w.phase === "meeting"
                            ? "활동 시작"
                            : w.phase === "activity"
                              ? "정산으로 넘어가기"
                              : w.round >= w.config.rounds
                                ? "수업 마치기"
                                : `${w.round + 1}라운드 회의 시작`}
                      </button>
                      <p className="micro">
                        타이머는 안내용이에요. 다음 단계는 선생님이 직접 열어요.
                      </p>
                    </section>
                  </div>
                  <section className="card">
                    <div className="panel-heading">
                      <div>
                        <h2>나라별 학생 배정</h2>
                        <p>
                          자동 배정 뒤 학생을 끌어 옮기거나 나라 선택으로
                          수정해요.
                        </p>
                      </div>
                      <button
                        className="secondary"
                        disabled={busy || w.phase !== "lobby"}
                        onClick={() => act({ type: "autoAssign" }, true)}
                      >
                        <Users size={18} />
                        자동 배정
                      </button>
                    </div>
                    <div className="assignment-grid">
                      {[
                        { id: "", name: "아직 배정 전", color: "#a5acb4" },
                        ...w.config.countries,
                      ].map((c: any) => (
                        <div
                          className="assignment-column"
                          key={c.id}
                          data-country={c.id}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const id = e.dataTransfer.getData("text/plain");
                            if (c.id)
                              act(
                                { type: "assign", player: id, country: c.id },
                                true,
                              );
                          }}
                        >
                          <h3>
                            <span
                              className="nation-dot"
                              style={{ background: c.color }}
                            />
                            {c.name}
                            <small>
                              {
                                Object.values(w.players).filter(
                                  (p) => p.country === c.id,
                                ).length
                              }
                              명
                            </small>
                          </h3>
                          {Object.values(w.players)
                            .filter((p) => p.country === c.id)
                            .map((p) => (
                              <div
                                className="student-chip"
                                key={p.id}
                                draggable={w.phase === "lobby"}
                                onDragStart={(e) =>
                                  e.dataTransfer.setData("text/plain", p.id)
                                }
                              >
                                <span
                                  className="drag-handle"
                                  onPointerDown={(e) =>
                                    e.currentTarget.setPointerCapture(
                                      e.pointerId,
                                    )
                                  }
                                  onPointerUp={(e) => {
                                    if (w.phase !== "lobby") return;
                                    const drop = document
                                      .elementFromPoint(e.clientX, e.clientY)
                                      ?.closest(
                                        "[data-country]",
                                      ) as HTMLElement;
                                    const country = drop?.dataset.country;
                                    if (country)
                                      act(
                                        {
                                          type: "assign",
                                          player: p.id,
                                          country,
                                        },
                                        true,
                                      );
                                  }}
                                >
                                  ⠿
                                </span>
                                <span>{p.nickname}</span>
                                <select
                                  aria-label={`${p.nickname} 나라 배정`}
                                  disabled={busy || w.phase !== "lobby"}
                                  value={p.country}
                                  onChange={(e) =>
                                    act(
                                      {
                                        type: "assign",
                                        player: p.id,
                                        country: e.target.value,
                                      },
                                      true,
                                    )
                                  }
                                >
                                  <option value="" disabled>
                                    선택
                                  </option>
                                  {w.config.countries.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                      {c.short}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  </section>
                  <div className="teacher-bottom">
                    <section className="card">
                      <div className="panel-heading">
                        <h2>다음 라운드 이벤트</h2>
                        <button
                          className="quiet"
                          disabled={!["lobby", "settlement"].includes(w.phase)}
                          onClick={() =>
                            setEvent({
                              ...event,
                              id: w.config.events[
                                Math.floor(
                                  Math.random() * w.config.events.length,
                                )
                              ].id,
                            })
                          }
                        >
                          <RefreshCw size={17} />
                          무작위
                        </button>
                      </div>
                      <div className="event-form">
                        <label>
                          이벤트
                          <select
                            value={event.id}
                            onChange={(e) =>
                              setEvent({ ...event, id: e.target.value })
                            }
                          >
                            {w.config.events.map((e: any) => (
                              <option key={e.id} value={e.id}>
                                {e.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          대상 나라
                          <select
                            value={event.country}
                            onChange={(e) =>
                              setEvent({ ...event, country: e.target.value })
                            }
                          >
                            {w.config.countries.map((c: any) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          원료
                          <select
                            value={event.good}
                            onChange={(e) =>
                              setEvent({ ...event, good: e.target.value })
                            }
                          >
                            {Object.entries(w.config.goods)
                              .filter(([, g]: any) => g.raw)
                              .map(([id, g]: any) => (
                                <option key={id} value={id}>
                                  {g.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label>
                          새 시설
                          <select
                            value={event.facility}
                            onChange={(e) =>
                              setEvent({ ...event, facility: e.target.value })
                            }
                          >
                            {Object.entries(w.config.facilities).map(
                              ([id, n]: any) => (
                                <option key={id} value={id}>
                                  {n}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      </div>
                      <p>
                        {
                          w.config.events.find((e: any) => e.id === event.id)
                            ?.description
                        }
                      </p>
                      <button
                        className="secondary"
                        disabled={
                          busy || !["lobby", "settlement"].includes(w.phase)
                        }
                        onClick={() => act({ type: "event", event }, true)}
                      >
                        다음 라운드에 적용
                      </button>
                      <p className="micro">
                        선택됨:{" "}
                        {
                          w.config.events.find(
                            (e: any) => e.id === w.pendingEvent.id,
                          )?.name
                        }{" "}
                        · 첫 라운드는 항상 국경이 닫혀요.
                      </p>
                    </section>
                    <section className="card">
                      <h2>수업 관리</h2>
                      <p>
                        최근 행동만 취소할 수 있어요. 이전 거래를 되돌리면
                        뒤따른 거래까지 영향을 줄 수 있기 때문이에요.
                      </p>
                      <button
                        className="secondary wide"
                        disabled={busy || !w.undo}
                        onClick={() => act({ type: "undo" }, true)}
                      >
                        <RefreshCw size={17} />
                        최근 행동 취소
                      </button>
                      {w.undo && <p className="micro">{w.undo.label}</p>}
                      <button
                        className="secondary wide"
                        onClick={() => setTab("world")}
                      >
                        <Globe2 size={18} />
                        세계 현황판 보기
                      </button>
                      <button
                        className="secondary wide"
                        onClick={() =>
                          download(
                            `NATIONLAB-${w.code}-성찰.csv`,
                            reflectionCSV(w),
                          )
                        }
                      >
                        <Download size={18} />
                        성찰 답 CSV 내보내기
                      </button>
                      <button
                        className="quiet wide"
                        onClick={() =>
                          download(
                            `NATIONLAB-${w.code}-결과.json`,
                            JSON.stringify(
                              {
                                code: w.code,
                                round: w.round,
                                countries: w.countries,
                                trades: w.trades,
                                reflections: w.reflections,
                              },
                              null,
                              2,
                            ),
                            "application/json",
                          )
                        }
                      >
                        <Download size={18} />
                        게임 결과 내보내기
                      </button>
                      <div className="danger-row">
                        <button
                          className="danger"
                          disabled={busy || w.phase === "ended"}
                          onClick={() => setConfirm("end")}
                        >
                          게임 종료
                        </button>
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => setConfirm("delete")}
                        >
                          <Trash2 size={16} />방 데이터 삭제
                        </button>
                      </div>
                    </section>
                  </div>
                  <section className="card">
                    <h2>나라별 창고와 건축</h2>
                    <div className="teacher-stocks">
                      {w.config.countries.map((c: any) => (
                        <div key={c.id}>
                          <div className="panel-heading">
                            <h3>{c.name}</h3>
                            <b>{pct(progress(w, c.id))}</b>
                          </div>
                          <Inventory w={w} country={c.id} />
                        </div>
                      ))}
                    </div>
                  </section>
                  <Activity w={w} />
                </>
              )}
              {tab === "records" && (
                <>
                  <div className="page-title">
                    <div className="overline">
                      블록이 오간 길, 생각이 자란 기록
                    </div>
                    <h1>우리 세계의 이야기</h1>
                    <p>
                      교역은 어떤 도움을 주었나요? 서로의 기록에서 찾아보세요.
                    </p>
                  </div>
                  <section className="card">
                    <h2>교역 기록</h2>
                    {w.trades.length ? (
                      w.trades.map((t) => (
                        <div className="trade-record" key={t.id}>
                          <span className="round-pill">{t.round}R</span>
                          <Ship size={21} />
                          <div>
                            <b>
                              {
                                w.config.countries.find(
                                  (c: any) => c.id === t.from,
                                ).name
                              }{" "}
                              ↔{" "}
                              {
                                w.config.countries.find(
                                  (c: any) => c.id === t.to,
                                ).name
                              }
                            </b>
                            <p>
                              {offerText(t.give)} ⇄ {offerText(t.receive)}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-note">
                        아직 체결된 교역이 없어요. 항구가 열리면 교역을 시작해
                        보세요.
                      </div>
                    )}
                  </section>
                  {host && (
                    <section className="card">
                      <div className="panel-heading">
                        <h2>학생 성찰 기록</h2>
                        <div className="inline-controls">
                          <select
                            aria-label="성찰 라운드"
                            value={filterRound}
                            onChange={(e) => setFilterRound(e.target.value)}
                          >
                            <option value="all">모든 라운드</option>
                            {Array.from({ length: w.config.rounds }, (_, i) => (
                              <option key={i} value={i + 1}>
                                {i + 1}라운드
                              </option>
                            ))}
                          </select>
                          <button
                            className="secondary"
                            onClick={() =>
                              download(
                                `NATIONLAB-${w.code}-성찰.csv`,
                                reflectionCSV(w),
                              )
                            }
                          >
                            <Download size={18} />
                            CSV
                          </button>
                        </div>
                      </div>
                      {Object.entries(w.reflections)
                        .filter(
                          ([r]) => filterRound === "all" || filterRound === r,
                        )
                        .map(([r, entries]) => (
                          <div key={r}>
                            <h3 className="reflection-round">{r}라운드</h3>
                            {w.config.countries.map((c: any) => (
                              <div key={c.id}>
                                <h4>{c.name}</h4>
                                {Object.values(entries)
                                  .filter((a) => a.country === c.id)
                                  .map((a, i) => (
                                    <div className="reflection-answer" key={i}>
                                      <b>{a.nickname}</b>
                                      {a.answers.map((answer, j) => (
                                        <p key={j}>
                                          <small>
                                            {
                                              (Number(r) === 1
                                                ? w.config.reflections.first
                                                : w.config.reflections.regular)[
                                                j
                                              ]
                                            }
                                          </small>
                                          {answer}
                                        </p>
                                      ))}
                                    </div>
                                  ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      {!Object.keys(w.reflections).length && (
                        <div className="empty-note">
                          정산 단계에서 학생들이 작성한 답이 여기에 모여요.
                        </div>
                      )}
                    </section>
                  )}
                  <Activity w={w} />
                </>
              )}
            </main>
          </div>
          <footer className="nl-footer">
            NATIONLAB · 자원도 기술도, 나누면 더 커지는 세계
            <span>몬스터도 순위도 없이, 함께 완성하는 우리 교실</span>
          </footer>
        </>
      )}
      {guide && (
        <div className="modal-backdrop">
          <section className="modal">
            <button
              className="modal-close icon-button"
              aria-label="안내 닫기"
              onClick={() => setGuide(false)}
            >
              <X />
            </button>
            <div className="overline">작은 세계의 약속</div>
            <h1>함께 완성하면, 모두의 성공이에요.</h1>
            <div className="guide-step">
              <span>01</span>
              <div>
                <h3>자원과 기술이 다른 세 나라</h3>
                <p>
                  화련은 목화와 광석, 사하르는 석유와 모래, 히노미는 나무와
                  용광로가 있어요. 우리에게 없는 것은 친구 나라에 있어요.
                </p>
              </div>
            </div>
            <div className="guide-step">
              <span>02</span>
              <div>
                <h3>회의 → 활동 → 정산</h3>
                <p>
                  활동 시간에 블록 옆으로 이동해서 캐요. 체력은 라운드마다{" "}
                  {cfg.stamina}이고, 채굴할 때 1씩 줄어요. 시설 옆에서 가공하고
                  건축 부지에 놓아요.
                </p>
              </div>
            </div>
            <div className="guide-step">
              <span>03</span>
              <div>
                <h3>항구에서 협상하기</h3>
                <p>
                  1라운드는 국경이 닫혀요. 2라운드부터 줄 것과 받을 것을
                  제안하고, 두 나라 팀원 과반이 동의하면 교역이 이루어져요. G도
                  함께 교환할 수 있어요.
                </p>
              </div>
            </div>
            <div className="guide-step">
              <span>04</span>
              <div>
                <h3>원산지와 생각을 돌아보기</h3>
                <p>
                  완성된 블록은 어디서 왔을까요? 원산지 보기를 켜고 다른 나라의
                  도움을 찾아보세요. 정산에서 성찰을 제출해야 다음 체력이
                  채워져요.
                </p>
              </div>
            </div>
            <div className="teaching-note">
              <p>
                실시간 수업에는 Firebase 설정이 필요해요. 교사 화면을 수업 중
                계속 열어 두세요. 같은 태블릿의 같은 브라우저로 재접속하면
                별명과 나라가 복원돼요.
              </p>
            </div>
          </section>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section className="modal confirm-modal">
            <h2>
              {confirm === "delete"
                ? "방 데이터를 모두 삭제할까요?"
                : confirm === "end"
                  ? "이 수업을 마칠까요?"
                  : "접속 화면으로 돌아갈까요?"}
            </h2>
            <p>
              {confirm === "delete"
                ? "학생 별명, 창고, 교역, 성찰 답이 모두 삭제돼요. 필요하면 먼저 결과를 내보내세요."
                : confirm === "end"
                  ? "모든 학생의 활동이 멈춰요. 결과와 성찰은 계속 볼 수 있어요."
                  : "현재 게임은 남아 있어요. 같은 방 코드로 다시 들어올 수 있어요."}
            </p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => setConfirm("")}>
                돌아가기
              </button>
              <button
                className={confirm === "delete" ? "danger" : "primary"}
                disabled={busy}
                onClick={async () => {
                  if (confirm === "exit") exit();
                  else if (confirm === "end") await act({ type: "end" }, true);
                  else if (session) {
                    setBusy(true);
                    try {
                      await deleteRoom(session);
                      exit();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }
                  setConfirm("");
                }}
              >
                확인
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function BlockIcon({ w, good }: { w: World; good: string }) {
  return (
    <span
      className="block-icon"
      style={{ background: w.config.goods[good].color }}
    />
  );
}
function Inventory({ w, country }: { w: World; country: string }) {
  return (
    <div className="inventory-grid">
      {Object.entries(w.config.goods).map(([id, g]: any) => (
        <div key={id}>
          <BlockIcon w={w} good={id} />
          <span>{g.name}</span>
          <b>{w.countries[country].stock[id].length}</b>
        </div>
      ))}
    </div>
  );
}
function BasketForm({
  w,
  title,
  value,
  onChange,
}: {
  w: World;
  title: string;
  value: Basket;
  onChange: (b: Basket) => void;
}) {
  const [good, setGood] = useState("wood");
  return (
    <div className="basket-form">
      <h3>{title}</h3>
      <div className="basket-input">
        <select
          aria-label={title + " 품목"}
          value={good}
          onChange={(e) => setGood(e.target.value)}
        >
          {Object.entries(w.config.goods).map(([id, g]: any) => (
            <option key={id} value={id}>
              {g.name}
            </option>
          ))}
        </select>
        <input
          aria-label={title + " 수량"}
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          value={value.goods[good] || 0}
          onChange={(e) =>
            onChange({
              ...value,
              goods: { ...value.goods, [good]: +e.target.value },
            })
          }
        />
      </div>
      <div className="basket-tags">
        {Object.entries(value.goods)
          .filter(([, n]) => n > 0)
          .map(([g, n]) => (
            <button
              key={g}
              onClick={() =>
                onChange({ ...value, goods: { ...value.goods, [g]: 0 } })
              }
            >
              {w.config.goods[g].name} {n}
              <X size={12} />
            </button>
          ))}
      </div>
      <label className="gold-input">
        G
        <input
          aria-label={title + " G"}
          type="number"
          min={0}
          max={100000}
          value={value.gold}
          onChange={(e) => onChange({ ...value, gold: +e.target.value })}
        />
      </label>
    </div>
  );
}
function Activity({ w }: { w: World }) {
  return (
    <section className="activity-card">
      <div className="panel-heading">
        <h2>우리 세계의 새 소식</h2>
        <span>누가 무엇을 했을까요?</span>
      </div>
      {w.logs.slice(0, 7).map((l) => (
        <div className="activity-line" key={l.id}>
          <span className="tiny-dot" />
          <span>{l.text}</span>
          <small>{l.round ? `${l.round}라운드` : "준비"}</small>
        </div>
      ))}
    </section>
  );
}

export default function App(){return (globalThis as any).NATIONLAB_CONFIG?.experience === "sandbox" && !new URLSearchParams(location.search).has("legacy") ? <SandboxApp/> : <LegacyApp/>;}
