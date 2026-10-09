import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type KoreaRegion = { id: string; name: string; short: string; lat: number; lon: number; color: string };
export type KoreaBuilding = { id: string; regionId: string; serverId: string; school: string; className: string; title: string; kind: "bridge" | "school" | "hospital"; progress: number; updatedAt: number };
export type KoreaWorldProps = { regions: KoreaRegion[]; buildings: KoreaBuilding[]; selectedRegion: string; selectedServer: string; onSelectRegion: (id: string) => void };
const buttonStyle = { minHeight: 44, minWidth: 44, border: "1px solid #cfddd3", borderRadius: 12, background: "#fffef7", color: "#355a4b", padding: "8px 12px", cursor: "pointer" } as const;
const location = (lat: number, lon: number) => new THREE.Vector3((lon - 127.6) * 2.3, .31, (37 - lat) * 2.75);
const progressOf = (b: KoreaBuilding) => Math.max(0, Math.min(1, Number.isFinite(b.progress) ? b.progress : 0));
function hash(text: string) { let n = 2166136261; for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0) / 4294967295; }

export default function KoreaWorld(props: KoreaWorldProps) {
  const { regions, buildings, selectedRegion, selectedServer, onSelectRegion } = props;
  const canvas = useRef<HTMLCanvasElement>(null), current = useRef(props);
  current.current = props;
  const controlsRef = useRef<{ zoom: (factor: number) => void; reset: () => void; pan: (x: number, z: number) => void } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null), [fallback, setFallback] = useState(false);
  const selected = buildings.find(b => b.id === selectedBuilding);
  const selectionRef = useRef(selectedBuilding); selectionRef.current = selectedBuilding;
  useEffect(() => {
    if (fallback) return;
    const el = canvas.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: el, antialias: true, powerPreference: "low-power" }); }
    catch { setFallback(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor("#c7e5e8");
    const scene = new THREE.Scene(); scene.background = new THREE.Color("#c7e5e8");
    const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, .1, 100);
    const target = new THREE.Vector3(0, 0, 2.2);
    camera.position.set(0, 19, 18); camera.lookAt(target);
    const controls = new OrbitControls(camera, el);
    controls.target.copy(target); controls.enableDamping = true; controls.dampingFactor = .12;
    controls.minZoom = .7; controls.maxZoom = 4; controls.minPolarAngle = .12; controls.maxPolarAngle = Math.PI / 3.2;
    controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    controls.screenSpacePanning = false; controls.enableRotate = true; controls.update(); controls.saveState();
    controlsRef.current = {
      zoom(factor) { camera.zoom = THREE.MathUtils.clamp(camera.zoom * factor, .7, 4); camera.updateProjectionMatrix(); },
      reset() { controls.reset(); },
      pan(x, z) { const d = new THREE.Vector3(x / camera.zoom, 0, z / camera.zoom); controls.target.add(d); camera.position.add(d); controls.update(); },
    };
    scene.add(new THREE.HemisphereLight("#fffbed", "#719b9a", 2.1));
    const light = new THREE.DirectionalLight("#fff5e9", 2.4); light.position.set(-6, 15, 7); scene.add(light);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    const geo = <T extends THREE.BufferGeometry>(g: T) => { geometries.add(g); return g; };
    const cube = geo(new THREE.BoxGeometry(1, 1, 1)), cylinder = geo(new THREE.CylinderGeometry(1, 1, 1, 16)), cone = geo(new THREE.ConeGeometry(1, 1, 4));
    const palette = new Map<string, THREE.MeshStandardMaterial>();
    function mat(color: string) { if (!palette.has(color)) { const m = new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: true }); palette.set(color, m); materials.add(m); } return palette.get(color)!; }
    function box(group: THREE.Object3D, color: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, geometry: THREE.BufferGeometry = cube) {
      const m = new THREE.Mesh(geometry, mat(color)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); group.add(m); return m;
    }
    // Coastline is an illustrative geographic approximation, not administrative or school GPS data.
    const outline = [
      [126.62,37.78],[127.04,38.00],[127.48,38.30],[128.05,38.32],[128.36,38.62],
      [128.52,38.28],[128.64,38.06],[128.84,37.78],[129.05,37.50],[129.21,37.27],
      [129.35,36.94],[129.39,36.55],[129.44,36.21],[129.39,35.91],[129.53,35.49],
      [129.33,35.15],[129.05,35.04],[128.83,35.09],[128.70,34.83],[128.44,34.88],
      [128.40,34.68],[128.10,34.78],[127.82,34.70],[127.74,34.88],[127.63,34.59],
      [127.45,34.43],[127.34,34.70],[127.12,34.56],[126.99,34.42],[126.82,34.56],
      [126.59,34.31],[126.34,34.38],[126.28,34.63],[126.43,34.81],[126.32,35.01],
      [126.36,35.19],[126.49,35.35],[126.46,35.54],[126.60,35.72],[126.73,35.87],
      [126.65,36.04],[126.51,36.22],[126.53,36.43],[126.31,36.57],[126.14,36.77],
      [126.28,36.94],[126.48,36.89],[126.61,37.00],[126.70,37.17],[126.53,37.35],
      [126.64,37.53],[126.54,37.65],
    ];
    function land(points: number[][], color: string) {
      const shape = new THREE.Shape(); points.forEach(([lon, lat], i) => { const p = location(lat, lon); if (!i) shape.moveTo(p.x, -p.z); else shape.lineTo(p.x, -p.z); }); shape.closePath();
      const geometry = geo(new THREE.ExtrudeGeometry(shape, { depth: .26, bevelEnabled: true, bevelSize: .045, bevelThickness: .045, bevelSegments: 1, steps: 1, curveSegments: 2 }));
      const country = new THREE.Mesh(geometry, [mat(color), mat("#91ab86")]); country.rotation.x = -Math.PI / 2; scene.add(country);
      const coast = new THREE.Mesh(geometry, mat("#e5d3a2")); coast.rotation.x = -Math.PI / 2; coast.scale.set(1.022, 1.022, 1); coast.position.y = -.12; scene.add(coast);
    }
    land(outline, "#b9d2a2");
    land([[126.15,33.30],[126.24,33.42],[126.45,33.53],[126.70,33.55],[126.93,33.46],[126.86,33.31],[126.60,33.22],[126.33,33.20]], "#a9caa0");
    // A few southwest islands and mountain ridges give the map depth without obscuring schools.
    [[126.09,34.52],[126.21,34.86],[126.02,34.82],[126.06,35.01],[128.62,34.77]].forEach(([lon,lat]) => { const p=location(lat,lon); box(scene,"#bed1a1",p.x,.07,p.z,.16,.12,.2,cylinder); });
    for (let i=0;i<12;i++) { const lat=35.2+i*.22,lon=128.25+Math.sin(i*.7)*.18,p=location(lat,lon); const m=box(scene,"#98b391",p.x,.38,p.z,.17,.25+hash(String(i))*.2,.22,cone); m.rotation.y=.6; }
    const markers = new THREE.Group(); scene.add(markers);
    const pickables: THREE.Object3D[] = [];
    function label(group: THREE.Object3D, text: string, x: number, y: number, z: number, color: string, size=.33) {
      const c=document.createElement("canvas"),ctx=c.getContext("2d")!; ctx.font="600 26px sans-serif";
      c.width=Math.ceil(ctx.measureText(text).width+26); c.height=44;
      ctx.fillStyle="rgba(255,255,247,.96)";ctx.beginPath();ctx.roundRect(0,0,c.width,44,11);ctx.fill();
      ctx.font="600 26px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle=color;ctx.fillText(text,c.width/2,23);
      const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);
      const material=new THREE.SpriteMaterial({map:texture,depthTest:false});materials.add(material);
      const sprite=new THREE.Sprite(material);sprite.position.set(x,y,z);sprite.scale.set(size*c.width/44,size,1);sprite.renderOrder=10;group.add(sprite);
    }
    function clearMarkers() {
      markers.traverse(o=>{if(o instanceof THREE.Sprite){if(o.material.map){o.material.map.dispose();textures.delete(o.material.map);}o.material.dispose();materials.delete(o.material);}});
      markers.clear();pickables.length=0;
    }
    let signature="";
    function rebuild() {
      const p=current.current,next=JSON.stringify([p.regions,p.buildings,p.selectedRegion,p.selectedServer,selectionRef.current]);if(next===signature)return;signature=next;clearMarkers();
      for(const region of p.regions){
        const g=new THREE.Group(),pos=location(region.lat,region.lon);g.position.copy(pos);g.userData.region=region.id;markers.add(g);
        const active=region.id===p.selectedRegion;
        box(g,active?"#f4bd62":region.color||"#83afa1",0,.03,0,active?.19:.12,.055,active?.19:.12,cylinder);
        // Dense metropolitan areas remain readable through small label offsets; dots retain actual region centers.
        const labelX=region.name.includes("서울")?-.40:region.name.includes("인천")?-.47:region.name.includes("세종")?-.38:region.name.includes("대전")?.40:0;
        const labelZ=region.name.includes("서울")?-.20:region.name.includes("경기")?.2:0;
        label(g,region.short||region.name,labelX,.43,labelZ,active?"#865e24":"#466a59",active?.36:.30);
        pickables.push(g);
      }
      const grouped=new Map<string,KoreaBuilding[]>();for(const b of p.buildings){const list=grouped.get(b.regionId)||[];list.push(b);grouped.set(b.regionId,list);}
      for(const [id,list]of grouped){
        const region=p.regions.find(r=>r.id===id);if(!region)continue;
        list.sort((a,b)=>a.id.localeCompare(b.id));
        list.forEach((b,i)=>{
          const pos=location(region.lat,region.lon),angle=i*2.399+hash(b.id)*.45,radius=.32+Math.sqrt(i)*.20;
          const g=new THREE.Group();g.position.set(pos.x+Math.cos(angle)*radius,.31,pos.z+Math.sin(angle)*radius);g.userData.building=b.id;g.userData.region=b.regionId;markers.add(g);pickables.push(g);
          const progress=progressOf(b),active=b.serverId===p.selectedServer,selected=b.id===selectionRef.current,color=selected?"#e4ad60":active?"#6dada2":"#a1aab5";
          box(g,selected?"#f2d89c":"#e8dfc1",0,.025,0,.32,.05,.3);
          if(progress>0){
            const h=.09+progress*.29;
            box(g,"#fff2d9",0,h/2+.05,0,.24,h,.22);
            if(b.kind==="bridge"){
              for(const x of[-.09,.09])box(g,color,x,.18,0,.045,.29,.22);
              box(g,color,0,.25,0,.35,.05,.12);
            }else{
              const roof=box(g,color,0,h+.095,0,.22,.12,.2,cone);roof.rotation.y=Math.PI/4;
              box(g,"#8baeb8",-.055,h*.6,.114,.055,.065,.012);box(g,"#8baeb8",.055,h*.6,.114,.055,.065,.012);
              if(b.kind==="hospital"){box(g,"#c98174",0,h+.16,.105,.12,.033,.012);box(g,"#c98174",0,h+.16,.11,.033,.12,.012);}
            }
          }
          if(progress<1){
            for(const x of[-.14,.14])box(g,"#c89e69",x,.19,-.11,.019,.34,.019);
            box(g,"#c89e69",0,.35,-.11,.3,.019,.019);
          }
          if(selected)label(g,`${b.school} ${b.className}`,0,.72,0,"#7e5b2c",.32);
        });
      }
    }
    const raycaster=new THREE.Raycaster();let down:{x:number;y:number}|null=null;
    const pointerDown=(e:PointerEvent)=>{down={x:e.clientX,y:e.clientY};};
    const pointerUp=(e:PointerEvent)=>{
      if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>7)return;down=null;
      const r=el.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);
      for(const hit of raycaster.intersectObjects(pickables,true)){
        let o:THREE.Object3D|null=hit.object;while(o&&!o.userData.region)o=o.parent;
        if(o){if(o.userData.building)setSelectedBuilding(o.userData.building);current.current.onSelectRegion(o.userData.region);return;}
      }
    };
    el.addEventListener("pointerdown",pointerDown);el.addEventListener("pointerup",pointerUp);
    const lost=(event:Event)=>{event.preventDefault();setFallback(true);};el.addEventListener("webglcontextlost",lost);
    let frame=0,last=0,w=0,h=0,visible=true;
    const observer=new IntersectionObserver(e=>{visible=e[0]?.isIntersecting??true;});observer.observe(el);
    const draw=(time:number)=>{
      frame=requestAnimationFrame(draw);if(!visible||document.hidden||time-last<40)return;last=time;
      const nw=Math.max(1,el.clientWidth),nh=Math.max(1,el.clientHeight);if(nw!==w||nh!==h){w=nw;h=nh;renderer.setSize(w,h,false);const half=7.6;camera.left=-half*w/h;camera.right=half*w/h;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();}
      rebuild();controls.update();
      controls.target.x=THREE.MathUtils.clamp(controls.target.x,-8,8);controls.target.z=THREE.MathUtils.clamp(controls.target.z,-7,13);
      renderer.render(scene,camera);el.dataset.renderer="webgl";
    };frame=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();el.removeEventListener("pointerdown",pointerDown);el.removeEventListener("pointerup",pointerUp);el.removeEventListener("webglcontextlost",lost);controls.dispose();controlsRef.current=null;geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.forceContextLoss();};
  }, [fallback]);
  // Selection changes stay outside the GPU lifecycle; scene reads current data each frame.
  const visibleBuildings=buildings.filter(b=>!selectedRegion||b.regionId===selectedRegion);
  return <section aria-label="대한민국 학교 공동 건축 월드" style={{background:"#fffef9",border:"1px solid #dce5d7",borderRadius:18,overflow:"hidden"}}>
    <div style={{padding:"18px 20px",display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"center"}}>
      <div><h2 style={{margin:0,fontSize:19,color:"#355749"}}>대한민국, 함께 짓는 세계</h2><p style={{margin:"6px 0 0",fontSize:12,color:"#718674"}}>학교·학급이 공개한 건축물 {buildings.length}개 · 교육청을 선택해 둘러보세요.</p></div>
      <div role="group" aria-label="지도 카메라" style={{display:"flex",gap:6}}>
        <button style={buttonStyle} aria-label="지도 확대" onClick={()=>controlsRef.current?.zoom(1.3)}>＋</button>
        <button style={buttonStyle} aria-label="지도 축소" onClick={()=>controlsRef.current?.zoom(1/1.3)}>−</button>
        <button style={buttonStyle} onClick={()=>controlsRef.current?.reset()}>전체 보기</button>
      </div>
    </div>
    {!fallback?<canvas ref={canvas} aria-label="대한민국 입체 지도. 방향키로 이동하고 더하기·빼기로 확대·축소할 수 있습니다." tabIndex={0} role="img" onKeyDown={e=>{const delta:Record<string,[number,number]>={ArrowLeft:[-.6,0],ArrowRight:[.6,0],ArrowUp:[0,-.6],ArrowDown:[0,.6]};if(delta[e.key]){e.preventDefault();controlsRef.current?.pan(...delta[e.key]);}else if(e.key==="+"||e.key==="="){e.preventDefault();controlsRef.current?.zoom(1.3);}else if(e.key==="-"){e.preventDefault();controlsRef.current?.zoom(1/1.3);}else if(e.key==="Home"){e.preventDefault();controlsRef.current?.reset();}}} style={{display:"block",width:"100%",height:"clamp(390px, 58vw, 620px)",touchAction:"none",outlineOffset:-3}}/>:<div role="status" style={{padding:32,background:"#d7e9e4",color:"#426758"}}>이 기기에서는 아래 교육청·학급 목록으로 월드를 둘러볼 수 있어요.</div>}
    <p style={{padding:"10px 20px",margin:0,color:"#718674",fontSize:12,background:"#f1f6ef"}}>드래그하여 이동 · 두 손가락으로 확대 · 건축물을 눌러 학급 보기<br/>대한민국 지형을 단순화한 지도입니다. 건축물은 교육청 주변에 표시하며 실제 학교 위치가 아닙니다.</p>
    <div aria-label="교육청 목록" style={{display:"flex",gap:7,overflowX:"auto",padding:"14px 18px"}}>{regions.map(r=><button key={r.id} aria-pressed={r.id===selectedRegion} onClick={()=>onSelectRegion(r.id)} style={{...buttonStyle,whiteSpace:"nowrap",background:r.id===selectedRegion?"#e5efdd":"#fffef9",borderColor:r.id===selectedRegion?"#8daa80":"#cfddd3"}}>{r.short||r.name}</button>)}</div>
    {selected&&<article aria-live="polite" style={{margin:"0 18px 14px",padding:16,border:"1px solid #d7c18e",borderRadius:12,background:"#fff6df"}}><strong>{selected.school} · {selected.className}</strong><p style={{margin:"8px 0"}}>{selected.title} · {Math.round(progressOf(selected)*100)}% 완성</p><small>{regions.find(r=>r.id===selected.regionId)?.name} · {selected.serverId===selectedServer?"선택한 교육지원청 서버":"다른 교육지원청 서버"}</small><button style={{...buttonStyle,float:"right"}} aria-label="건축물 상세 닫기" onClick={()=>setSelectedBuilding(null)}>닫기</button></article>}
    <div aria-label="공개된 학교 학급 건축물" style={{padding:"0 18px 18px",display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:10}}>
      {visibleBuildings.length?visibleBuildings.map(b=><button key={b.id} onClick={()=>{setSelectedBuilding(b.id);onSelectRegion(b.regionId);}} aria-pressed={selectedBuilding===b.id} style={{...buttonStyle,textAlign:"left",padding:14,background:b.serverId===selectedServer?"#eef5e9":"#fafbf6"}}><strong>{b.school} · {b.className}</strong><span style={{display:"block",fontSize:12,margin:"6px 0",color:"#718674"}}>{b.title} · {Math.round(progressOf(b)*100)}% 완성</span><span style={{display:"block",height:5,background:"#dfe7d9",borderRadius:4}}><span style={{display:"block",height:5,width:`${progressOf(b)*100}%`,background:"#93b888",borderRadius:4}}/></span></button>):<p style={{margin:"4px 0 8px",fontSize:13,color:"#718674"}}>{selectedRegion?"이 교육청에 공개된 학급 건축물이 아직 없어요.":"공개된 학급 건축물이 아직 없어요."} 우리 학급의 첫 건축물을 함께 만들어 보세요.</p>}
    </div>
  </section>;
}
